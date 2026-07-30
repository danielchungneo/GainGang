-- Opt-in substitutes at log time: members may swap a planned exercise for
-- another active same-category + same-unit catalog exercise. Progress still
-- counts toward the planned daily_goal_exercises slot.

alter table public.exercises
  add column if not exists allows_substitutes boolean not null default false;

comment on column public.exercises.allows_substitutes is
  'When true, members may log a different active same-category/same-unit exercise against this planned slot.';

-- Pull-ups (primary, allows substitutes) + Inverted Rows (alternative).
-- Both start inactive so they can be enabled when ready.
insert into public.exercises (name, category, unit, description, gang_id, active, allows_substitutes)
select v.name, v.category, v.unit, v.description, null, v.active, v.allows_substitutes
from (values
  (
    'Pull-ups',
    'back',
    'reps',
    'Overhand pull-ups. Substitute if you lack a bar or need an easier variation.',
    false,
    true
  ),
  (
    'Inverted Rows',
    'back',
    'reps',
    'Bodyweight rows under a bar or sturdy table — common pull-up substitute.',
    false,
    false
  )
) as v(name, category, unit, description, active, allows_substitutes)
where not exists (
  select 1 from public.exercises e
  where e.gang_id is null and e.name = v.name
);
