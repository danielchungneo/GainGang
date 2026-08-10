-- Expose the caller's top daily war attempts on get_gang_war_state,
-- plus a lightweight badge helper for the War tab.

create or replace function public.get_gang_war_state(p_gang_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_settings jsonb;
  v_timezone text;
  v_today date;
  v_gang public.gangs;
  v_match public.gang_war_matches;
  v_opp public.gangs;
  v_ours uuid;
  v_theirs uuid;
  v_our_score numeric;
  v_their_score numeric;
  v_days jsonb := '[]'::jsonb;
  v_day record;
  v_exercise record;
  v_seen public.gang_war_user_seen;
  v_prev public.gang_war_matches;
  v_prev_seen public.gang_war_user_seen;
  v_my_top_scores jsonb := '[]'::jsonb;
  v_my_attempt_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.gang_members gm
    where gm.gang_id = p_gang_id and gm.user_id = v_user_id
  ) then
    raise exception 'Not a member of this gang';
  end if;

  select * into v_gang from public.gangs where id = p_gang_id;

  select value into v_settings
  from public.app_settings
  where key = 'gang_war_rollover';
  v_timezone := coalesce(v_settings->>'timezone', 'America/New_York');
  v_today := (timezone(v_timezone, now()))::date;

  select * into v_match
  from public.gang_war_matches m
  where m.status = 'active'
    and (m.gang_a_id = p_gang_id or m.gang_b_id = p_gang_id)
  order by m.starts_on desc
  limit 1;

  -- Latest resolved match needing result animation
  select * into v_prev
  from public.gang_war_matches m
  where m.status = 'resolved'
    and (m.gang_a_id = p_gang_id or m.gang_b_id = p_gang_id)
  order by m.resolved_at desc nulls last, m.ends_on desc
  limit 1;

  if v_prev.id is not null then
    select * into v_prev_seen
    from public.gang_war_user_seen s
    where s.user_id = v_user_id and s.match_id = v_prev.id;
  end if;

  if v_match.id is null then
    return jsonb_build_object(
      'ok', true,
      'state', 'unmatched',
      'gang', jsonb_build_object(
        'id', v_gang.id,
        'name', v_gang.name,
        'banner_url', v_gang.banner_url,
        'war_division', v_gang.war_division
      ),
      'today', v_today,
      'my_top_scores', '[]'::jsonb,
      'my_attempt_count', 0,
      'pending_result', case
        when v_prev.id is not null and v_prev_seen.result_seen_at is null then
          jsonb_build_object(
            'match_id', v_prev.id,
            'won', v_prev.winner_gang_id = p_gang_id,
            'division', v_prev.division,
            'our_score', case when v_prev.gang_a_id = p_gang_id then v_prev.gang_a_score else v_prev.gang_b_score end,
            'their_score', case when v_prev.gang_a_id = p_gang_id then v_prev.gang_b_score else v_prev.gang_a_score end
          )
        else null
      end
    );
  end if;

  if v_match.gang_a_id = p_gang_id then
    v_ours := v_match.gang_a_id;
    v_theirs := v_match.gang_b_id;
  else
    v_ours := v_match.gang_b_id;
    v_theirs := v_match.gang_a_id;
  end if;

  select * into v_opp from public.gangs where id = v_theirs;

  v_our_score := public.gang_war_gang_week_score(v_match.id, v_ours, v_today);
  v_their_score := public.gang_war_gang_week_score(v_match.id, v_theirs, v_today);

  for v_day in
    select d.day_on, d.exercise_id
    from public.gang_war_days d
    where d.day_on between v_match.starts_on and v_match.ends_on
    order by d.day_on
  loop
    select e.id, e.name, e.unit into v_exercise
    from public.exercises e
    where e.id = v_day.exercise_id;

    v_days := v_days || jsonb_build_array(jsonb_build_object(
      'day_on', v_day.day_on,
      'exercise_id', v_exercise.id,
      'exercise_name', v_exercise.name,
      'unit', v_exercise.unit,
      'is_today', v_day.day_on = v_today,
      'is_future', v_day.day_on > v_today,
      'our_score', case
        when v_day.day_on > v_today then null
        else public.gang_war_gang_day_score(v_match.id, v_ours, v_day.day_on)
      end,
      'their_score', case
        when v_day.day_on > v_today then null
        else public.gang_war_gang_day_score(v_match.id, v_theirs, v_day.day_on)
      end
    ));
  end loop;

  select * into v_seen
  from public.gang_war_user_seen s
  where s.user_id = v_user_id and s.match_id = v_match.id;

  select coalesce(
    (
      select jsonb_agg(to_jsonb(s.score))
      from (
        select a.score
        from public.gang_war_attempts a
        where a.match_id = v_match.id
          and a.gang_id = p_gang_id
          and a.user_id = v_user_id
          and a.day_on = v_today
        order by a.score desc, a.created_at asc
        limit 2
      ) s
    ),
    '[]'::jsonb
  ) into v_my_top_scores;

  select count(*)::integer into v_my_attempt_count
  from public.gang_war_attempts a
  where a.match_id = v_match.id
    and a.gang_id = p_gang_id
    and a.user_id = v_user_id
    and a.day_on = v_today;

  return jsonb_build_object(
    'ok', true,
    'state', 'active',
    'today', v_today,
    'gang', jsonb_build_object(
      'id', v_gang.id,
      'name', v_gang.name,
      'banner_url', v_gang.banner_url,
      'war_division', v_gang.war_division
    ),
    'match', jsonb_build_object(
      'id', v_match.id,
      'starts_on', v_match.starts_on,
      'ends_on', v_match.ends_on,
      'division', v_match.division,
      'our_score', v_our_score,
      'their_score', v_their_score,
      'opponent', jsonb_build_object(
        'id', v_opp.id,
        'name', v_opp.name,
        'banner_url', v_opp.banner_url,
        'war_division', coalesce(v_opp.war_bot_division, v_opp.war_division),
        'is_bot', v_opp.war_bot_division is not null
      ),
      'days', v_days,
      'vs_seen', v_seen.vs_seen_at is not null
    ),
    'my_top_scores', v_my_top_scores,
    'my_attempt_count', v_my_attempt_count,
    'pending_result', case
      when v_prev.id is not null and v_prev_seen.result_seen_at is null then
        jsonb_build_object(
          'match_id', v_prev.id,
          'won', v_prev.winner_gang_id = p_gang_id,
          'division', v_prev.division,
          'our_score', case when v_prev.gang_a_id = p_gang_id then v_prev.gang_a_score else v_prev.gang_b_score end,
          'their_score', case when v_prev.gang_a_id = p_gang_id then v_prev.gang_b_score else v_prev.gang_a_score end
        )
      else null
    end
  );
end;
$$;

revoke execute on function public.get_gang_war_state(uuid) from public, anon;
grant execute on function public.get_gang_war_state(uuid) to authenticated;

-- True when the caller has an active war for any gang and fewer than 2 attempts today.
create or replace function public.needs_gang_war_attempts()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_settings jsonb;
  v_timezone text;
  v_today date;
  v_row record;
  v_count integer;
begin
  if v_user_id is null then
    return false;
  end if;

  select value into v_settings
  from public.app_settings
  where key = 'gang_war_rollover';
  v_timezone := coalesce(v_settings->>'timezone', 'America/New_York');
  v_today := (timezone(v_timezone, now()))::date;

  for v_row in
    select m.id as match_id, gm.gang_id
    from public.gang_members gm
    join public.gang_war_matches m
      on m.status = 'active'
     and (m.gang_a_id = gm.gang_id or m.gang_b_id = gm.gang_id)
    where gm.user_id = v_user_id
  loop
    select count(*)::integer into v_count
    from public.gang_war_attempts a
    where a.match_id = v_row.match_id
      and a.gang_id = v_row.gang_id
      and a.user_id = v_user_id
      and a.day_on = v_today;

    if coalesce(v_count, 0) < 2 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

revoke execute on function public.needs_gang_war_attempts() from public, anon;
grant execute on function public.needs_gang_war_attempts() to authenticated;
