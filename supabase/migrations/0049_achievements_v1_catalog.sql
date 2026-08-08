-- Achievement catalog v1: metal tiers + refreshed milestones.
-- Applied to staging first; promote to production when ready.

-- Expand category check to include modern 'goal' (keep legacy 'quest' allowed).
alter table public.achievements
  drop constraint if exists achievements_category_check;

alter table public.achievements
  add constraint achievements_category_check
  check (category in ('goal','quest','streak','reps','social','gang','rare','general'));

alter table public.achievements
  add column if not exists tier text;

update public.achievements
set tier = 'bronze'
where tier is null;

alter table public.achievements
  alter column tier set default 'bronze';

alter table public.achievements
  alter column tier set not null;

alter table public.achievements
  drop constraint if exists achievements_tier_check;

alter table public.achievements
  add constraint achievements_tier_check
  check (tier in ('bronze','silver','gold','platinum','legendary'));

-- Replace catalog. Clears earned rows for removed keys via cascade / explicit wipe.
delete from public.user_achievements;
delete from public.achievements;

insert into public.achievements (key, title, description, icon, category, threshold, is_secret, tier)
values
  -- Goals
  ('first_goal',        'First Step',         'Complete your first daily goal',                                              'flag',     'goal',  1,      false, 'bronze'),
  ('goals_10',          'Tenacious',          'Complete 10 daily goals',                                                     'flag',     'goal',  10,     false, 'silver'),
  ('goals_50',          'Relentless',         'Complete 50 daily goals',                                                     'flag',     'goal',  50,     false, 'gold'),
  ('goals_100',         'Unstoppable',        'Complete 100 daily goals',                                                    'flag',     'goal',  100,    false, 'platinum'),
  ('day_clear_1',       'Lights Out',         'Clear every exercise in a day',                                               'sunny',    'goal',  1,      false, 'bronze'),
  ('day_clear_30',      'Perfect Month',      'Clear every exercise in a day 30 times',                                      'sunny',    'goal',  30,     false, 'legendary'),

  -- Streaks
  ('streak_3',          'Spark',              'Reach a 3-day streak',                                                        'flame',    'streak', 3,     false, 'bronze'),
  ('streak_7',          'Week Warrior',       'Reach a 7-day streak',                                                        'flame',    'streak', 7,     false, 'silver'),
  ('streak_30',         'Iron Will',          'Reach a 30-day streak',                                                       'flame',    'streak', 30,    false, 'gold'),
  ('streak_100',        'Century',            'Reach a 100-day streak',                                                      'flame',    'streak', 100,   false, 'legendary'),

  -- Volume
  ('reps_100',          'Grinder',            'Log 100 total reps',                                                          'dumbbell', 'reps',  100,    false, 'bronze'),
  ('reps_500',          'Machine',            'Log 500 total reps',                                                          'dumbbell', 'reps',  500,    false, 'silver'),
  ('reps_1k',           'Beast',              'Log 1,000 total reps',                                                        'dumbbell', 'reps',  1000,   false, 'gold'),
  ('reps_2k',           'Workhorse',          'Log 2,000 total reps',                                                        'dumbbell', 'reps',  2000,   false, 'platinum'),
  ('reps_5k',           'Legend',             'Log 5,000 total reps',                                                        'dumbbell', 'reps',  5000,   false, 'legendary'),

  -- Social
  ('first_kudos',       'Hype Man',           'Give your first kudos',                                                       'heart',    'social', 1,     false, 'bronze'),
  ('kudos_50',          'Cheerleader',        'Give 50 kudos',                                                               'heart',    'social', 50,    false, 'silver'),
  ('kudos_250',         'Hype Machine',       'Give 250 kudos',                                                              'heart',    'social', 250,   false, 'gold'),
  ('first_comment',     'Conversationalist',  'Leave your first comment',                                                    'message',  'social', 1,     false, 'bronze'),
  ('first_follow',      'Linked Up',          'Follow someone',                                                              'person-add','social', 1,     false, 'bronze'),
  ('first_poke',        'Nudge',              'Poke a gang mate',                                                            'poke',     'social', 1,     false, 'bronze'),

  -- Gang
  ('join_gang',         'Ganged Up',          'Join or create a Gang',                                                       'people',   'gang',  1,      false, 'bronze'),
  ('gang_goal_assist',  'Team Player',        'Contribute to a gang daily goal',                                             'pulse',    'gang',  1,      false, 'bronze'),
  ('solo_day_clear',    'One Man Army',       'Single-handedly finish a gang day''s collective targets while the Gang has at least 5 members', 'sword', 'gang', null, true, 'legendary'),

  -- Progression / rare
  ('challenge_first',   'Contender',          'Submit a weekly challenge attempt',                                           'trophy',   'rare',  1,      false, 'bronze');
