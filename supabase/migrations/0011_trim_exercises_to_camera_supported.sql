-- ============================================================================
-- Trim global exercise catalog to camera-supported exercises
-- (+ Run/Walk cardio). Removes dips, non-squat legs, all back,
-- and non sit-up/crunch core so we can rebuild one at a time.
-- ============================================================================

delete from public.exercises
where gang_id is null
  and name not in (
    'Push-ups',
    'Wide Push-ups',
    'Diamond Push-ups',
    'Decline Push-ups',
    'Bodyweight Squats',
    'Run',
    'Walk',
    'Sit-ups',
    'Crunches'
  );
