-- Per-member week contributions for the War matchup sheet.

create or replace function public.gang_war_member_week_contribution(
  p_match_id uuid,
  p_gang_id uuid,
  p_user_id uuid,
  p_through_day date
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_match public.gang_war_matches;
  v_end date;
  v_day date;
  v_total numeric := 0;
begin
  select * into v_match
  from public.gang_war_matches
  where id = p_match_id;

  if v_match.id is null then
    return 0;
  end if;

  v_end := least(coalesce(p_through_day, v_match.ends_on), v_match.ends_on);
  if v_end < v_match.starts_on then
    return 0;
  end if;

  v_day := v_match.starts_on;
  while v_day <= v_end loop
    v_total := v_total
      + public.gang_war_member_day_contribution(p_match_id, p_gang_id, p_user_id, v_day);
    v_day := v_day + 1;
  end loop;

  return v_total;
end;
$$;

create or replace function public.get_gang_war_member_contributions(
  p_match_id uuid,
  p_gang_id uuid
)
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
  v_match public.gang_war_matches;
  v_gang public.gangs;
  v_through date;
  v_members jsonb := '[]'::jsonb;
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

  select value into v_settings
  from public.app_settings
  where key = 'gang_war_rollover';
  v_timezone := coalesce(v_settings->>'timezone', 'America/New_York');
  v_today := (timezone(v_timezone, now()))::date;
  v_through := least(v_today, v_match.ends_on);

  if v_gang.war_bot_division is not null then
    v_bot_score := public.gang_war_gang_week_score(p_match_id, p_gang_id, v_through);
    return jsonb_build_object(
      'ok', true,
      'gang_id', v_gang.id,
      'gang_name', v_gang.name,
      'is_bot', true,
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
      public.gang_war_member_week_contribution(
        p_match_id, p_gang_id, gm.user_id, v_through
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
    'members', v_members
  );
end;
$$;

revoke execute on function public.get_gang_war_member_contributions(uuid, uuid) from public, anon;
grant execute on function public.get_gang_war_member_contributions(uuid, uuid) to authenticated;
