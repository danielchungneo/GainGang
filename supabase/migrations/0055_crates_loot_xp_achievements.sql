-- Crates opened, cosmetics owned, and lifetime XP ladders.
-- XP gates slightly softer than first draft; crate legendary = Keymaster.

alter table public.achievements
  drop constraint if exists achievements_category_check;

alter table public.achievements
  add constraint achievements_category_check
  check (category in (
    'goal', 'quest', 'streak', 'reps', 'time', 'social', 'gang',
    'reward', 'rare', 'general'
  ));

insert into public.achievements (key, title, description, icon, category, threshold, is_secret, tier)
values
  -- Crates opened
  ('crates_1',   'First Cache',    'Open your first reward crate',     'cube',  'reward', 1,     false, 'bronze'),
  ('crates_10',  'Crate Raider',   'Open 10 reward crates',            'cube',  'reward', 10,    false, 'silver'),
  ('crates_30',  'Vault Breaker',  'Open 30 reward crates',            'cube',  'reward', 30,    false, 'gold'),
  ('crates_100', 'Hoarder',        'Open 100 reward crates',           'cube',  'reward', 100,   false, 'platinum'),
  ('crates_250', 'Keymaster',      'Open 250 reward crates',           'cube',  'reward', 250,   false, 'legendary'),

  -- Cosmetics owned
  ('loot_1',     'Fresh Fit',      'Collect your first cosmetic',      'shirt', 'reward', 1,     false, 'bronze'),
  ('loot_5',     'Dressed',        'Collect 5 cosmetics',              'shirt', 'reward', 5,     false, 'silver'),
  ('loot_15',    'Closet Flex',    'Collect 15 cosmetics',             'shirt', 'reward', 15,    false, 'gold'),
  ('loot_40',    'Wardrobe',       'Collect 40 cosmetics',             'shirt', 'reward', 40,    false, 'platinum'),
  ('loot_75',    'Full Kit',       'Collect 75 cosmetics',             'shirt', 'reward', 75,    false, 'legendary'),

  -- Lifetime XP (profiles.xp)
  ('xp_500',     'Spark',          'Earn 500 total XP',                'rocket','reward', 500,   false, 'bronze'),
  ('xp_3k',      'Climber',        'Earn 3,000 total XP',              'rocket','reward', 3000,  false, 'silver'),
  ('xp_10k',     'Veteran',        'Earn 10,000 total XP',             'rocket','reward', 10000, false, 'gold'),
  ('xp_35k',     'High Score',     'Earn 35,000 total XP',             'rocket','reward', 35000, false, 'platinum'),
  ('xp_75k',     'Ascendant',      'Earn 75,000 total XP',             'rocket','reward', 75000, false, 'legendary')
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  category = excluded.category,
  threshold = excluded.threshold,
  is_secret = excluded.is_secret,
  tier = excluded.tier;

create or replace function public.check_and_award_achievements()
returns setof public.achievements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_streak integer := 0;
  v_xp integer := 0;
  v_day_clears integer := 0;
  v_goals_complete integer := 0;
  v_reps bigint := 0;
  v_seconds bigint := 0;
  v_kudos integer := 0;
  v_kudos_received integer := 0;
  v_crates_opened integer := 0;
  v_loot integer := 0;
  v_has_comment boolean := false;
  v_has_follow boolean := false;
  v_has_poke boolean := false;
  v_in_gang boolean := false;
  v_gang_assist boolean := false;
  v_has_challenge boolean := false;
  v_has_pull_up_bar boolean := false;
  v_has_weights boolean := false;
  v_keys text[] := array[]::text[];
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    greatest(coalesce(p.current_streak, 0), coalesce(p.longest_streak, 0)),
    coalesce(p.xp, 0),
    coalesce(p.has_pull_up_bar, false),
    coalesce(p.has_weights, false)
  into v_streak, v_xp, v_has_pull_up_bar, v_has_weights
  from public.profiles p
  where p.id = v_user_id;

  select count(*)::integer
  into v_day_clears
  from public.user_reward_crates urc
  where urc.user_id = v_user_id
    and urc.source = 'daily_completion';

  select count(*)::integer
  into v_goals_complete
  from (
    select dg.id
    from public.daily_goals dg
    join public.weekly_plans wp on wp.id = dg.weekly_plan_id
    join public.gang_members gm
      on gm.gang_id = wp.gang_id
     and gm.user_id = v_user_id
    join public.daily_goal_exercises dge on dge.daily_goal_id = dg.id
    join public.exercises e on e.id = dge.exercise_id
    left join public.xp_awards xa
      on xa.user_id = v_user_id
     and xa.kind = 'personal_goal'
     and xa.daily_goal_exercise_id = dge.id
    where dge.individual_target > 0
      and public.profile_has_equipment(
        v_has_pull_up_bar,
        v_has_weights,
        e.required_equipment
      )
    group by dg.id
    having count(*) > 0
       and count(*) = count(xa.id)
  ) completed_goals;

  select coalesce(sum(ae.amount), 0)::bigint
  into v_reps
  from public.activity_exercises ae
  join public.activities act on act.id = ae.activity_id
  where act.user_id = v_user_id
    and ae.unit = 'reps';

  select coalesce(sum(ae.amount), 0)::bigint
  into v_seconds
  from public.activity_exercises ae
  join public.activities act on act.id = ae.activity_id
  where act.user_id = v_user_id
    and ae.unit = 'seconds';

  select count(*)::integer
  into v_kudos
  from public.kudos k
  where k.user_id = v_user_id;

  select count(*)::integer
  into v_kudos_received
  from public.kudos k
  join public.activities act on act.id = k.activity_id
  where act.user_id = v_user_id;

  select count(*)::integer
  into v_crates_opened
  from public.user_reward_crates urc
  where urc.user_id = v_user_id
    and urc.status = 'opened';

  select count(*)::integer
  into v_loot
  from public.user_cosmetics uc
  where uc.user_id = v_user_id;

  select exists(
    select 1 from public.comments c where c.user_id = v_user_id
  ) into v_has_comment;

  select exists(
    select 1 from public.follows f where f.follower_id = v_user_id
  ) into v_has_follow;

  select exists(
    select 1
    from public.notifications n
    where n.actor_id = v_user_id
      and n.type = 'poke'
  ) into v_has_poke;

  select exists(
    select 1 from public.gang_members gm where gm.user_id = v_user_id
  ) into v_in_gang;

  select exists(
    select 1
    from public.activity_exercises ae
    join public.activities act on act.id = ae.activity_id
    join public.xp_awards xa
      on xa.kind = 'gang_goal'
     and xa.daily_goal_exercise_id = ae.daily_goal_exercise_id
    where act.user_id = v_user_id
      and ae.daily_goal_exercise_id is not null
  ) into v_gang_assist;

  select exists(
    select 1
    from public.challenge_entries ce
    where ce.user_id = v_user_id
  ) into v_has_challenge;

  if v_goals_complete >= 1 then
    v_keys := array_append(v_keys, 'first_goal');
  end if;
  if v_goals_complete >= 10 then
    v_keys := array_append(v_keys, 'goals_10');
  end if;
  if v_goals_complete >= 50 then
    v_keys := array_append(v_keys, 'goals_50');
  end if;
  if v_goals_complete >= 100 then
    v_keys := array_append(v_keys, 'goals_100');
  end if;

  if v_day_clears >= 1 then
    v_keys := array_append(v_keys, 'day_clear_1');
  end if;
  if v_day_clears >= 30 then
    v_keys := array_append(v_keys, 'day_clear_30');
  end if;

  if v_streak >= 3 then
    v_keys := array_append(v_keys, 'streak_3');
  end if;
  if v_streak >= 7 then
    v_keys := array_append(v_keys, 'streak_7');
  end if;
  if v_streak >= 30 then
    v_keys := array_append(v_keys, 'streak_30');
  end if;
  if v_streak >= 100 then
    v_keys := array_append(v_keys, 'streak_100');
  end if;

  if v_reps >= 100 then
    v_keys := array_append(v_keys, 'reps_100');
  end if;
  if v_reps >= 500 then
    v_keys := array_append(v_keys, 'reps_500');
  end if;
  if v_reps >= 1000 then
    v_keys := array_append(v_keys, 'reps_1k');
  end if;
  if v_reps >= 2000 then
    v_keys := array_append(v_keys, 'reps_2k');
  end if;
  if v_reps >= 5000 then
    v_keys := array_append(v_keys, 'reps_5k');
  end if;

  if v_seconds >= 600 then
    v_keys := array_append(v_keys, 'time_10m');
  end if;
  if v_seconds >= 3600 then
    v_keys := array_append(v_keys, 'time_60m');
  end if;
  if v_seconds >= 10800 then
    v_keys := array_append(v_keys, 'time_3h');
  end if;
  if v_seconds >= 36000 then
    v_keys := array_append(v_keys, 'time_10h');
  end if;
  if v_seconds >= 86400 then
    v_keys := array_append(v_keys, 'time_24h');
  end if;

  if v_kudos >= 1 then
    v_keys := array_append(v_keys, 'first_kudos');
  end if;
  if v_kudos >= 50 then
    v_keys := array_append(v_keys, 'kudos_50');
  end if;
  if v_kudos >= 250 then
    v_keys := array_append(v_keys, 'kudos_250');
  end if;

  if v_kudos_received >= 1 then
    v_keys := array_append(v_keys, 'kudos_recv_1');
  end if;
  if v_kudos_received >= 50 then
    v_keys := array_append(v_keys, 'kudos_recv_50');
  end if;
  if v_kudos_received >= 250 then
    v_keys := array_append(v_keys, 'kudos_recv_250');
  end if;

  if v_crates_opened >= 1 then
    v_keys := array_append(v_keys, 'crates_1');
  end if;
  if v_crates_opened >= 10 then
    v_keys := array_append(v_keys, 'crates_10');
  end if;
  if v_crates_opened >= 30 then
    v_keys := array_append(v_keys, 'crates_30');
  end if;
  if v_crates_opened >= 100 then
    v_keys := array_append(v_keys, 'crates_100');
  end if;
  if v_crates_opened >= 250 then
    v_keys := array_append(v_keys, 'crates_250');
  end if;

  if v_loot >= 1 then
    v_keys := array_append(v_keys, 'loot_1');
  end if;
  if v_loot >= 5 then
    v_keys := array_append(v_keys, 'loot_5');
  end if;
  if v_loot >= 15 then
    v_keys := array_append(v_keys, 'loot_15');
  end if;
  if v_loot >= 40 then
    v_keys := array_append(v_keys, 'loot_40');
  end if;
  if v_loot >= 75 then
    v_keys := array_append(v_keys, 'loot_75');
  end if;

  if v_xp >= 500 then
    v_keys := array_append(v_keys, 'xp_500');
  end if;
  if v_xp >= 3000 then
    v_keys := array_append(v_keys, 'xp_3k');
  end if;
  if v_xp >= 10000 then
    v_keys := array_append(v_keys, 'xp_10k');
  end if;
  if v_xp >= 35000 then
    v_keys := array_append(v_keys, 'xp_35k');
  end if;
  if v_xp >= 75000 then
    v_keys := array_append(v_keys, 'xp_75k');
  end if;

  if v_has_comment then
    v_keys := array_append(v_keys, 'first_comment');
  end if;
  if v_has_follow then
    v_keys := array_append(v_keys, 'first_follow');
  end if;
  if v_has_poke then
    v_keys := array_append(v_keys, 'first_poke');
  end if;

  if v_in_gang then
    v_keys := array_append(v_keys, 'join_gang');
  end if;
  if v_gang_assist then
    v_keys := array_append(v_keys, 'gang_goal_assist');
  end if;

  if v_has_challenge then
    v_keys := array_append(v_keys, 'challenge_first');
  end if;

  if coalesce(array_length(v_keys, 1), 0) = 0 then
    return;
  end if;

  return query
  with eligible as (
    select a.*
    from public.achievements a
    where a.key = any (v_keys)
      and not exists (
        select 1
        from public.user_achievements ua
        where ua.user_id = v_user_id
          and ua.achievement_id = a.id
      )
  ),
  inserted as (
    insert into public.user_achievements (user_id, achievement_id)
    select v_user_id, e.id
    from eligible e
    on conflict do nothing
    returning achievement_id
  )
  select a.*
  from public.achievements a
  join inserted i on i.achievement_id = a.id
  order by
    case a.tier
      when 'legendary' then 5
      when 'platinum' then 4
      when 'gold' then 3
      when 'silver' then 2
      else 1
    end desc,
    a.title;
end;
$$;

revoke all on function public.check_and_award_achievements() from public, anon;
grant execute on function public.check_and_award_achievements() to authenticated;
