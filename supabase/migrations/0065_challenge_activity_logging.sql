-- Log war / weekly challenge attempts as freeform activities so they appear in
-- the activity feed and count toward stats, without advancing daily goals
-- (daily_goal_exercise_id stays null).

create or replace function public.sync_tagged_activity_exercise(
  p_user_id uuid,
  p_activity_date date,
  p_gang_id uuid,
  p_exercise_id uuid,
  p_exercise_name text,
  p_category text,
  p_unit text,
  p_amount numeric,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_exercise_id uuid;
  v_amount numeric(10, 1);
  v_streak integer := 1;
  v_dates date[];
  v_cursor date;
  v_yesterday date;
begin
  if p_user_id is null or p_activity_date is null then
    raise exception 'user_id and activity_date are required';
  end if;

  if p_unit = 'miles' then
    v_amount := round(coalesce(p_amount, 0), 1);
  else
    v_amount := trunc(coalesce(p_amount, 0));
  end if;

  if p_gang_id is not null then
    select a.id into v_activity_id
    from public.activities a
    where a.user_id = p_user_id
      and a.activity_date = p_activity_date
      and a.gang_id = p_gang_id
      and a.daily_goal_id is null
      and a.quest_id is null
    limit 1;
  else
    select a.id into v_activity_id
    from public.activities a
    where a.user_id = p_user_id
      and a.activity_date = p_activity_date
      and a.gang_id is null
      and a.daily_goal_id is null
      and a.quest_id is null
    limit 1;
  end if;

  if v_activity_id is null then
    select array_agg(distinct x.d order by x.d)
    into v_dates
    from (
      select a.activity_date as d
      from public.activities a
      where a.user_id = p_user_id
        and a.activity_date is not null
      union
      select p_activity_date
    ) x;

    v_yesterday := p_activity_date - 1;
    if p_activity_date = any (v_dates) then
      v_cursor := p_activity_date;
    elsif v_yesterday = any (v_dates) then
      v_cursor := v_yesterday;
    else
      v_cursor := null;
    end if;

    v_streak := 0;
    while v_cursor is not null and v_cursor = any (v_dates) loop
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    end loop;
    if v_streak < 1 then
      v_streak := 1;
    end if;

    insert into public.activities (
      user_id,
      gang_id,
      quest_id,
      daily_goal_id,
      activity_date,
      streak_at_log,
      notes
    )
    values (
      p_user_id,
      p_gang_id,
      null,
      null,
      p_activity_date,
      v_streak,
      p_notes
    )
    returning id into v_activity_id;
  else
    select coalesce(a.streak_at_log, 1) into v_streak
    from public.activities a
    where a.id = v_activity_id;

    update public.activities
    set
      notes = case
        when notes is null or notes = '' then p_notes
        when position(p_notes in notes) > 0 then notes
        else notes || ' · ' || p_notes
      end,
      updated_at = now()
    where id = v_activity_id;
  end if;

  select ae.id into v_exercise_id
  from public.activity_exercises ae
  where ae.activity_id = v_activity_id
    and ae.notes = p_notes
    and ae.daily_goal_exercise_id is null
    and (
      (p_exercise_id is not null and ae.exercise_id = p_exercise_id)
      or (p_exercise_id is null and ae.exercise_name = p_exercise_name)
    )
  limit 1;

  if v_exercise_id is null then
    insert into public.activity_exercises (
      activity_id,
      exercise_id,
      exercise_name,
      category,
      unit,
      amount,
      notes,
      daily_goal_exercise_id
    )
    values (
      v_activity_id,
      p_exercise_id,
      p_exercise_name,
      p_category,
      p_unit,
      v_amount,
      p_notes,
      null
    )
    returning id into v_exercise_id;
  else
    update public.activity_exercises
    set
      amount = v_amount,
      exercise_name = p_exercise_name,
      category = coalesce(p_category, category),
      unit = p_unit,
      updated_at = now()
    where id = v_exercise_id;
  end if;

  -- Keep profile activity signals fresh for streaks / last active.
  update public.profiles p
  set
    last_active_on = greatest(coalesce(p.last_active_on, p_activity_date), p_activity_date),
    current_streak = greatest(coalesce(p.current_streak, 0), v_streak),
    longest_streak = greatest(coalesce(p.longest_streak, 0), greatest(coalesce(p.current_streak, 0), v_streak)),
    updated_at = now()
  where p.id = p_user_id;

  return v_activity_id;
end;
$$;

revoke execute on function public.sync_tagged_activity_exercise(
  uuid, date, uuid, uuid, text, text, text, numeric, text
) from public, anon;
grant execute on function public.sync_tagged_activity_exercise(
  uuid, date, uuid, uuid, text, text, text, numeric, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- Gang war submit: also sync activity log (no daily goal link)
-- ----------------------------------------------------------------------------
create or replace function public.submit_gang_war_attempt(
  p_match_id uuid,
  p_gang_id uuid,
  p_score numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.gang_war_matches;
  v_settings jsonb;
  v_timezone text;
  v_local_date date;
  v_day public.gang_war_days;
  v_attempt public.gang_war_attempts;
  v_contribution numeric;
  v_exercise public.exercises;
  v_activity_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_score is null or p_score < 0 then
    raise exception 'Score must be non-negative';
  end if;

  select value into v_settings
  from public.app_settings
  where key = 'gang_war_rollover';

  v_timezone := coalesce(v_settings->>'timezone', 'America/New_York');
  v_local_date := (timezone(v_timezone, now()))::date;

  select * into v_match
  from public.gang_war_matches
  where id = p_match_id
  for update;

  if v_match.id is null then
    raise exception 'Match not found';
  end if;

  if v_match.status <> 'active' then
    raise exception 'Match is not active';
  end if;

  if v_local_date < v_match.starts_on or v_local_date > v_match.ends_on then
    raise exception 'Match is outside its active window';
  end if;

  if p_gang_id is distinct from v_match.gang_a_id
     and p_gang_id is distinct from v_match.gang_b_id then
    raise exception 'Gang is not in this match';
  end if;

  if public.gang_war_is_bot_gang(p_gang_id) then
    raise exception 'Cannot submit for a bot gang';
  end if;

  if not exists (
    select 1
    from public.gang_members gm
    where gm.gang_id = p_gang_id
      and gm.user_id = v_user_id
  ) then
    raise exception 'Not a member of this gang';
  end if;

  select * into v_day
  from public.gang_war_days
  where day_on = v_local_date;

  if v_day.day_on is null then
    raise exception 'No war exercise scheduled for today';
  end if;

  insert into public.gang_war_attempts (
    match_id, gang_id, user_id, day_on, score
  )
  values (
    p_match_id,
    p_gang_id,
    v_user_id,
    v_local_date,
    round(p_score, 1)
  )
  returning * into v_attempt;

  v_contribution := public.gang_war_member_day_contribution(
    p_match_id, p_gang_id, v_user_id, v_local_date
  );

  select * into v_exercise
  from public.exercises
  where id = v_day.exercise_id;

  v_activity_id := public.sync_tagged_activity_exercise(
    v_user_id,
    v_local_date,
    p_gang_id,
    v_exercise.id,
    coalesce(v_exercise.name, 'War exercise'),
    v_exercise.category,
    coalesce(v_exercise.unit, 'reps'),
    v_contribution,
    'Gang War'
  );

  return jsonb_build_object(
    'ok', true,
    'attempt_id', v_attempt.id,
    'score_submitted', v_attempt.score,
    'day_on', v_local_date,
    'member_day_contribution', v_contribution,
    'gang_day_score', public.gang_war_gang_day_score(p_match_id, p_gang_id, v_local_date),
    'gang_week_score', public.gang_war_gang_week_score(p_match_id, p_gang_id, v_local_date),
    'activity_id', v_activity_id
  );
end;
$$;

revoke execute on function public.submit_gang_war_attempt(uuid, uuid, numeric)
  from public, anon;
grant execute on function public.submit_gang_war_attempt(uuid, uuid, numeric)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Weekly challenge submit: also sync activity log (no daily goal link)
-- ----------------------------------------------------------------------------
create or replace function public.submit_challenge_attempt(
  p_weekly_challenge_id uuid,
  p_score numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.weekly_challenges;
  v_type public.challenge_types;
  v_exercise public.exercises;
  v_settings jsonb;
  v_entry public.challenge_entries;
  v_previous numeric(10, 1);
  v_accepted boolean := false;
  v_is_first boolean := false;
  v_xp integer := 0;
  v_xp_awarded boolean := false;
  v_old_xp integer;
  v_new_xp integer;
  v_local_date date;
  v_timezone text;
  v_activity_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_score is null or p_score < 0 then
    raise exception 'Score must be non-negative';
  end if;

  select value into v_settings
  from public.app_settings
  where key = 'weekly_challenge_rollover';

  v_timezone := coalesce(v_settings->>'timezone', 'America/New_York');
  v_local_date := (timezone(v_timezone, now()))::date;

  select * into v_challenge
  from public.weekly_challenges
  where id = p_weekly_challenge_id
  for update;

  if v_challenge.id is null then
    raise exception 'Challenge not found';
  end if;

  if v_challenge.status <> 'active' then
    raise exception 'Challenge is not active';
  end if;

  if v_local_date < v_challenge.starts_on or v_local_date > v_challenge.ends_on then
    raise exception 'Challenge is outside its active window';
  end if;

  select * into v_type
  from public.challenge_types
  where id = v_challenge.challenge_type_id;

  select * into v_exercise
  from public.exercises
  where id = v_type.exercise_id;

  select * into v_entry
  from public.challenge_entries
  where weekly_challenge_id = p_weekly_challenge_id
    and user_id = v_user_id
  for update;

  if v_entry.id is null then
    v_is_first := true;
    v_previous := null;
    v_accepted := true;

    insert into public.challenge_entries (
      weekly_challenge_id, user_id, best_score, attempt_count
    )
    values (
      p_weekly_challenge_id,
      v_user_id,
      round(p_score, 1),
      1
    )
    returning * into v_entry;
  else
    v_previous := v_entry.best_score;
    if p_score > v_entry.best_score then
      v_accepted := true;
      update public.challenge_entries
      set
        best_score = round(p_score, 1),
        attempt_count = attempt_count + 1,
        updated_at = now()
      where id = v_entry.id
      returning * into v_entry;
    else
      update public.challenge_entries
      set
        attempt_count = attempt_count + 1,
        updated_at = now()
      where id = v_entry.id
      returning * into v_entry;
    end if;
  end if;

  if v_is_first then
    v_xp := coalesce((v_settings->>'first_attempt_xp')::int, 25);

    begin
      insert into public.xp_awards (
        kind, user_id, weekly_challenge_id, xp_amount
      )
      values (
        'challenge_attempt', v_user_id, p_weekly_challenge_id, v_xp
      );

      select xp into v_old_xp
      from public.profiles
      where id = v_user_id
      for update;

      v_new_xp := greatest(0, coalesce(v_old_xp, 0) + v_xp);

      update public.profiles
      set
        xp = v_new_xp,
        rank = public.rank_for_xp(v_new_xp)
      where id = v_user_id;

      v_xp_awarded := true;
    exception
      when unique_violation then
        v_xp_awarded := false;
        v_xp := 0;
    end;
  end if;

  -- Always sync the activity to the current best so stats/feed stay accurate.
  v_activity_id := public.sync_tagged_activity_exercise(
    v_user_id,
    v_local_date,
    null,
    v_exercise.id,
    coalesce(v_type.name, v_exercise.name, 'Weekly challenge'),
    v_exercise.category,
    coalesce(v_type.unit, v_exercise.unit, 'reps'),
    v_entry.best_score,
    'Weekly Challenge'
  );

  return jsonb_build_object(
    'ok', true,
    'accepted', v_accepted,
    'is_first_attempt', v_is_first,
    'previous_best', v_previous,
    'best_score', v_entry.best_score,
    'attempt_count', v_entry.attempt_count,
    'score_submitted', round(p_score, 1),
    'unit', v_type.unit,
    'xp_awarded', case when v_xp_awarded then v_xp else 0 end,
    'activity_id', v_activity_id
  );
end;
$$;

revoke execute on function public.submit_challenge_attempt(uuid, numeric)
  from public, anon;
grant execute on function public.submit_challenge_attempt(uuid, numeric)
  to authenticated;
