-- Unique icons per achievement (series may share a glyph).
-- Series: goals→flag, day_clear→sunny, streak→flame, reps→dumbbell, kudos→heart.
-- Standalone: comment, follow, poke, join, assist, solo, challenge each unique.

update public.achievements set icon = 'flag' where key in ('first_goal', 'goals_10', 'goals_50', 'goals_100');
update public.achievements set icon = 'sunny' where key in ('day_clear_1', 'day_clear_30');
update public.achievements set icon = 'flame' where key in ('streak_3', 'streak_7', 'streak_30', 'streak_100');
update public.achievements set icon = 'dumbbell' where key in ('reps_100', 'reps_500', 'reps_1k', 'reps_2k', 'reps_5k');
update public.achievements set icon = 'heart' where key in ('first_kudos', 'kudos_50', 'kudos_250');
update public.achievements set icon = 'message' where key = 'first_comment';
update public.achievements set icon = 'person-add' where key = 'first_follow';
update public.achievements set icon = 'poke' where key = 'first_poke';
update public.achievements set icon = 'people' where key = 'join_gang';
update public.achievements set icon = 'pulse' where key = 'gang_goal_assist';
update public.achievements set icon = 'sword' where key = 'solo_day_clear';
update public.achievements set icon = 'trophy' where key = 'challenge_first';
