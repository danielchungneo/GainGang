-- ============================================================================
-- Chest category: keep only standard Push-ups
-- ============================================================================

delete from public.exercises
where gang_id is null
  and category = 'chest'
  and name in (
    'Wide Push-ups',
    'Diamond Push-ups',
    'Decline Push-ups'
  );
