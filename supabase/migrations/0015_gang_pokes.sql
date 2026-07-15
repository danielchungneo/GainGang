-- Gang pokes: in-app notifications to nudge members who still need to contribute.

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
    'poke'
  ));

-- Optional exercise context for poke rate-limits / deep links.
alter table public.notifications
  add column if not exists daily_goal_exercise_id uuid
    references public.daily_goal_exercises(id) on delete set null;

create index if not exists notifications_poke_rate_idx
  on public.notifications (actor_id, user_id, daily_goal_exercise_id, created_at desc)
  where type = 'poke';

-- ----------------------------------------------------------------------------
-- send_gang_poke: gang member nudges another member about an exercise.
-- Rate-limited to one poke per actor → target → exercise every 6 hours.
-- ----------------------------------------------------------------------------
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

  select e.name, dge.individual_target
  into v_exercise_name, v_individual_target
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

  select coalesce(nullif(trim(p.full_name), ''), 'A teammate')
  into v_actor_name
  from public.profiles p
  where p.id = v_actor_id;

  insert into public.notifications (
    user_id,
    type,
    actor_id,
    body,
    daily_goal_exercise_id
  )
  values (
    p_target_user_id,
    'poke',
    v_actor_id,
    v_actor_name || ' poked you to finish ' || v_exercise_name || ' — your gang is counting on you!',
    p_daily_goal_exercise_id
  )
  returning * into v_notification;

  return v_notification;
end;
$$;

revoke all on function public.send_gang_poke(uuid, uuid, uuid) from public, anon;
grant execute on function public.send_gang_poke(uuid, uuid, uuid) to authenticated;
