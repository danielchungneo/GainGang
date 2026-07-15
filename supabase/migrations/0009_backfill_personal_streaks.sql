-- Backfill personal streaks from activity_date history.
-- Current streak counts consecutive days ending "today", or yesterday if today
-- has no activity yet (streak stays alive through the current day).
-- activity_date is written in the device's local calendar; use America/New_York
-- as the server-side "today" for this backfill (matches primary users).

with params as (
  select (timezone('America/New_York', now()))::date as today
),
distinct_days as (
  select distinct user_id, activity_date
  from public.activities
  where activity_date is not null
),
ordered as (
  select
    user_id,
    activity_date,
    activity_date - (row_number() over (
      partition by user_id
      order by activity_date
    ))::integer as streak_group
  from distinct_days
),
runs as (
  select
    user_id,
    min(activity_date) as start_date,
    max(activity_date) as end_date,
    count(*)::integer as run_length
  from ordered
  group by user_id, streak_group
),
longest as (
  select user_id, max(run_length)::integer as longest_streak
  from runs
  group by user_id
),
last_active as (
  select user_id, max(activity_date) as last_active_on
  from distinct_days
  group by user_id
),
current_runs as (
  select
    r.user_id,
    r.run_length as current_streak
  from runs r
  join last_active la on la.user_id = r.user_id
  cross join params p
  where r.end_date = la.last_active_on
    and la.last_active_on >= (p.today - 1)
)
update public.profiles p
set
  current_streak = coalesce(c.current_streak, 0),
  longest_streak = greatest(p.longest_streak, coalesce(l.longest_streak, 0)),
  last_active_on = la.last_active_on,
  updated_at = now()
from last_active la
left join longest l on l.user_id = la.user_id
left join current_runs c on c.user_id = la.user_id
where p.id = la.user_id;
