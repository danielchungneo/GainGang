-- ============================================================================
-- GainGang — Weekly plans with per-day multi-exercise goals
-- Replaces the daily/weekly quest model with a structured weekly plan.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- WEEKLY PLANS  (one active plan per gang at a time)
-- ----------------------------------------------------------------------------
create table if not exists public.weekly_plans (
  id          uuid primary key default gen_random_uuid(),
  gang_id     uuid        not null references public.gangs(id) on delete cascade,
  starts_on   date        not null,
  ends_on     date        not null,
  status      text        not null default 'active'
                check (status in ('active','completed','failed')),
  created_at  timestamptz not null default now()
);

create index if not exists weekly_plans_gang_idx on public.weekly_plans(gang_id);
create index if not exists weekly_plans_active_idx on public.weekly_plans(gang_id, status, starts_on);

create unique index if not exists weekly_plans_one_active_per_gang
  on public.weekly_plans(gang_id)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- DAILY GOALS  (one row per day within a weekly plan)
-- day_of_week: 1 = Monday … 7 = Sunday (ISO)
-- ----------------------------------------------------------------------------
create table if not exists public.daily_goals (
  id              uuid primary key default gen_random_uuid(),
  weekly_plan_id  uuid        not null references public.weekly_plans(id) on delete cascade,
  day_of_week     smallint    not null check (day_of_week between 1 and 7),
  title           text        not null default '',
  day_category    text        check (day_category in ('chest','legs','cardio','back','core')),
  goal_date       date        not null,
  unique (weekly_plan_id, day_of_week)
);

create index if not exists daily_goals_plan_idx on public.daily_goals(weekly_plan_id);
create index if not exists daily_goals_date_idx on public.daily_goals(goal_date);

-- ----------------------------------------------------------------------------
-- DAILY GOAL EXERCISES  (per-exercise targets within a daily goal)
-- gang_target is derived at query time: individual_target × member_count
-- ----------------------------------------------------------------------------
create table if not exists public.daily_goal_exercises (
  id                  uuid primary key default gen_random_uuid(),
  daily_goal_id       uuid        not null references public.daily_goals(id) on delete cascade,
  exercise_id         uuid        not null references public.exercises(id) on delete restrict,
  unit                text        not null default 'reps'
                        check (unit in ('reps','seconds','meters')),
  individual_target   integer     not null default 0 check (individual_target > 0),
  sort_order          smallint    not null default 0,
  unique (daily_goal_id, exercise_id)
);

create index if not exists daily_goal_exercises_goal_idx on public.daily_goal_exercises(daily_goal_id);

-- ----------------------------------------------------------------------------
-- ACTIVITIES: link to daily goal exercises
-- ----------------------------------------------------------------------------
alter table public.activities
  add column if not exists daily_goal_exercise_id uuid
    references public.daily_goal_exercises(id) on delete set null;

create index if not exists activities_daily_goal_exercise_idx
  on public.activities(daily_goal_exercise_id);

-- ----------------------------------------------------------------------------
-- VIEWS: progress aggregation
-- ----------------------------------------------------------------------------
create or replace view public.daily_goal_exercise_progress
with (security_invoker = true) as
select
  dge.id                                   as daily_goal_exercise_id,
  dge.daily_goal_id,
  wp.gang_id,
  coalesce(sum(a.amount), 0)::bigint       as gang_total,
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
  coalesce(sum(a.amount), 0)::bigint as user_total
from public.activities a
where a.daily_goal_exercise_id is not null
group by a.daily_goal_exercise_id, a.user_id;

-- ----------------------------------------------------------------------------
-- RPC: create a weekly plan with daily goals and exercises (atomic)
-- p_days jsonb: [{ day_of_week, title, day_category, exercises: [{ exercise_id, individual_target }] }]
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

  -- Retire any existing active plan for this gang
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
        (v_ex->>'individual_target')::integer,
        v_sort
      from public.exercises e
      where e.id = (v_ex->>'exercise_id')::uuid;

      v_sort := v_sort + 1;
    end loop;
  end loop;

  return v_plan;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.weekly_plans       enable row level security;
alter table public.daily_goals        enable row level security;
alter table public.daily_goal_exercises enable row level security;

drop policy if exists "weekly_plans_select" on public.weekly_plans;
create policy "weekly_plans_select" on public.weekly_plans
  for select using (public.is_gang_member(gang_id));

drop policy if exists "weekly_plans_insert_admin" on public.weekly_plans;
create policy "weekly_plans_insert_admin" on public.weekly_plans
  for insert with check (public.is_gang_admin(gang_id));

drop policy if exists "weekly_plans_update_admin" on public.weekly_plans;
create policy "weekly_plans_update_admin" on public.weekly_plans
  for update using (public.is_gang_admin(gang_id)) with check (public.is_gang_admin(gang_id));

drop policy if exists "weekly_plans_delete_admin" on public.weekly_plans;
create policy "weekly_plans_delete_admin" on public.weekly_plans
  for delete using (public.is_gang_admin(gang_id));

drop policy if exists "daily_goals_select" on public.daily_goals;
create policy "daily_goals_select" on public.daily_goals
  for select using (
    exists (
      select 1 from public.weekly_plans wp
      where wp.id = daily_goals.weekly_plan_id
        and public.is_gang_member(wp.gang_id)
    )
  );

drop policy if exists "daily_goal_exercises_select" on public.daily_goal_exercises;
create policy "daily_goal_exercises_select" on public.daily_goal_exercises
  for select using (
    exists (
      select 1
      from public.daily_goals dg
      join public.weekly_plans wp on wp.id = dg.weekly_plan_id
      where dg.id = daily_goal_exercises.daily_goal_id
        and public.is_gang_member(wp.gang_id)
    )
  );

-- ----------------------------------------------------------------------------
-- GRANTS
-- ----------------------------------------------------------------------------
grant select on public.daily_goal_exercise_progress      to anon, authenticated;
grant select on public.daily_goal_exercise_user_progress to anon, authenticated;

revoke execute on function public.create_weekly_plan(uuid, date, jsonb) from public, anon;
grant  execute on function public.create_weekly_plan(uuid, date, jsonb) to authenticated;
