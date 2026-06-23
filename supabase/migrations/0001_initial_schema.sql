-- ============================================================================
-- GainGang — Initial schema
-- Social calisthenics app: Profiles, Gangs, Quests, Activities, Social, Rewards.
--
-- Apply this in the Supabase Dashboard → SQL Editor (or via `supabase db push`
-- once the CLI is linked). Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE
-- where practical. RLS is enabled on every public table.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES  (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text        not null default '',
  username        text        unique,
  avatar_url      text,
  bio             text,
  -- onboarding fitness level
  fitness_level   text        not null default 'beginner'
                    check (fitness_level in ('beginner','intermediate','advanced')),
  -- Solo-Leveling-inspired rank: E (lowest) → S (highest)
  rank            text        not null default 'E'
                    check (rank in ('E','D','C','B','A','S')),
  xp              integer     not null default 0 check (xp >= 0),
  currency        integer     not null default 0 check (currency >= 0),
  current_streak  integer     not null default 0 check (current_streak >= 0),
  longest_streak  integer     not null default 0 check (longest_streak >= 0),
  last_active_on  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. GANGS  (groups)
-- ----------------------------------------------------------------------------
create table if not exists public.gangs (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null check (char_length(name) between 2 and 60),
  description     text,
  icon            text,                 -- emoji or short icon key
  privacy         text        not null default 'public'
                    check (privacy in ('public','invite_only')),
  invite_code     text        not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  -- baseline quest difficulty the admin sets for the gang
  difficulty      text        not null default 'E'
                    check (difficulty in ('E','D','C','B','A','S')),
  current_streak  integer     not null default 0 check (current_streak >= 0),
  longest_streak  integer     not null default 0 check (longest_streak >= 0),
  owner_id        uuid        not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index if not exists gangs_owner_idx on public.gangs(owner_id);
create index if not exists gangs_privacy_idx on public.gangs(privacy);

-- ----------------------------------------------------------------------------
-- 3. GANG MEMBERS  (M:N profiles <-> gangs)
-- ----------------------------------------------------------------------------
create table if not exists public.gang_members (
  gang_id     uuid        not null references public.gangs(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  role        text        not null default 'member'
                check (role in ('owner','admin','member')),
  joined_at   timestamptz not null default now(),
  primary key (gang_id, user_id)
);

create index if not exists gang_members_user_idx on public.gang_members(user_id);

-- ----------------------------------------------------------------------------
-- 4. EXERCISES  (catalog, grouped by the weekly schedule categories)
-- ----------------------------------------------------------------------------
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  -- maps to the 5-day weekly schedule
  category    text        not null
                check (category in ('chest','legs','cardio','back','core')),
  -- how a contribution is measured
  unit        text        not null default 'reps'
                check (unit in ('reps','seconds','meters')),
  description text,
  -- null gang_id = global default exercise; otherwise gang-custom
  gang_id     uuid        references public.gangs(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists exercises_category_idx on public.exercises(category);

-- ----------------------------------------------------------------------------
-- 5. QUESTS  (daily / weekly group goals issued at the gang level)
-- ----------------------------------------------------------------------------
create table if not exists public.quests (
  id                     uuid primary key default gen_random_uuid(),
  gang_id                uuid        not null references public.gangs(id) on delete cascade,
  type                   text        not null default 'daily'
                           check (type in ('daily','weekly')),
  -- Solo-Leveling-flavoured title e.g. "The Iron Oath"
  title                  text        not null,
  day_category           text        check (day_category in ('chest','legs','cardio','back','core')),
  exercise_id            uuid        references public.exercises(id) on delete set null,
  unit                   text        not null default 'reps'
                           check (unit in ('reps','seconds','meters')),
  -- collective target the whole gang must hit together
  gang_target            integer     not null default 0 check (gang_target >= 0),
  -- per-member contribution quota (base value before tier scaling)
  individual_target      integer     not null default 0 check (individual_target >= 0),
  starts_on              date        not null default current_date,
  ends_on                date        not null default current_date,
  status                 text        not null default 'active'
                           check (status in ('active','completed','failed')),
  created_at             timestamptz not null default now()
);

create index if not exists quests_gang_idx on public.quests(gang_id);
create index if not exists quests_active_idx on public.quests(gang_id, status, starts_on);

-- ----------------------------------------------------------------------------
-- 6. ACTIVITIES  (logged workouts — contribute to quests + feed the social feed)
-- ----------------------------------------------------------------------------
create table if not exists public.activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  gang_id          uuid        references public.gangs(id) on delete set null,
  quest_id         uuid        references public.quests(id) on delete set null,
  exercise_id      uuid        references public.exercises(id) on delete set null,
  exercise_name    text        not null,            -- denormalised for feed display
  category         text        check (category in ('chest','legs','cardio','back','core')),
  unit             text        not null default 'reps'
                     check (unit in ('reps','seconds','meters')),
  -- the contribution amount in `unit` (reps count / seconds held / meters travelled)
  amount           integer     not null default 0 check (amount >= 0),
  sets             integer     check (sets is null or sets > 0),
  notes            text,
  photo_url        text,
  created_at       timestamptz not null default now()
);

create index if not exists activities_user_idx on public.activities(user_id, created_at desc);
create index if not exists activities_gang_idx on public.activities(gang_id, created_at desc);
create index if not exists activities_quest_idx on public.activities(quest_id);

-- ----------------------------------------------------------------------------
-- 7. KUDOS  (likes on an activity)
-- ----------------------------------------------------------------------------
create table if not exists public.kudos (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid        not null references public.activities(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists kudos_activity_idx on public.kudos(activity_id);

-- ----------------------------------------------------------------------------
-- 8. COMMENTS  (on an activity)
-- ----------------------------------------------------------------------------
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid        not null references public.activities(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  body         text        not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create index if not exists comments_activity_idx on public.comments(activity_id, created_at);

-- ----------------------------------------------------------------------------
-- 9. ACHIEVEMENTS  (catalog) + USER_ACHIEVEMENTS (earned)
-- ----------------------------------------------------------------------------
create table if not exists public.achievements (
  id           uuid primary key default gen_random_uuid(),
  key          text        not null unique,   -- stable identifier e.g. 'first_quest'
  title        text        not null,
  description  text        not null,
  icon         text,
  category     text        not null default 'general'
                 check (category in ('quest','streak','reps','social','gang','rare','general')),
  threshold    integer,                        -- numeric milestone where relevant
  is_secret    boolean     not null default false
);

create table if not exists public.user_achievements (
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  achievement_id  uuid        not null references public.achievements(id) on delete cascade,
  earned_at       timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ----------------------------------------------------------------------------
-- 10. NOTIFICATIONS  (kudos, comments, quest reminders, rank-ups)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  type         text        not null
                 check (type in ('kudos','comment','mention','quest','achievement','rank_up','gang')),
  actor_id     uuid        references public.profiles(id) on delete cascade,
  activity_id  uuid        references public.activities(id) on delete cascade,
  body         text        not null,
  is_read      boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, is_read, created_at desc);

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS to avoid recursive policies)
-- ============================================================================
create or replace function public.is_gang_member(p_gang_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.gang_members
    where gang_id = p_gang_id and user_id = p_user_id
  );
$$;

create or replace function public.is_gang_admin(p_gang_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.gang_members
    where gang_id = p_gang_id and user_id = p_user_id and role in ('owner','admin')
  );
$$;

-- Shared gang? (true if the two users are co-members of at least one gang)
create or replace function public.shares_gang(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.gang_members a
    join public.gang_members b on a.gang_id = b.gang_id
    where a.user_id = p_user_a and b.user_id = p_user_b
  );
$$;

-- ============================================================================
-- TRIGGER: auto-create a profile when a new auth user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep profiles.updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated on public.profiles;
create trigger profiles_touch_updated
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RPCs: gang creation & joining (run as definer so the chicken-and-egg
-- "create gang then insert owner membership" works under RLS)
-- ============================================================================
create or replace function public.create_gang(
  p_name        text,
  p_description text default null,
  p_icon        text default null,
  p_privacy     text default 'public'
)
returns public.gangs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.gangs (name, description, icon, privacy, owner_id)
  values (p_name, p_description, p_icon, coalesce(p_privacy,'public'), auth.uid())
  returning * into v_gang;

  insert into public.gang_members (gang_id, user_id, role)
  values (v_gang.id, auth.uid(), 'owner');

  return v_gang;
end;
$$;

create or replace function public.join_gang(p_invite_code text)
returns public.gangs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gang from public.gangs
  where invite_code = upper(trim(p_invite_code));

  if v_gang.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.gang_members (gang_id, user_id, role)
  values (v_gang.id, auth.uid(), 'member')
  on conflict (gang_id, user_id) do nothing;

  return v_gang;
end;
$$;

-- Join a public gang by id (browse & join)
create or replace function public.join_public_gang(p_gang_id uuid)
returns public.gangs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gang from public.gangs where id = p_gang_id;

  if v_gang.id is null then
    raise exception 'Gang not found';
  end if;
  if v_gang.privacy <> 'public' then
    raise exception 'This gang is invite-only';
  end if;

  insert into public.gang_members (gang_id, user_id, role)
  values (v_gang.id, auth.uid(), 'member')
  on conflict (gang_id, user_id) do nothing;

  return v_gang;
end;
$$;

-- ============================================================================
-- VIEWS: aggregate helpers
-- ============================================================================

-- Per-quest progress: gang total + number of contributors.
create or replace view public.quest_progress
with (security_invoker = true) as
select
  q.id                                   as quest_id,
  q.gang_id,
  coalesce(sum(a.amount), 0)::bigint     as gang_total,
  count(distinct a.user_id)::int         as contributor_count
from public.quests q
left join public.activities a on a.quest_id = q.id
group by q.id, q.gang_id;

-- Per-(quest,user) contribution totals for individual-target tracking.
create or replace view public.quest_user_progress
with (security_invoker = true) as
select
  a.quest_id,
  a.user_id,
  coalesce(sum(a.amount), 0)::bigint as user_total
from public.activities a
where a.quest_id is not null
group by a.quest_id, a.user_id;

-- Activity engagement counts for the feed (kudos + comments).
create or replace view public.activity_engagement
with (security_invoker = true) as
select
  a.id as activity_id,
  (select count(*) from public.kudos k where k.activity_id = a.id)::int     as kudos_count,
  (select count(*) from public.comments c where c.activity_id = a.id)::int  as comment_count
from public.activities a;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.gangs             enable row level security;
alter table public.gang_members      enable row level security;
alter table public.exercises         enable row level security;
alter table public.quests            enable row level security;
alter table public.activities        enable row level security;
alter table public.kudos             enable row level security;
alter table public.comments          enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;
alter table public.notifications     enable row level security;

-- ---- PROFILES ----
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.shares_gang(auth.uid(), id)
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---- GANGS ----
drop policy if exists "gangs_select" on public.gangs;
create policy "gangs_select" on public.gangs
  for select using (
    privacy = 'public'
    or public.is_gang_member(id)
  );

drop policy if exists "gangs_update_admin" on public.gangs;
create policy "gangs_update_admin" on public.gangs
  for update using (public.is_gang_admin(id)) with check (public.is_gang_admin(id));

drop policy if exists "gangs_delete_owner" on public.gangs;
create policy "gangs_delete_owner" on public.gangs
  for delete using (owner_id = auth.uid());
-- INSERT happens via create_gang() RPC (security definer); no direct insert policy.

-- ---- GANG MEMBERS ----
drop policy if exists "gang_members_select" on public.gang_members;
create policy "gang_members_select" on public.gang_members
  for select using (public.is_gang_member(gang_id));

drop policy if exists "gang_members_leave" on public.gang_members;
create policy "gang_members_leave" on public.gang_members
  for delete using (user_id = auth.uid() or public.is_gang_admin(gang_id));

drop policy if exists "gang_members_admin_update" on public.gang_members;
create policy "gang_members_admin_update" on public.gang_members
  for update using (public.is_gang_admin(gang_id)) with check (public.is_gang_admin(gang_id));
-- INSERT happens via join_gang() / join_public_gang() / create_gang() RPCs.

-- ---- EXERCISES ----
drop policy if exists "exercises_select" on public.exercises;
create policy "exercises_select" on public.exercises
  for select using (
    gang_id is null
    or public.is_gang_member(gang_id)
  );

drop policy if exists "exercises_insert_admin" on public.exercises;
create policy "exercises_insert_admin" on public.exercises
  for insert with check (gang_id is not null and public.is_gang_admin(gang_id));

drop policy if exists "exercises_delete_admin" on public.exercises;
create policy "exercises_delete_admin" on public.exercises
  for delete using (gang_id is not null and public.is_gang_admin(gang_id));

-- ---- QUESTS ----
drop policy if exists "quests_select" on public.quests;
create policy "quests_select" on public.quests
  for select using (public.is_gang_member(gang_id));

drop policy if exists "quests_insert_admin" on public.quests;
create policy "quests_insert_admin" on public.quests
  for insert with check (public.is_gang_admin(gang_id));

drop policy if exists "quests_update_admin" on public.quests;
create policy "quests_update_admin" on public.quests
  for update using (public.is_gang_admin(gang_id)) with check (public.is_gang_admin(gang_id));

drop policy if exists "quests_delete_admin" on public.quests;
create policy "quests_delete_admin" on public.quests
  for delete using (public.is_gang_admin(gang_id));

-- ---- ACTIVITIES ----
drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities
  for select using (
    user_id = auth.uid()
    or (gang_id is not null and public.is_gang_member(gang_id))
  );

drop policy if exists "activities_insert_self" on public.activities;
create policy "activities_insert_self" on public.activities
  for insert with check (user_id = auth.uid());

drop policy if exists "activities_update_self" on public.activities;
create policy "activities_update_self" on public.activities
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "activities_delete_self" on public.activities;
create policy "activities_delete_self" on public.activities
  for delete using (user_id = auth.uid());

-- ---- KUDOS ----
drop policy if exists "kudos_select" on public.kudos;
create policy "kudos_select" on public.kudos
  for select using (
    exists (
      select 1 from public.activities a
      where a.id = kudos.activity_id
        and (a.user_id = auth.uid() or (a.gang_id is not null and public.is_gang_member(a.gang_id)))
    )
  );

drop policy if exists "kudos_insert_self" on public.kudos;
create policy "kudos_insert_self" on public.kudos
  for insert with check (user_id = auth.uid());

drop policy if exists "kudos_delete_self" on public.kudos;
create policy "kudos_delete_self" on public.kudos
  for delete using (user_id = auth.uid());

-- ---- COMMENTS ----
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
  for select using (
    exists (
      select 1 from public.activities a
      where a.id = comments.activity_id
        and (a.user_id = auth.uid() or (a.gang_id is not null and public.is_gang_member(a.gang_id)))
    )
  );

drop policy if exists "comments_insert_self" on public.comments;
create policy "comments_insert_self" on public.comments
  for insert with check (user_id = auth.uid());

drop policy if exists "comments_delete_self" on public.comments;
create policy "comments_delete_self" on public.comments
  for delete using (user_id = auth.uid());

-- ---- ACHIEVEMENTS (catalog is world-readable) ----
drop policy if exists "achievements_select" on public.achievements;
create policy "achievements_select" on public.achievements
  for select using (true);

-- ---- USER ACHIEVEMENTS ----
drop policy if exists "user_achievements_select" on public.user_achievements;
create policy "user_achievements_select" on public.user_achievements
  for select using (
    user_id = auth.uid()
    or public.shares_gang(auth.uid(), user_id)
  );

drop policy if exists "user_achievements_insert_self" on public.user_achievements;
create policy "user_achievements_insert_self" on public.user_achievements
  for insert with check (user_id = auth.uid());

-- ---- NOTIFICATIONS ----
drop policy if exists "notifications_select_self" on public.notifications;
create policy "notifications_select_self" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- GRANTS (so the views/functions are callable by the anon/authenticated roles)
-- ============================================================================
grant select on public.quest_progress       to anon, authenticated;
grant select on public.quest_user_progress  to anon, authenticated;
grant select on public.activity_engagement  to anon, authenticated;

-- Trigger function: never meant to be called over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- RPCs require an authenticated session; remove the implicit PUBLIC/anon grant.
revoke execute on function public.create_gang(text, text, text, text) from public, anon;
revoke execute on function public.join_gang(text)                     from public, anon;
revoke execute on function public.join_public_gang(uuid)              from public, anon;
grant  execute on function public.create_gang(text, text, text, text) to authenticated;
grant  execute on function public.join_gang(text)                     to authenticated;
grant  execute on function public.join_public_gang(uuid)              to authenticated;

-- Helper predicates are used inside RLS policies (run as the querying role);
-- authenticated needs EXECUTE, but anon/PUBLIC do not.
revoke execute on function public.is_gang_member(uuid, uuid) from public, anon;
revoke execute on function public.is_gang_admin(uuid, uuid)  from public, anon;
revoke execute on function public.shares_gang(uuid, uuid)    from public, anon;
grant  execute on function public.is_gang_member(uuid, uuid) to authenticated;
grant  execute on function public.is_gang_admin(uuid, uuid)  to authenticated;
grant  execute on function public.shares_gang(uuid, uuid)    to authenticated;
