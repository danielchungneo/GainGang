-- ============================================================================
-- GainGang — Daily activities: one activity per user per day, many exercises
-- Moves per-exercise data into activity_exercises; activities become the parent
-- row that kudos/comments attach to.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Parent activity columns
-- ----------------------------------------------------------------------------
alter table public.activities
  add column if not exists daily_goal_id uuid references public.daily_goals(id) on delete set null,
  add column if not exists activity_date date,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists activities_daily_goal_idx on public.activities(daily_goal_id);
create index if not exists activities_activity_date_idx on public.activities(activity_date);

-- ----------------------------------------------------------------------------
-- 2. Child exercise rows
-- ----------------------------------------------------------------------------
create table if not exists public.activity_exercises (
  id                     uuid primary key default gen_random_uuid(),
  activity_id            uuid        not null references public.activities(id) on delete cascade,
  exercise_id            uuid        references public.exercises(id) on delete set null,
  exercise_name          text        not null,
  category               text        check (category in ('chest','legs','cardio','back','core')),
  unit                   text        not null default 'reps'
                           check (unit in ('reps','seconds','miles')),
  amount                 numeric(10, 1) not null default 0 check (amount >= 0),
  sets                   integer     check (sets is null or sets > 0),
  notes                  text,
  daily_goal_exercise_id uuid        references public.daily_goal_exercises(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint activity_exercises_amount_whole_for_count_units
    check (unit = 'miles' or amount = trunc(amount))
);

create index if not exists activity_exercises_activity_idx
  on public.activity_exercises(activity_id);
create index if not exists activity_exercises_daily_goal_exercise_idx
  on public.activity_exercises(daily_goal_exercise_id);

create unique index if not exists activity_exercises_one_per_goal_exercise
  on public.activity_exercises (activity_id, daily_goal_exercise_id)
  where daily_goal_exercise_id is not null;

-- ----------------------------------------------------------------------------
-- 3. Backfill parent metadata from existing rows
-- ----------------------------------------------------------------------------
update public.activities a
set
  daily_goal_id = dge.daily_goal_id,
  activity_date = dg.goal_date
from public.daily_goal_exercises dge
join public.daily_goals dg on dg.id = dge.daily_goal_id
where a.daily_goal_exercise_id = dge.id
  and a.daily_goal_id is null;

update public.activities
set activity_date = (created_at at time zone 'UTC')::date
where activity_date is null;

-- ----------------------------------------------------------------------------
-- 4. Consolidate multiple per-exercise activity rows into one parent per day
-- ----------------------------------------------------------------------------
create temp table _activity_parent_map (
  old_id    uuid primary key,
  parent_id uuid not null
) on commit drop;

-- Daily-goal rows: one parent per (user_id, daily_goal_id)
insert into _activity_parent_map (old_id, parent_id)
select
  a.id,
  first_value(a.id) over (
    partition by a.user_id, a.daily_goal_id
    order by a.created_at asc, a.id asc
  )
from public.activities a
where a.daily_goal_id is not null;

-- Quest rows: one parent per (user_id, quest_id)
insert into _activity_parent_map (old_id, parent_id)
select
  a.id,
  first_value(a.id) over (
    partition by a.user_id, a.quest_id
    order by a.created_at asc, a.id asc
  )
from public.activities a
where a.quest_id is not null
  and a.daily_goal_id is null
on conflict (old_id) do nothing;

-- Freeform rows: one parent per (user_id, activity_date, gang_id)
insert into _activity_parent_map (old_id, parent_id)
select
  a.id,
  first_value(a.id) over (
    partition by a.user_id, a.activity_date, coalesce(a.gang_id, '00000000-0000-0000-0000-000000000000'::uuid)
    order by a.created_at asc, a.id asc
  )
from public.activities a
where a.daily_goal_id is null
  and a.quest_id is null
on conflict (old_id) do nothing;

-- Rows not in any group map to themselves
insert into _activity_parent_map (old_id, parent_id)
select a.id, a.id
from public.activities a
where not exists (select 1 from _activity_parent_map m where m.old_id = a.id)
on conflict (old_id) do nothing;

-- Copy exercise data into child table
insert into public.activity_exercises (
  activity_id,
  exercise_id,
  exercise_name,
  category,
  unit,
  amount,
  sets,
  notes,
  daily_goal_exercise_id,
  created_at,
  updated_at
)
select
  m.parent_id,
  a.exercise_id,
  a.exercise_name,
  a.category,
  a.unit,
  a.amount,
  a.sets,
  a.notes,
  a.daily_goal_exercise_id,
  a.created_at,
  a.updated_at
from public.activities a
join _activity_parent_map m on m.old_id = a.id
where a.exercise_name is not null
on conflict do nothing;

-- Repoint kudos to consolidated parent (drop duplicates)
update public.kudos k
set activity_id = m.parent_id
from _activity_parent_map m
where k.activity_id = m.old_id
  and m.old_id <> m.parent_id;

delete from public.kudos k
using public.kudos k2
where k.id > k2.id
  and k.activity_id = k2.activity_id
  and k.user_id = k2.user_id;

-- Repoint comments to consolidated parent
update public.comments c
set activity_id = m.parent_id
from _activity_parent_map m
where c.activity_id = m.old_id
  and m.old_id <> m.parent_id;

-- Update parent rows with consolidated metadata
update public.activities parent
set
  daily_goal_id = coalesce(parent.daily_goal_id, src.daily_goal_id),
  activity_date = coalesce(parent.activity_date, src.activity_date),
  gang_id = coalesce(parent.gang_id, src.gang_id),
  quest_id = coalesce(parent.quest_id, src.quest_id),
  notes = coalesce(parent.notes, src.notes),
  photo_url = coalesce(parent.photo_url, src.photo_url),
  updated_at = greatest(parent.updated_at, src.updated_at)
from _activity_parent_map m
join public.activities src on src.id = m.old_id
where parent.id = m.parent_id
  and m.old_id <> m.parent_id;

-- Remove duplicate parent rows
delete from public.activities a
using _activity_parent_map m
where a.id = m.old_id
  and m.old_id <> m.parent_id;

-- ----------------------------------------------------------------------------
-- 5. Drop per-exercise columns from activities (now on activity_exercises)
-- ----------------------------------------------------------------------------
drop view if exists public.daily_goal_exercise_user_progress;
drop view if exists public.daily_goal_exercise_progress;
drop view if exists public.quest_user_progress;
drop view if exists public.quest_progress;

drop index if exists public.activities_one_per_user_daily_goal_exercise;

alter table public.activities
  drop constraint if exists activities_unit_check,
  drop constraint if exists activities_amount_whole_for_count_units;

alter table public.activities
  drop column if exists daily_goal_exercise_id,
  drop column if exists exercise_id,
  drop column if exists exercise_name,
  drop column if exists category,
  drop column if exists unit,
  drop column if exists amount,
  drop column if exists sets;

-- One daily activity per user per daily goal
create unique index if not exists activities_one_per_user_daily_goal
  on public.activities (user_id, daily_goal_id)
  where daily_goal_id is not null;

-- One activity per user per legacy quest
create unique index if not exists activities_one_per_user_quest
  on public.activities (user_id, quest_id)
  where quest_id is not null;

-- One freeform activity per user per date per gang
create unique index if not exists activities_one_per_user_date_gang
  on public.activities (user_id, activity_date, gang_id)
  where daily_goal_id is null and quest_id is null and gang_id is not null;

-- Solo freeform (no gang): one per user per date
create unique index if not exists activities_one_per_user_date_solo
  on public.activities (user_id, activity_date)
  where daily_goal_id is null and quest_id is null and gang_id is null;

-- ----------------------------------------------------------------------------
-- 6. Progress views — sum from activity_exercises
-- ----------------------------------------------------------------------------
create or replace view public.quest_progress
with (security_invoker = true) as
select
  q.id                                   as quest_id,
  q.gang_id,
  coalesce(sum(ae.amount), 0)::numeric   as gang_total,
  count(distinct act.user_id)::int       as contributor_count
from public.quests q
left join public.activities act on act.quest_id = q.id
left join public.activity_exercises ae on ae.activity_id = act.id
group by q.id, q.gang_id;

create or replace view public.quest_user_progress
with (security_invoker = true) as
select
  act.quest_id,
  act.user_id,
  coalesce(sum(ae.amount), 0)::numeric as user_total
from public.activities act
join public.activity_exercises ae on ae.activity_id = act.id
where act.quest_id is not null
group by act.quest_id, act.user_id;

create or replace view public.daily_goal_exercise_progress
with (security_invoker = true) as
select
  dge.id                                   as daily_goal_exercise_id,
  dge.daily_goal_id,
  wp.gang_id,
  coalesce(sum(ae.amount), 0)::numeric     as gang_total,
  count(distinct act.user_id)::int         as contributor_count
from public.daily_goal_exercises dge
join public.daily_goals dg on dg.id = dge.daily_goal_id
join public.weekly_plans wp on wp.id = dg.weekly_plan_id
left join public.activity_exercises ae on ae.daily_goal_exercise_id = dge.id
left join public.activities act on act.id = ae.activity_id
group by dge.id, dge.daily_goal_id, wp.gang_id;

create or replace view public.daily_goal_exercise_user_progress
with (security_invoker = true) as
select
  ae.daily_goal_exercise_id,
  act.user_id,
  coalesce(sum(ae.amount), 0)::numeric as user_total
from public.activity_exercises ae
join public.activities act on act.id = ae.activity_id
where ae.daily_goal_exercise_id is not null
group by ae.daily_goal_exercise_id, act.user_id;

grant select on public.daily_goal_exercise_progress      to anon, authenticated;
grant select on public.daily_goal_exercise_user_progress to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. RLS for activity_exercises
-- ----------------------------------------------------------------------------
alter table public.activity_exercises enable row level security;

drop policy if exists "activity_exercises_select" on public.activity_exercises;
create policy "activity_exercises_select" on public.activity_exercises
  for select using (
    exists (
      select 1 from public.activities a
      where a.id = activity_exercises.activity_id
        and (
          a.user_id = auth.uid()
          or (a.gang_id is not null and public.is_gang_member(a.gang_id))
        )
    )
  );

drop policy if exists "activity_exercises_insert_self" on public.activity_exercises;
create policy "activity_exercises_insert_self" on public.activity_exercises
  for insert with check (
    exists (
      select 1 from public.activities a
      where a.id = activity_exercises.activity_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "activity_exercises_update_self" on public.activity_exercises;
create policy "activity_exercises_update_self" on public.activity_exercises
  for update using (
    exists (
      select 1 from public.activities a
      where a.id = activity_exercises.activity_id
        and a.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.activities a
      where a.id = activity_exercises.activity_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "activity_exercises_delete_self" on public.activity_exercises;
create policy "activity_exercises_delete_self" on public.activity_exercises
  for delete using (
    exists (
      select 1 from public.activities a
      where a.id = activity_exercises.activity_id
        and a.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.activity_exercises to authenticated;
