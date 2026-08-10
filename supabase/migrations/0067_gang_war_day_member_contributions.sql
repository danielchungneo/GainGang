-- Per-day member contributions for the War daily breakdown details sheet.

create or replace function public.get_gang_war_day_member_contributions(
  p_match_id uuid,
  p_gang_id uuid,
  p_day_on date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.gang_war_matches;
  v_gang public.gangs;
  v_day public.gang_war_days;
  v_exercise public.exercises;
  v_members jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_bot_score numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_match
  from public.gang_war_matches
  where id = p_match_id;

  if v_match.id is null then
    raise exception 'Match not found';
  end if;

  if p_gang_id is distinct from v_match.gang_a_id
     and p_gang_id is distinct from v_match.gang_b_id then
    raise exception 'Gang is not in this match';
  end if;

  if p_day_on is null
     or p_day_on < v_match.starts_on
     or p_day_on > v_match.ends_on then
    raise exception 'Day is outside this match';
  end if;

  -- Caller must belong to one side of the match.
  if not exists (
    select 1
    from public.gang_members gm
    where gm.user_id = v_user_id
      and (gm.gang_id = v_match.gang_a_id or gm.gang_id = v_match.gang_b_id)
  ) then
    raise exception 'Not a participant in this match';
  end if;

  select * into v_gang from public.gangs where id = p_gang_id;

  select * into v_day
  from public.gang_war_days
  where day_on = p_day_on;

  if v_day.day_on is null then
    raise exception 'No war exercise scheduled for this day';
  end if;

  select * into v_exercise
  from public.exercises
  where id = v_day.exercise_id;

  v_total := public.gang_war_gang_day_score(p_match_id, p_gang_id, p_day_on);

  if v_gang.war_bot_division is not null then
    v_bot_score := v_total;
    return jsonb_build_object(
      'ok', true,
      'gang_id', v_gang.id,
      'gang_name', v_gang.name,
      'is_bot', true,
      'day_on', p_day_on,
      'exercise_name', coalesce(v_exercise.name, 'War exercise'),
      'unit', coalesce(v_exercise.unit, 'reps'),
      'gang_day_total', v_total,
      'members', jsonb_build_array(
        jsonb_build_object(
          'user_id', null,
          'full_name', 'War Bot',
          'avatar_url', v_gang.banner_url,
          'contribution', v_bot_score
        )
      )
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'full_name', coalesce(p.full_name, 'Member'),
        'avatar_url', p.avatar_url,
        'contribution', m.contribution
      )
      order by m.contribution desc, coalesce(p.full_name, '') asc
    ),
    '[]'::jsonb
  )
  into v_members
  from (
    select
      gm.user_id,
      public.gang_war_member_day_contribution(
        p_match_id, p_gang_id, gm.user_id, p_day_on
      ) as contribution
    from public.gang_members gm
    where gm.gang_id = p_gang_id
  ) m
  left join public.profiles p on p.id = m.user_id;

  return jsonb_build_object(
    'ok', true,
    'gang_id', v_gang.id,
    'gang_name', v_gang.name,
    'is_bot', false,
    'day_on', p_day_on,
    'exercise_name', coalesce(v_exercise.name, 'War exercise'),
    'unit', coalesce(v_exercise.unit, 'reps'),
    'gang_day_total', v_total,
    'members', v_members
  );
end;
$$;

revoke execute on function public.get_gang_war_day_member_contributions(uuid, uuid, date)
  from public, anon;
grant execute on function public.get_gang_war_day_member_contributions(uuid, uuid, date)
  to authenticated;
