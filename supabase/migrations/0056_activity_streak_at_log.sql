-- Snapshot the user's personal streak on the activity at log time.
-- Null for historical rows; UI hides the streak when null.
alter table public.activities
  add column if not exists streak_at_log integer
  check (streak_at_log is null or streak_at_log >= 0);

comment on column public.activities.streak_at_log is
  'Personal streak days as of this activity_date when the activity was first logged. Null for legacy rows.';
