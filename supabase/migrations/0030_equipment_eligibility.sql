-- Revert log-time substitutes; add equipment eligibility for planned exercises.
-- Unequipped members still see equipment exercises (optional); gang targets use
-- eligible member counts only.

-- ----------------------------------------------------------------------------
-- 1. Drop substitute flag
-- ----------------------------------------------------------------------------
alter table public.exercises
  drop column if exists allows_substitutes;

-- ----------------------------------------------------------------------------
-- 2. Profile equipment opt-in
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists has_pull_up_bar boolean not null default false;

alter table public.profiles
  add column if not exists has_weights boolean not null default false;

comment on column public.profiles.has_pull_up_bar is
  'Member opted in that they have access to a pull-up bar.';
comment on column public.profiles.has_weights is
  'Member opted in that they have access to weights.';

-- ----------------------------------------------------------------------------
-- 3. Catalog equipment requirement
-- ----------------------------------------------------------------------------
alter table public.exercises
  add column if not exists required_equipment text
    check (required_equipment is null or required_equipment in ('pull_up_bar', 'weights'));

comment on column public.exercises.required_equipment is
  'When set, only members with matching profile equipment are required / counted in gang_target.';

update public.exercises
set
  required_equipment = 'pull_up_bar',
  description = coalesce(
    description,
    'Overhand pull-ups. Requires a pull-up bar — optional for members without one.'
  )
where gang_id is null
  and name = 'Pull-ups';

update public.exercises
set
  required_equipment = null,
  description = coalesce(
    description,
    'Bodyweight rows under a bar or sturdy table.'
  )
where gang_id is null
  and name = 'Inverted Rows';

-- Ensure seeds exist (from 0029) even if that migration was skipped locally.
insert into public.exercises (name, category, unit, description, gang_id, active, required_equipment)
select v.name, v.category, v.unit, v.description, null, v.active, v.required_equipment
from (values
  (
    'Pull-ups',
    'back',
    'reps',
    'Overhand pull-ups. Requires a pull-up bar — optional for members without one.',
    false,
    'pull_up_bar'
  ),
  (
    'Inverted Rows',
    'back',
    'reps',
    'Bodyweight rows under a bar or sturdy table.',
    false,
    null
  )
) as v(name, category, unit, description, active, required_equipment)
where not exists (
  select 1 from public.exercises e
  where e.gang_id is null and e.name = v.name
);

-- ----------------------------------------------------------------------------
-- 4. Eligibility helpers
-- ----------------------------------------------------------------------------
create or replace function public.profile_has_equipment(
  p_has_pull_up_bar boolean,
  p_has_weights boolean,
  p_required_equipment text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_required_equipment is null then true
    when p_required_equipment = 'pull_up_bar' then coalesce(p_has_pull_up_bar, false)
    when p_required_equipment = 'weights' then coalesce(p_has_weights, false)
    else false
  end;
$$;

create or replace function public.exercise_eligible_member_count(
  p_gang_id uuid,
  p_required_equipment text,
  p_on_date date,
  p_timezone text default 'America/New_York'
)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.gang_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.gang_id = p_gang_id
    and (gm.joined_at at time zone p_timezone)::date <= p_on_date
    and public.profile_has_equipment(
      p.has_pull_up_bar,
      p.has_weights,
      p_required_equipment
    );
$$;

revoke execute on function public.exercise_eligible_member_count(uuid, text, date, text)
  from public, anon;
grant execute on function public.exercise_eligible_member_count(uuid, text, date, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Week / day / crate completion — eligibility aware
-- ----------------------------------------------------------------------------
create or replace function public.weekly_plan_gang_completed(
  p_plan_id uuid,
  p_timezone text default 'America/New_York'
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.daily_goal_exercises dge
    join public.daily_goals dg on dg.id = dge.daily_goal_id
    join public.weekly_plans wp on wp.id = dg.weekly_plan_id
    join public.exercises e on e.id = dge.exercise_id
    where dg.weekly_plan_id = p_plan_id
      and public.exercise_eligible_member_count(
        wp.gang_id,
        e.required_equipment,
        dg.goal_date,
        p_timezone
      ) > 0
      and coalesce((
        select sum(ae.amount)
        from public.activity_exercises ae
        where ae.daily_goal_exercise_id = dge.id
      ), 0) < (
        dge.individual_target
        * public.exercise_eligible_member_count(
          wp.gang_id,
          e.required_equipment,
          dg.goal_date,
          p_timezone
        )
      )
  );
$$;

revoke execute on function public.weekly_plan_gang_completed(uuid, text) from public, anon;
grant  execute on function public.weekly_plan_gang_completed(uuid, text) to authenticated;

create or replace function public.user_completed_daily_goals(
  p_user_id uuid,
  p_date    date
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exercise_count integer;
  v_incomplete_count integer;
  v_has_pull_up_bar boolean;
  v_has_weights boolean;
begin
  if p_user_id is null or p_date is null then
    return false;
  end if;

  select p.has_pull_up_bar, p.has_weights
  into v_has_pull_up_bar, v_has_weights
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    return false;
  end if;

  select count(*)
  into v_exercise_count
  from public.daily_goal_exercises dge
  join public.daily_goals dg on dg.id = dge.daily_goal_id
  join public.weekly_plans wp on wp.id = dg.weekly_plan_id
  join public.gang_members gm
    on gm.gang_id = wp.gang_id
   and gm.user_id = p_user_id
  where dg.goal_date = p_date
    and wp.status = 'active';

  if coalesce(v_exercise_count, 0) = 0 then
    return false;
  end if;

  select count(*)
  into v_incomplete_count
  from public.daily_goal_exercises dge
  join public.daily_goals dg on dg.id = dge.daily_goal_id
  join public.weekly_plans wp on wp.id = dg.weekly_plan_id
  join public.gang_members gm
    on gm.gang_id = wp.gang_id
   and gm.user_id = p_user_id
  join public.exercises e on e.id = dge.exercise_id
  left join (
    select
      ae.daily_goal_exercise_id,
      act.user_id,
      coalesce(sum(ae.amount), 0)::numeric as user_total
    from public.activity_exercises ae
    join public.activities act on act.id = ae.activity_id
    where ae.daily_goal_exercise_id is not null
    group by ae.daily_goal_exercise_id, act.user_id
  ) prog
    on prog.daily_goal_exercise_id = dge.id
   and prog.user_id = p_user_id
  where dg.goal_date = p_date
    and wp.status = 'active'
    and dge.individual_target > 0
    and public.profile_has_equipment(
      v_has_pull_up_bar,
      v_has_weights,
      e.required_equipment
    )
    and coalesce(prog.user_total, 0) < dge.individual_target;

  return coalesce(v_incomplete_count, 0) = 0;
end;
$$;

revoke execute on function public.user_completed_daily_goals(uuid, date)
  from public, anon, authenticated;

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
  v_goal_date date;
  v_incomplete integer;
begin
  if p_daily_goal_id is null then
    return;
  end if;

  select wp.gang_id, g.name, dg.goal_date
  into v_gang_id, v_gang_name, v_goal_date
  from public.daily_goals dg
  join public.weekly_plans wp on wp.id = dg.weekly_plan_id
  join public.gangs g on g.id = wp.gang_id
  where dg.id = p_daily_goal_id;

  if v_gang_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.daily_goal_exercises dge where dge.daily_goal_id = p_daily_goal_id
  ) then
    return;
  end if;

  select count(*)::integer
  into v_incomplete
  from public.daily_goal_exercises dge
  join public.exercises e on e.id = dge.exercise_id
  where dge.daily_goal_id = p_daily_goal_id
    and public.exercise_eligible_member_count(
      v_gang_id,
      e.required_equipment,
      v_goal_date,
      'America/New_York'
    ) > 0
    and coalesce((
      select sum(ae.amount)
      from public.activity_exercises ae
      where ae.daily_goal_exercise_id = dge.id
    ), 0) < (
      dge.individual_target
      * public.exercise_eligible_member_count(
        v_gang_id,
        e.required_equipment,
        v_goal_date,
        'America/New_York'
      )
    );

  if coalesce(v_incomplete, 0) > 0 then
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
