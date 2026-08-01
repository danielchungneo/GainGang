-- Correct databases that previously replaced Run/Walk plan slots with
-- Jumping Jacks. Keep Jumping Jacks active in the exercise catalog, but do
-- not add it automatically to existing plans.

delete from public.daily_goal_exercises dge
using public.exercises e
where e.id = dge.exercise_id
  and e.gang_id is null
  and e.name in ('Run', 'Walk', 'Jumping Jacks');
