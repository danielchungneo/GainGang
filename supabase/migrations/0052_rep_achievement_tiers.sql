-- Retune rep achievement ladder: 100 / 500 / 1k / 2k / 5k.

delete from public.user_achievements ua
using public.achievements a
where ua.achievement_id = a.id
  and a.key in ('reps_1k', 'reps_10k', 'reps_50k', 'reps_100k', 'reps_100', 'reps_500', 'reps_2k', 'reps_5k');

delete from public.achievements
where key in ('reps_1k', 'reps_10k', 'reps_50k', 'reps_100k', 'reps_100', 'reps_500', 'reps_2k', 'reps_5k');

insert into public.achievements (key, title, description, icon, category, threshold, is_secret, tier)
values
  ('reps_100', 'Grinder',    'Log 100 total reps',   'dumbbell', 'reps', 100,  false, 'bronze'),
  ('reps_500', 'Machine',    'Log 500 total reps',   'dumbbell', 'reps', 500,  false, 'silver'),
  ('reps_1k',  'Beast',      'Log 1,000 total reps', 'dumbbell', 'reps', 1000, false, 'gold'),
  ('reps_2k',  'Workhorse',  'Log 2,000 total reps', 'dumbbell', 'reps', 2000, false, 'platinum'),
  ('reps_5k',  'Legend',     'Log 5,000 total reps', 'dumbbell', 'reps', 5000, false, 'legendary');

create or replace function public.check_and_award_achievements()
returns setof public.achievements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_streak integer := 0;
  v_day_clears integer := 0;
  v_goals_complete integer := 0;
  v_reps bigint := 0;
  v_kudos integer := 0;
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
    coalesce(p.has_pull_up_bar, false),
    coalesce(p.has_weights, false)
  into v_streak, v_has_pull_up_bar, v_has_weights
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

  select count(*)::integer
  into v_kudos
  from public.kudos k
  where k.user_id = v_user_id;

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

  if v_kudos >= 1 then
    v_keys := array_append(v_keys, 'first_kudos');
  end if;
  if v_kudos >= 50 then
    v_keys := array_append(v_keys, 'kudos_50');
  end if;
  if v_kudos >= 250 then
    v_keys := array_append(v_keys, 'kudos_250');
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
  ),
  notified as (
    insert into public.notifications (user_id, type, actor_id, body)
    select
      v_user_id,
      'achievement',
      v_user_id,
      'Achievement unlocked: ' || a.title
    from inserted i
    join public.achievements a on a.id = i.achievement_id
    returning id
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
