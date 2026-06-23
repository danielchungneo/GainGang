-- ============================================================================
-- GainGang — Activity units: miles (decimals) vs reps/seconds (whole numbers)
-- Replaces meters with miles; amounts and targets support one decimal place.
-- ============================================================================

-- Drop old unit constraints before migrating values
alter table public.exercises drop constraint if exists exercises_unit_check;
alter table public.activities drop constraint if exists activities_unit_check;
alter table public.quests drop constraint if exists quests_unit_check;
alter table public.daily_goal_exercises drop constraint if exists daily_goal_exercises_unit_check;

-- Migrate existing meter-based rows
update public.exercises set unit = 'miles' where unit = 'meters';
update public.activities set unit = 'miles' where unit = 'meters';
update public.quests set unit = 'miles' where unit = 'meters';

-- ----------------------------------------------------------------------------
-- Progress views (numeric sums) — drop first so amount columns can be altered
-- ----------------------------------------------------------------------------
drop view if exists public.daily_goal_exercise_user_progress;
drop view if exists public.daily_goal_exercise_progress;
drop view if exists public.quest_user_progress;
drop view if exists public.quest_progress;

-- ----------------------------------------------------------------------------
-- Widen numeric columns
-- ----------------------------------------------------------------------------
alter table public.activities
  alter column amount type numeric(10, 1) using amount::numeric(10, 1);

alter table public.daily_goal_exercises
  alter column individual_target type numeric(10, 1) using individual_target::numeric(10, 1);

alter table public.quests
  alter column gang_target type numeric(10, 1) using gang_target::numeric(10, 1),
  alter column individual_target type numeric(10, 1) using individual_target::numeric(10, 1);

-- ----------------------------------------------------------------------------
-- Unit constraints: reps | seconds | miles
-- ----------------------------------------------------------------------------
alter table public.exercises
  add constraint exercises_unit_check
  check (unit in ('reps', 'seconds', 'miles'));

alter table public.activities
  add constraint activities_unit_check
  check (unit in ('reps', 'seconds', 'miles'));

alter table public.quests
  add constraint quests_unit_check
  check (unit in ('reps', 'seconds', 'miles'));

alter table public.daily_goal_exercises
  add constraint daily_goal_exercises_unit_check
  check (unit in ('reps', 'seconds', 'miles'));

-- Reps and seconds must be whole numbers; miles may have tenths
alter table public.activities drop constraint if exists activities_amount_whole_for_count_units;
alter table public.activities
  add constraint activities_amount_whole_for_count_units
  check (unit = 'miles' or amount = trunc(amount));

alter table public.daily_goal_exercises drop constraint if exists daily_goal_exercises_target_whole_for_count_units;
alter table public.daily_goal_exercises
  add constraint daily_goal_exercises_target_whole_for_count_units
  check (unit = 'miles' or individual_target = trunc(individual_target));

-- ----------------------------------------------------------------------------
-- Progress views (numeric sums)
-- ----------------------------------------------------------------------------
create or replace view public.quest_progress
with (security_invoker = true) as
select
  q.id                                   as quest_id,
  q.gang_id,
  coalesce(sum(a.amount), 0)::numeric    as gang_total,
  count(distinct a.user_id)::int         as contributor_count
from public.quests q
left join public.activities a on a.quest_id = q.id
group by q.id, q.gang_id;

create or replace view public.quest_user_progress
with (security_invoker = true) as
select
  a.quest_id,
  a.user_id,
  coalesce(sum(a.amount), 0)::numeric as user_total
from public.activities a
where a.quest_id is not null
group by a.quest_id, a.user_id;

create or replace view public.daily_goal_exercise_progress
with (security_invoker = true) as
select
  dge.id                                   as daily_goal_exercise_id,
  dge.daily_goal_id,
  wp.gang_id,
  coalesce(sum(a.amount), 0)::numeric        as gang_total,
  count(distinct a.user_id)::int           as contributor_count
from public.daily_goal_exercises dge
join public.daily_goals dg on dg.id = dge.daily_goal_id
join public.weekly_plans wp on wp.id = dg.weekly_plan_id
left join public.activities a on a.daily_goal_exercise_id = dge.id
group by dge.id, dge.daily_goal_id, wp.gang_id;

create or replace view public.daily_goal_exercise_user_progress
with (security_invoker = true) as
select
  a.daily_goal_exercise_id,
  a.user_id,
  coalesce(sum(a.amount), 0)::numeric as user_total
from public.activities a
where a.daily_goal_exercise_id is not null
group by a.daily_goal_exercise_id, a.user_id;

-- ----------------------------------------------------------------------------
-- RPC: numeric individual targets
-- ----------------------------------------------------------------------------
create or replace function public.create_weekly_plan(
  p_gang_id   uuid,
  p_starts_on date,
  p_days      jsonb
)
returns public.weekly_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan   public.weekly_plans;
  v_day    jsonb;
  v_ex     jsonb;
  v_goal   public.daily_goals;
  v_sort   smallint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_gang_admin(p_gang_id) then
    raise exception 'Only gang admins can create weekly plans';
  end if;

  update public.weekly_plans
  set status = 'completed'
  where gang_id = p_gang_id and status = 'active';

  insert into public.weekly_plans (gang_id, starts_on, ends_on)
  values (p_gang_id, p_starts_on, p_starts_on + 6)
  returning * into v_plan;

  for v_day in select * from jsonb_array_elements(p_days)
  loop
    insert into public.daily_goals (
      weekly_plan_id, day_of_week, title, day_category, goal_date
    )
    values (
      v_plan.id,
      (v_day->>'day_of_week')::smallint,
      coalesce(v_day->>'title', ''),
      nullif(v_day->>'day_category', '')::text,
      p_starts_on + ((v_day->>'day_of_week')::int - 1)
    )
    returning * into v_goal;

    v_sort := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      insert into public.daily_goal_exercises (
        daily_goal_id,
        exercise_id,
        unit,
        individual_target,
        sort_order
      )
      select
        v_goal.id,
        (v_ex->>'exercise_id')::uuid,
        e.unit,
        (v_ex->>'individual_target')::numeric(10, 1),
        v_sort
      from public.exercises e
      where e.id = (v_ex->>'exercise_id')::uuid;

      v_sort := v_sort + 1;
    end loop;
  end loop;

  return v_plan;
end;
$$;

grant select on public.daily_goal_exercise_progress      to anon, authenticated;
grant select on public.daily_goal_exercise_user_progress to anon, authenticated;
