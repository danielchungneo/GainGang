-- Prevent duplicate activity logs per user per daily goal exercise.
create unique index if not exists activities_one_per_user_daily_goal_exercise
  on public.activities (user_id, daily_goal_exercise_id)
  where daily_goal_exercise_id is not null;
