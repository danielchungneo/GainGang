-- Soft-hide Run/Walk; add Jumping Jacks as the cardio catalog exercise.
-- Existing Run/Walk/Jumping Jacks plan slots are removed. Jumping Jacks
-- remains available for owners to add to plans intentionally.
-- Historical activity_exercises miles rows are left intact.

-- Soft-deactivate distance exercises (keep rows for easy restore).
update public.exercises
set active = false
where gang_id is null
  and name in ('Run', 'Walk');

-- Seed Jumping Jacks as bodyweight cardio (manual reps; no camera yet).
insert into public.exercises (name, category, unit, description, gang_id, active)
select 'Jumping Jacks', 'cardio', 'reps', 'Jumping jacks', null, true
where not exists (
  select 1 from public.exercises e
  where e.gang_id is null and e.name = 'Jumping Jacks'
);

-- Remove these exercises from all existing plans. Historical activities remain.
delete from public.daily_goal_exercises dge
using public.exercises e
where e.id = dge.exercise_id
  and e.gang_id is null
  and e.name in ('Run', 'Walk', 'Jumping Jacks');
