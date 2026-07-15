-- ============================================================================
-- Add Lunges (camera reps) and Plank (camera hold / seconds)
-- ============================================================================

insert into public.exercises (name, category, unit, description, gang_id)
select v.name, v.category, v.unit, v.description, null
from (values
  ('Lunges', 'legs', 'reps', 'Alternating forward lunges'),
  ('Plank', 'core', 'seconds', 'Front plank hold')
) as v(name, category, unit, description)
where not exists (
  select 1 from public.exercises e
  where e.gang_id is null and e.name = v.name
);
