-- ============================================================================
-- GainGang — Seed data
-- Global default exercises (gang_id = null) for the 5-day weekly schedule,
-- plus the starter achievement catalog. Idempotent via ON CONFLICT / NOT EXISTS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DEFAULT EXERCISES  (weekly schedule: Chest / Legs / Cardio / Back / Core)
-- ----------------------------------------------------------------------------
insert into public.exercises (name, category, unit, description, gang_id)
select v.name, v.category, v.unit, v.description, null
from (values
  -- Day 1 — Chest
  ('Push-ups',            'chest',  'reps',    'Standard push-ups'),
  -- Day 2 — Legs
  ('Bodyweight Squats',   'legs',   'reps',    'Standard air squats'),
  ('Lunges',              'legs',   'reps',    'Alternating forward lunges'),
  -- Day 3 — Cardio (manual distance; no camera yet)
  ('Run',                 'cardio', 'miles',   'Distance run'),
  ('Walk',                'cardio', 'miles',   'Distance walked'),
  -- Day 4 — Back (none yet — add as camera logic ships)
  -- Day 5 — Core
  ('Sit-ups',             'core',   'reps',    'Full sit-ups'),
  ('Crunches',            'core',   'reps',    'Abdominal crunches'),
  ('Plank',               'core',   'seconds', 'Front plank hold')
) as v(name, category, unit, description)
where not exists (
  select 1 from public.exercises e
  where e.gang_id is null and e.name = v.name
);

-- ----------------------------------------------------------------------------
-- ACHIEVEMENTS  (catalog)
-- ----------------------------------------------------------------------------
insert into public.achievements (key, title, description, icon, category, threshold, is_secret)
values
  ('first_quest',     'First Blood',        'Complete your first Quest',                 'flag',     'quest',   1,      false),
  ('quests_10',       'Tenacious',          'Complete 10 Quests',                        'flag',     'quest',   10,     false),
  ('quests_50',       'Relentless',         'Complete 50 Quests',                        'flag',     'quest',   50,     false),
  ('quests_100',      'Unstoppable',        'Complete 100 Quests',                       'flag',     'quest',   100,    false),
  ('streak_7',        'Week Warrior',       'Reach a 7-day streak',                      'flame',    'streak',  7,      false),
  ('streak_30',       'Iron Will',          'Reach a 30-day streak',                     'flame',    'streak',  30,     false),
  ('streak_100',      'Monarch',            'Reach a 100-day streak',                    'flame',    'streak',  100,    false),
  ('reps_1k',         'Grinder',            'Log 1,000 total reps',                      'dumbbell', 'reps',    1000,   false),
  ('reps_10k',        'Machine',            'Log 10,000 total reps',                     'dumbbell', 'reps',    10000,  false),
  ('reps_100k',       'Legend',             'Log 100,000 total reps',                    'dumbbell', 'reps',    100000, false),
  ('first_kudos',     'Hype Man',           'Give your first kudos',                     'heart',    'social',  1,      false),
  ('kudos_100',       'Cheerleader',        'Give 100 kudos',                            'heart',    'social',  100,    false),
  ('first_comment',   'Conversationalist',  'Leave your first comment',                  'message',  'social',  1,      false),
  ('rank_s',          'Sovereign',          'Reach S-Rank',                              'crown',    'rare',    null,   true),
  ('solo_clear',      'Solo Leveling',      'Single-handedly clear a Gang Quest',        'sword',    'rare',    null,   true)
on conflict (key) do nothing;
