-- Alerts: auto-create in-app notifications for social + gang events,
-- plus device push token storage for Expo push delivery.

-- ---------------------------------------------------------------------------
-- Schema: richer notification context + push tokens
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
    'daily_goal'
  ));

alter table public.notifications
  add column if not exists gang_id uuid
    references public.gangs(id) on delete set null;

alter table public.notifications
  add column if not exists daily_goal_id uuid
    references public.daily_goals(id) on delete set null;

create index if not exists notifications_gang_idx
  on public.notifications (gang_id, created_at desc)
  where gang_id is not null;

-- One "daily goal complete" alert per user per day goal.
create unique index if not exists notifications_daily_goal_unique
  on public.notifications (user_id, daily_goal_id)
  where type = 'daily_goal' and daily_goal_id is not null;

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  token       text        not null,
  platform    text        not null default 'unknown'
                check (platform in ('ios', 'android', 'web', 'unknown')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_self" on public.push_tokens;
create policy "push_tokens_select_self" on public.push_tokens
  for select using (user_id = auth.uid());

drop policy if exists "push_tokens_insert_self" on public.push_tokens;
create policy "push_tokens_insert_self" on public.push_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists "push_tokens_update_self" on public.push_tokens;
create policy "push_tokens_update_self" on public.push_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_tokens_delete_self" on public.push_tokens;
create policy "push_tokens_delete_self" on public.push_tokens
  for delete using (user_id = auth.uid());

-- Upsert helper so the client can register / refresh a token in one call.
create or replace function public.register_push_token(
  p_token text,
  p_platform text default 'unknown'
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.push_tokens;
  v_platform text := coalesce(nullif(trim(p_platform), ''), 'unknown');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or length(trim(p_token)) < 8 then
    raise exception 'Invalid push token';
  end if;

  if v_platform not in ('ios', 'android', 'web', 'unknown') then
    v_platform := 'unknown';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values (v_user_id, trim(p_token), v_platform)
  on conflict (user_id, token) do update
    set platform = excluded.platform,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Shared display name helper
-- ---------------------------------------------------------------------------
create or replace function public.profile_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.full_name), ''), 'A teammate')
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.profile_display_name(uuid) from public, anon;
grant execute on function public.profile_display_name(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Kudos → alert
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_kudos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_gang_id uuid;
  v_actor_name text;
begin
  select a.user_id, a.gang_id
  into v_owner_id, v_gang_id
  from public.activities a
  where a.id = new.activity_id;

  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;

  v_actor_name := public.profile_display_name(new.user_id);

  insert into public.notifications (
    user_id,
    type,
    actor_id,
    activity_id,
    gang_id,
    body
  )
  values (
    v_owner_id,
    'kudos',
    new.user_id,
    new.activity_id,
    v_gang_id,
    v_actor_name || ' gave you kudos'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_kudos on public.kudos;
create trigger trg_notify_on_kudos
  after insert on public.kudos
  for each row
  execute function public.notify_on_kudos();

-- ---------------------------------------------------------------------------
-- Comments → alert
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_gang_id uuid;
  v_actor_name text;
  v_snippet text;
begin
  select a.user_id, a.gang_id
  into v_owner_id, v_gang_id
  from public.activities a
  where a.id = new.activity_id;

  if v_owner_id is null or v_owner_id = new.user_id then
    return new;
  end if;

  v_actor_name := public.profile_display_name(new.user_id);
  v_snippet := left(trim(new.body), 80);
  if length(trim(new.body)) > 80 then
    v_snippet := v_snippet || '…';
  end if;

  insert into public.notifications (
    user_id,
    type,
    actor_id,
    activity_id,
    gang_id,
    body
  )
  values (
    v_owner_id,
    'comment',
    new.user_id,
    new.activity_id,
    v_gang_id,
    v_actor_name || ' commented: ' || v_snippet
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment on public.comments;
create trigger trg_notify_on_comment
  after insert on public.comments
  for each row
  execute function public.notify_on_comment();

-- ---------------------------------------------------------------------------
-- Gang daily goal complete → alert every member once
-- Completes when every exercise's gang total reaches individual_target × members.
-- ---------------------------------------------------------------------------
create or replace function public.try_notify_gang_daily_goal_complete(
  p_daily_goal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang_id uuid;
  v_gang_name text;
  v_member_count integer;
  v_incomplete integer;
begin
  if p_daily_goal_id is null then
    return;
  end if;

  select wp.gang_id, g.name
  into v_gang_id, v_gang_name
  from public.daily_goals dg
  join public.weekly_plans wp on wp.id = dg.weekly_plan_id
  join public.gangs g on g.id = wp.gang_id
  where dg.id = p_daily_goal_id;

  if v_gang_id is null then
    return;
  end if;

  select count(*)::integer
  into v_member_count
  from public.gang_members gm
  where gm.gang_id = v_gang_id;

  if coalesce(v_member_count, 0) < 1 then
    return;
  end if;

  select count(*)::integer
  into v_incomplete
  from public.daily_goal_exercises dge
  where dge.daily_goal_id = p_daily_goal_id
    and coalesce((
      select sum(ae.amount)
      from public.activity_exercises ae
      where ae.daily_goal_exercise_id = dge.id
    ), 0) < (dge.individual_target * v_member_count);

  if coalesce(v_incomplete, 0) > 0 then
    return;
  end if;

  -- Only notify if this goal has at least one exercise.
  if not exists (
    select 1 from public.daily_goal_exercises dge where dge.daily_goal_id = p_daily_goal_id
  ) then
    return;
  end if;

  insert into public.notifications (
    user_id,
    type,
    gang_id,
    daily_goal_id,
    body
  )
  select
    gm.user_id,
    'daily_goal',
    v_gang_id,
    p_daily_goal_id,
    coalesce(nullif(trim(v_gang_name), ''), 'Your gang')
      || ' crushed today''s daily goal!'
  from public.gang_members gm
  where gm.gang_id = v_gang_id
  on conflict (user_id, daily_goal_id) where type = 'daily_goal' and daily_goal_id is not null
  do nothing;
end;
$$;

create or replace function public.notify_on_activity_exercise_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_goal_id uuid;
begin
  if new.daily_goal_exercise_id is null then
    return new;
  end if;

  select dge.daily_goal_id
  into v_daily_goal_id
  from public.daily_goal_exercises dge
  where dge.id = new.daily_goal_exercise_id;

  perform public.try_notify_gang_daily_goal_complete(v_daily_goal_id);
  return new;
end;
$$;

drop trigger if exists trg_notify_on_activity_exercise_ins on public.activity_exercises;
create trigger trg_notify_on_activity_exercise_ins
  after insert on public.activity_exercises
  for each row
  execute function public.notify_on_activity_exercise_change();

drop trigger if exists trg_notify_on_activity_exercise_upd on public.activity_exercises;
create trigger trg_notify_on_activity_exercise_upd
  after update of amount, daily_goal_exercise_id on public.activity_exercises
  for each row
  execute function public.notify_on_activity_exercise_change();

-- Keep poke notifications linked to the gang for deep links.
create or replace function public.send_gang_poke(
  p_gang_id uuid,
  p_target_user_id uuid,
  p_daily_goal_exercise_id uuid
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_exercise_name text;
  v_actor_name text;
  v_individual_target numeric;
  v_user_total numeric;
  v_daily_goal_id uuid;
  v_notification public.notifications;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_user_id = v_actor_id then
    raise exception 'You cannot poke yourself';
  end if;

  if not public.is_gang_member(p_gang_id, v_actor_id) then
    raise exception 'You are not a member of this gang';
  end if;

  if not public.is_gang_member(p_gang_id, p_target_user_id) then
    raise exception 'Target is not a member of this gang';
  end if;

  select e.name, dge.individual_target, dge.daily_goal_id
  into v_exercise_name, v_individual_target, v_daily_goal_id
  from public.daily_goal_exercises dge
  join public.exercises e on e.id = dge.exercise_id
  join public.daily_goals dg on dg.id = dge.daily_goal_id
  join public.weekly_plans wp on wp.id = dg.weekly_plan_id
  where dge.id = p_daily_goal_exercise_id
    and wp.gang_id = p_gang_id;

  if v_exercise_name is null then
    raise exception 'Exercise not found for this gang';
  end if;

  select coalesce(sum(ae.amount), 0)
  into v_user_total
  from public.activity_exercises ae
  join public.activities act on act.id = ae.activity_id
  where ae.daily_goal_exercise_id = p_daily_goal_exercise_id
    and act.user_id = p_target_user_id;

  if v_user_total >= v_individual_target then
    raise exception 'Member has already completed this exercise';
  end if;

  if exists (
    select 1
    from public.notifications n
    where n.type = 'poke'
      and n.actor_id = v_actor_id
      and n.user_id = p_target_user_id
      and n.daily_goal_exercise_id = p_daily_goal_exercise_id
      and n.created_at > now() - interval '6 hours'
  ) then
    raise exception 'Already poked this member recently — try again later';
  end if;

  v_actor_name := public.profile_display_name(v_actor_id);

  insert into public.notifications (
    user_id,
    type,
    actor_id,
    body,
    gang_id,
    daily_goal_id,
    daily_goal_exercise_id
  )
  values (
    p_target_user_id,
    'poke',
    v_actor_id,
    v_actor_name || ' poked you to finish ' || v_exercise_name || ' — your gang is counting on you!',
    p_gang_id,
    v_daily_goal_id,
    p_daily_goal_exercise_id
  )
  returning * into v_notification;

  return v_notification;
end;
$$;

revoke all on function public.send_gang_poke(uuid, uuid, uuid) from public, anon;
grant execute on function public.send_gang_poke(uuid, uuid, uuid) to authenticated;

-- Realtime for unread badge / live alert list updates.
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
