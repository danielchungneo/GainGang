-- One-way follows between users, profile/activity visibility for relationships,
-- and in-app notifications when someone follows you.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx
  on public.follows (following_id, created_at desc);

create index if not exists follows_follower_idx
  on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists "follows_select" on public.follows;
create policy "follows_select" on public.follows
  for select using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or public.shares_gang(auth.uid(), follower_id)
    or public.shares_gang(auth.uid(), following_id)
    or public.is_following(auth.uid(), follower_id)
    or public.is_following(auth.uid(), following_id)
    or public.is_following(follower_id, auth.uid())
    or public.is_following(following_id, auth.uid())
  );

drop policy if exists "follows_insert" on public.follows;
create policy "follows_insert" on public.follows
  for insert with check (follower_id = auth.uid());

drop policy if exists "follows_delete" on public.follows;
create policy "follows_delete" on public.follows
  for delete using (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_following(p_follower uuid, p_following uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.follows
    where follower_id = p_follower
      and following_id = p_following
  );
$$;

create or replace function public.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_following(p_user_a, p_user_b)
     and public.is_following(p_user_b, p_user_a);
$$;

revoke all on function public.is_following(uuid, uuid) from public, anon;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.is_following(uuid, uuid) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Expand profile + activity visibility for follows
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid()
    or public.shares_gang(auth.uid(), id)
    or public.is_following(auth.uid(), id)
    or public.is_following(id, auth.uid())
  );

drop policy if exists "activities_select" on public.activities;
create policy "activities_select" on public.activities
  for select using (
    user_id = auth.uid()
    or (gang_id is not null and public.is_gang_member(gang_id))
    or public.is_following(auth.uid(), user_id)
  );

-- ---------------------------------------------------------------------------
-- Follow notifications
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'kudos',
    'comment',
    'mention',
    'quest',
    'achievement',
    'rank_up',
    'gang',
    'poke',
    'daily_goal',
    'follow'
  ));

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  v_actor_name := coalesce(
    nullif(trim(public.profile_display_name(new.follower_id)), ''),
    'Someone'
  );

  insert into public.notifications (user_id, type, actor_id, body)
  values (
    new.following_id,
    'follow',
    new.follower_id,
    v_actor_name || ' started following you'
  );

  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row
  execute function public.notify_on_follow();
