-- ============================================================================
-- Gang Wars
-- - Division ladder, weekly head-to-head matches, bot fillers
-- - Daily 60s exercise cycle (continuous rotation across weeks)
-- - Top-2 attempts per member per day per gang; Monday 2 AM ET rollover
-- Requires 0061_gang_war_crate_source.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Gangs: war division + bot linkage
-- ----------------------------------------------------------------------------
alter table public.gangs
  add column if not exists war_division text;

alter table public.gangs
  add column if not exists war_bot_division text;

update public.gangs
set war_division = 'iron'
where war_division is null
  and coalesce(is_system, false) = false;

alter table public.gangs
  alter column war_division set default 'iron';

do $$
begin
  alter table public.gangs
    add constraint gangs_war_division_ck
    check (
      war_division is null
      or war_division in (
        'iron', 'bronze', 'silver', 'gold', 'emerald', 'diamond', 'crystal', 'onyx'
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.gangs
    add constraint gangs_war_bot_division_ck
    check (
      war_bot_division is null
      or war_bot_division in (
        'iron', 'bronze', 'silver', 'gold', 'emerald', 'diamond', 'crystal', 'onyx'
      )
    );
exception
  when duplicate_object then null;
end $$;

comment on column public.gangs.war_division is
  'Gang Wars ladder division. Null only for non-bot system gangs that are not war bots.';
comment on column public.gangs.war_bot_division is
  'When set, this system gang is the war bot for that division.';

-- ----------------------------------------------------------------------------
-- SCHEMA
-- ----------------------------------------------------------------------------
create table if not exists public.gang_war_matches (
  id                      uuid primary key default gen_random_uuid(),
  starts_on               date not null,
  ends_on                 date not null,
  division                text not null
                            check (division in (
                              'iron', 'bronze', 'silver', 'gold',
                              'emerald', 'diamond', 'crystal', 'onyx'
                            )),
  gang_a_id               uuid not null references public.gangs(id),
  gang_b_id               uuid not null references public.gangs(id),
  status                  text not null default 'active'
                            check (status in ('active', 'resolved')),
  gang_a_score            numeric(12, 1),
  gang_b_score            numeric(12, 1),
  winner_gang_id          uuid references public.gangs(id),
  gang_a_member_count     integer,
  gang_b_member_count     integer,
  gang_a_first_attempt_at timestamptz,
  gang_b_first_attempt_at timestamptz,
  resolved_at             timestamptz,
  created_at              timestamptz not null default now(),
  constraint gang_war_matches_range_ck check (ends_on >= starts_on),
  constraint gang_war_matches_distinct_ck check (gang_a_id <> gang_b_id)
);

create unique index if not exists gang_war_matches_week_gang_a_uidx
  on public.gang_war_matches (starts_on, gang_a_id);

create unique index if not exists gang_war_matches_week_gang_b_uidx
  on public.gang_war_matches (starts_on, gang_b_id);

create index if not exists gang_war_matches_status_ends_idx
  on public.gang_war_matches (status, ends_on);

create index if not exists gang_war_matches_active_gangs_idx
  on public.gang_war_matches (status, gang_a_id, gang_b_id);

create table if not exists public.gang_war_days (
  day_on       date primary key,
  exercise_id  uuid not null references public.exercises(id),
  created_at   timestamptz not null default now()
);

create table if not exists public.gang_war_attempts (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.gang_war_matches(id) on delete cascade,
  gang_id     uuid not null references public.gangs(id),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  day_on      date not null references public.gang_war_days(day_on),
  score       numeric(10, 1) not null check (score >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists gang_war_attempts_match_gang_day_idx
  on public.gang_war_attempts (match_id, gang_id, day_on, user_id, score desc);

create index if not exists gang_war_attempts_user_idx
  on public.gang_war_attempts (user_id, match_id);

create table if not exists public.gang_war_bot_day_targets (
  division    text not null
                check (division in (
                  'iron', 'bronze', 'silver', 'gold',
                  'emerald', 'diamond', 'crystal', 'onyx'
                )),
  day_offset  smallint not null check (day_offset between 0 and 6),
  score       numeric(10, 1) not null check (score >= 0),
  primary key (division, day_offset)
);

create table if not exists public.gang_war_user_seen (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  match_id        uuid not null references public.gang_war_matches(id) on delete cascade,
  vs_seen_at      timestamptz,
  result_seen_at  timestamptz,
  primary key (user_id, match_id)
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.gang_war_matches enable row level security;
alter table public.gang_war_days enable row level security;
alter table public.gang_war_attempts enable row level security;
alter table public.gang_war_bot_day_targets enable row level security;
alter table public.gang_war_user_seen enable row level security;

drop policy if exists "gang_war_matches_select_authenticated" on public.gang_war_matches;
create policy "gang_war_matches_select_authenticated" on public.gang_war_matches
  for select to authenticated using (true);

drop policy if exists "gang_war_days_select_authenticated" on public.gang_war_days;
create policy "gang_war_days_select_authenticated" on public.gang_war_days
  for select to authenticated using (true);

drop policy if exists "gang_war_attempts_select_authenticated" on public.gang_war_attempts;
create policy "gang_war_attempts_select_authenticated" on public.gang_war_attempts
  for select to authenticated using (true);

drop policy if exists "gang_war_bot_targets_select_authenticated" on public.gang_war_bot_day_targets;
create policy "gang_war_bot_targets_select_authenticated" on public.gang_war_bot_day_targets
  for select to authenticated using (true);

drop policy if exists "gang_war_user_seen_select_own" on public.gang_war_user_seen;
create policy "gang_war_user_seen_select_own" on public.gang_war_user_seen
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.gang_war_matches from authenticated, anon;
revoke insert, update, delete on public.gang_war_days from authenticated, anon;
revoke insert, update, delete on public.gang_war_attempts from authenticated, anon;
revoke insert, update, delete on public.gang_war_bot_day_targets from authenticated, anon;
revoke insert, update, delete on public.gang_war_user_seen from authenticated, anon;

grant select on public.gang_war_matches to authenticated;
grant select on public.gang_war_days to authenticated;
grant select on public.gang_war_attempts to authenticated;
grant select on public.gang_war_bot_day_targets to authenticated;
grant select on public.gang_war_user_seen to authenticated;

-- ----------------------------------------------------------------------------
-- Settings
-- ----------------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'gang_war_rollover',
  jsonb_build_object(
    'timezone', 'America/New_York',
    'local_hour', 2,
    'local_minute', 0,
    'day_of_week', 1,
    'rotation_exercise_names', jsonb_build_array(
      'Push-ups', 'Sit-ups', 'Squats', 'Crunches', 'Lunges'
    ),
    'rotation_index', 0,
    'last_run_on', null
  )
)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.gang_war_division_rank(p_division text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_division
    when 'iron' then 1
    when 'bronze' then 2
    when 'silver' then 3
    when 'gold' then 4
    when 'emerald' then 5
    when 'diamond' then 6
    when 'crystal' then 7
    when 'onyx' then 8
    else null
  end;
$$;

create or replace function public.gang_war_division_from_rank(p_rank integer)
returns text
language sql
immutable
set search_path = public
as $$
  select case greatest(1, least(8, p_rank))
    when 1 then 'iron'
    when 2 then 'bronze'
    when 3 then 'silver'
    when 4 then 'gold'
    when 5 then 'emerald'
    when 6 then 'diamond'
    when 7 then 'crystal'
    else 'onyx'
  end;
$$;

create or replace function public.gang_war_crate_tier(p_division text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_division
    when 'iron' then 'E'
    when 'bronze' then 'E'
    when 'silver' then 'D'
    when 'gold' then 'C'
    when 'emerald' then 'B'
    when 'diamond' then 'A'
    when 'crystal' then 'S'
    when 'onyx' then 'S'
    else 'E'
  end;
$$;

create or replace function public.gang_war_is_bot_gang(p_gang_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.gangs g
    where g.id = p_gang_id
      and g.is_system = true
      and g.war_bot_division is not null
  );
$$;

create or replace function public.gang_war_member_count(p_gang_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when public.gang_war_is_bot_gang(p_gang_id) then 1
    else (
      select count(*)::integer
      from public.gang_members gm
      where gm.gang_id = p_gang_id
    )
  end;
$$;

create or replace function public.gang_war_member_day_contribution(
  p_match_id uuid,
  p_gang_id uuid,
  p_user_id uuid,
  p_day_on date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(s.score), 0)
  from (
    select a.score
    from public.gang_war_attempts a
    where a.match_id = p_match_id
      and a.gang_id = p_gang_id
      and a.user_id = p_user_id
      and a.day_on = p_day_on
    order by a.score desc, a.created_at asc
    limit 2
  ) s;
$$;

create or replace function public.gang_war_human_day_score(
  p_match_id uuid,
  p_gang_id uuid,
  p_day_on date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(public.gang_war_member_day_contribution(
    p_match_id, p_gang_id, u.user_id, p_day_on
  )), 0)
  from (
    select distinct a.user_id
    from public.gang_war_attempts a
    where a.match_id = p_match_id
      and a.gang_id = p_gang_id
      and a.day_on = p_day_on
  ) u;
$$;

create or replace function public.gang_war_bot_day_score(
  p_division text,
  p_day_offset integer
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select t.score
      from public.gang_war_bot_day_targets t
      where t.division = p_division
        and t.day_offset = p_day_offset
    ),
    0
  );
$$;

create or replace function public.gang_war_gang_day_score(
  p_match_id uuid,
  p_gang_id uuid,
  p_day_on date
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_match public.gang_war_matches;
  v_bot_div text;
  v_offset int;
begin
  select * into v_match
  from public.gang_war_matches
  where id = p_match_id;

  if v_match.id is null then
    return 0;
  end if;

  select g.war_bot_division into v_bot_div
  from public.gangs g
  where g.id = p_gang_id;

  if v_bot_div is not null then
    v_offset := (p_day_on - v_match.starts_on);
    if v_offset < 0 or v_offset > 6 then
      return 0;
    end if;
    return public.gang_war_bot_day_score(v_bot_div, v_offset);
  end if;

  return public.gang_war_human_day_score(p_match_id, p_gang_id, p_day_on);
end;
$$;

create or replace function public.gang_war_gang_week_score(
  p_match_id uuid,
  p_gang_id uuid,
  p_through_day date default null
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

  v_end := coalesce(p_through_day, v_match.ends_on);
  if v_end > v_match.ends_on then
    v_end := v_match.ends_on;
  end if;
  if v_end < v_match.starts_on then
    return 0;
  end if;

  v_day := v_match.starts_on;
  while v_day <= v_end loop
    v_total := v_total + public.gang_war_gang_day_score(p_match_id, p_gang_id, v_day);
    v_day := v_day + 1;
  end loop;

  return v_total;
end;
$$;

create or replace function public.gang_war_first_attempt_at(
  p_match_id uuid,
  p_gang_id uuid
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select min(a.created_at)
  from public.gang_war_attempts a
  where a.match_id = p_match_id
    and a.gang_id = p_gang_id;
$$;

-- ----------------------------------------------------------------------------
-- Seed bot day targets (provisional)
-- Iron day = 40 + day*5; each higher division * 1.25^(rank-1)
-- ----------------------------------------------------------------------------
do $$
declare
  v_div text;
  v_rank int;
  v_day int;
  v_base numeric;
  v_score numeric;
begin
  for v_rank, v_div in
    select * from (values
      (1, 'iron'),
      (2, 'bronze'),
      (3, 'silver'),
      (4, 'gold'),
      (5, 'emerald'),
      (6, 'diamond'),
      (7, 'crystal'),
      (8, 'onyx')
    ) as t(rank, div)
  loop
    for v_day in 0..6 loop
      v_base := 40 + (v_day * 5);
      v_score := round(v_base * power(1.25, v_rank - 1), 1);
      insert into public.gang_war_bot_day_targets (division, day_offset, score)
      values (v_div, v_day, v_score)
      on conflict (division, day_offset) do update
        set score = excluded.score;
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Seed war bot gangs
-- ----------------------------------------------------------------------------
do $$
declare
  v_row record;
  v_gang public.gangs;
begin
  for v_row in
    select * from (values
      ('iron', 'Iron Deficiency', 'The rust never sleeps.'),
      ('bronze', 'Bronze Age Bros', 'Primitive gains, modern hustle.'),
      ('silver', 'Silver Spoon Squatters', 'Born with a barbell in their mouth.'),
      ('gold', 'Gold Diggers', 'Chasing the shiny PR.'),
      ('emerald', 'Green Machines', 'Always grinding, always green.'),
      ('diamond', 'Ice Cold Gainz', 'Pressure makes diamonds.'),
      ('crystal', 'Crystal Cartel', 'Faceted form, ruthless reps.'),
      ('onyx', 'Onyx Order', 'Dark stone. Darker work ethic.')
    ) as t(div, name, description)
  loop
    if exists (
      select 1 from public.gangs g
      where g.war_bot_division = v_row.div
    ) then
      continue;
    end if;

    v_gang := public.create_system_gang(
      v_row.name,
      v_row.description,
      'sword-cross',
      'invite_only'
    );

    update public.gangs
    set
      war_division = v_row.div,
      war_bot_division = v_row.div,
      eligible_for_gang_competitions = false
    where id = v_gang.id;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- create_gang: start in Iron
-- ----------------------------------------------------------------------------
create or replace function public.create_gang(
  p_name        text,
  p_description text default null,
  p_icon        text default null,
  p_privacy     text default 'public'
)
returns public.gangs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.gangs (
    name,
    description,
    icon,
    privacy,
    owner_id,
    is_system,
    max_members,
    eligible_for_gang_competitions,
    war_division
  )
  values (
    p_name,
    p_description,
    p_icon,
    coalesce(p_privacy, 'public'),
    auth.uid(),
    false,
    25,
    true,
    'iron'
  )
  returning * into v_gang;

  insert into public.gang_members (gang_id, user_id, role)
  values (v_gang.id, auth.uid(), 'owner');

  return v_gang;
end;
$$;

-- ----------------------------------------------------------------------------
-- Ensure calendar days for a week (advances continuous rotation)
-- ----------------------------------------------------------------------------
create or replace function public.gang_war_ensure_week_days(
  p_week_start date,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb := p_settings;
  v_names jsonb;
  v_len int;
  v_index int;
  v_day date;
  v_name text;
  v_exercise_id uuid;
  v_created int := 0;
begin
  v_names := coalesce(v_settings->'rotation_exercise_names', '[]'::jsonb);
  v_len := jsonb_array_length(v_names);
  if v_len = 0 then
    raise exception 'gang_war_rollover.rotation_exercise_names is empty';
  end if;

  v_index := coalesce((v_settings->>'rotation_index')::int, 0);

  for v_day in select generate_series(p_week_start, p_week_start + 6, '1 day'::interval)::date loop
    if exists (select 1 from public.gang_war_days d where d.day_on = v_day) then
      continue;
    end if;

    v_name := v_names ->> ((v_index % v_len + v_len) % v_len);

    select e.id into v_exercise_id
    from public.exercises e
    where e.name = v_name
       or (v_name = 'Squats' and e.name in ('Squats', 'Bodyweight Squats'))
       or (v_name = 'Bodyweight Squats' and e.name in ('Squats', 'Bodyweight Squats'))
    order by case when e.name = v_name then 0 else 1 end
    limit 1;

    if v_exercise_id is null then
      raise exception 'Gang war exercise not found: %', v_name;
    end if;

    insert into public.gang_war_days (day_on, exercise_id)
    values (v_day, v_exercise_id);

    v_index := v_index + 1;
    v_created := v_created + 1;
  end loop;

  v_settings := jsonb_set(v_settings, '{rotation_index}', to_jsonb(v_index), true);

  return jsonb_build_object(
    'settings', v_settings,
    'days_created', v_created
  );
end;
$$;

revoke execute on function public.gang_war_ensure_week_days(date, jsonb)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Crate grants for winners
-- ----------------------------------------------------------------------------
alter table public.user_reward_crates
  add column if not exists source_match_id uuid references public.gang_war_matches(id) on delete set null;

create unique index if not exists user_reward_crates_war_win_unique
  on public.user_reward_crates (user_id, source_match_id)
  where source = 'gang_war_win' and source_match_id is not null;

create or replace function public.grant_gang_war_win_crates(
  p_match_id uuid,
  p_winner_gang_id uuid,
  p_division text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text := public.gang_war_crate_tier(p_division);
  v_name text := public.reward_rarity_name(v_tier);
  v_member record;
  v_granted int := 0;
begin
  if public.gang_war_is_bot_gang(p_winner_gang_id) then
    return 0;
  end if;

  for v_member in
    select gm.user_id
    from public.gang_members gm
    where gm.gang_id = p_winner_gang_id
  loop
    begin
      insert into public.user_reward_crates (
        user_id,
        source,
        source_date,
        source_match_id,
        status,
        tier,
        title,
        subtitle
      )
      values (
        v_member.user_id,
        'gang_war_win',
        current_date,
        p_match_id,
        'sealed',
        v_tier,
        v_name || ' War Crate',
        'Won Gang Wars in ' || initcap(p_division) || '. Guarantees ' || v_name || ' or better.'
      );
      v_granted := v_granted + 1;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return v_granted;
end;
$$;

revoke execute on function public.grant_gang_war_win_crates(uuid, uuid, text)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Resolve a single match
-- ----------------------------------------------------------------------------
create or replace function public.resolve_gang_war_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.gang_war_matches;
  v_a_score numeric;
  v_b_score numeric;
  v_a_members int;
  v_b_members int;
  v_a_first timestamptz;
  v_b_first timestamptz;
  v_winner uuid;
  v_loser uuid;
  v_winner_rank int;
  v_loser_rank int;
  v_crates int := 0;
begin
  select * into v_match
  from public.gang_war_matches
  where id = p_match_id
  for update;

  if v_match.id is null then
    raise exception 'Match not found';
  end if;

  if v_match.status = 'resolved' then
    return jsonb_build_object('ok', true, 'already_resolved', true, 'match_id', p_match_id);
  end if;

  v_a_score := public.gang_war_gang_week_score(p_match_id, v_match.gang_a_id, v_match.ends_on);
  v_b_score := public.gang_war_gang_week_score(p_match_id, v_match.gang_b_id, v_match.ends_on);
  v_a_members := public.gang_war_member_count(v_match.gang_a_id);
  v_b_members := public.gang_war_member_count(v_match.gang_b_id);
  v_a_first := public.gang_war_first_attempt_at(p_match_id, v_match.gang_a_id);
  v_b_first := public.gang_war_first_attempt_at(p_match_id, v_match.gang_b_id);

  if v_a_score > v_b_score then
    v_winner := v_match.gang_a_id;
  elsif v_b_score > v_a_score then
    v_winner := v_match.gang_b_id;
  elsif v_a_members < v_b_members then
    v_winner := v_match.gang_a_id;
  elsif v_b_members < v_a_members then
    v_winner := v_match.gang_b_id;
  elsif v_a_first is not null and (v_b_first is null or v_a_first < v_b_first) then
    v_winner := v_match.gang_a_id;
  elsif v_b_first is not null and (v_a_first is null or v_b_first < v_a_first) then
    v_winner := v_match.gang_b_id;
  else
    -- Absolute fallback: gang_a wins
    v_winner := v_match.gang_a_id;
  end if;

  v_loser := case
    when v_winner = v_match.gang_a_id then v_match.gang_b_id
    else v_match.gang_a_id
  end;

  update public.gang_war_matches
  set
    status = 'resolved',
    gang_a_score = v_a_score,
    gang_b_score = v_b_score,
    winner_gang_id = v_winner,
    gang_a_member_count = v_a_members,
    gang_b_member_count = v_b_members,
    gang_a_first_attempt_at = v_a_first,
    gang_b_first_attempt_at = v_b_first,
    resolved_at = now()
  where id = p_match_id;

  v_crates := public.grant_gang_war_win_crates(p_match_id, v_winner, v_match.division);

  -- Promote / demote human gangs only
  if not public.gang_war_is_bot_gang(v_winner) then
    v_winner_rank := public.gang_war_division_rank(
      (select war_division from public.gangs where id = v_winner)
    );
    update public.gangs
    set war_division = public.gang_war_division_from_rank(coalesce(v_winner_rank, 1) + 1)
    where id = v_winner;
  end if;

  if not public.gang_war_is_bot_gang(v_loser) then
    v_loser_rank := public.gang_war_division_rank(
      (select war_division from public.gangs where id = v_loser)
    );
    update public.gangs
    set war_division = public.gang_war_division_from_rank(coalesce(v_loser_rank, 1) - 1)
    where id = v_loser;
  end if;

  return jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'winner_gang_id', v_winner,
    'gang_a_score', v_a_score,
    'gang_b_score', v_b_score,
    'crates_granted', v_crates
  );
end;
$$;

revoke execute on function public.resolve_gang_war_match(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_gang_war_match(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- Create matches for a week
-- ----------------------------------------------------------------------------
create or replace function public.create_gang_war_matches_for_week(p_week_start date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_div text;
  v_ids uuid[];
  v_i int;
  v_a uuid;
  v_b uuid;
  v_bot uuid;
  v_created int := 0;
  v_ends date := p_week_start + 6;
begin
  if exists (
    select 1 from public.gang_war_matches m where m.starts_on = p_week_start
  ) then
    return 0;
  end if;

  foreach v_div in array array[
    'iron', 'bronze', 'silver', 'gold', 'emerald', 'diamond', 'crystal', 'onyx'
  ] loop
    select coalesce(array_agg(g.id order by random()), '{}'::uuid[])
    into v_ids
    from public.gangs g
    where coalesce(g.is_system, false) = false
      and coalesce(g.eligible_for_gang_competitions, true) = true
      and g.war_division = v_div
      and exists (
        select 1 from public.gang_members gm where gm.gang_id = g.id
      );

    v_i := 1;
    while v_i <= coalesce(array_length(v_ids, 1), 0) loop
      v_a := v_ids[v_i];
      if v_i + 1 <= array_length(v_ids, 1) then
        v_b := v_ids[v_i + 1];
        v_i := v_i + 2;
      else
        select g.id into v_bot
        from public.gangs g
        where g.war_bot_division = v_div
        limit 1;

        if v_bot is null then
          raise exception 'Missing war bot for division %', v_div;
        end if;

        v_b := v_bot;
        v_i := v_i + 1;
      end if;

      insert into public.gang_war_matches (
        starts_on, ends_on, division, gang_a_id, gang_b_id, status
      )
      values (
        p_week_start, v_ends, v_div, v_a, v_b, 'active'
      );

      v_created := v_created + 1;
    end loop;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.create_gang_war_matches_for_week(date)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Rollover
-- ----------------------------------------------------------------------------
create or replace function public.rollover_gang_wars(p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_timezone text;
  v_local_now timestamp;
  v_local_date date;
  v_dow int;
  v_hour int;
  v_last_run date;
  v_week_start date;
  v_resolved int := 0;
  v_created int := 0;
  v_days jsonb;
  v_match record;
begin
  select value into v_settings
  from public.app_settings
  where key = 'gang_war_rollover';

  if v_settings is null then
    raise exception 'gang_war_rollover settings missing';
  end if;

  v_timezone := coalesce(v_settings->>'timezone', 'America/New_York');
  v_local_now := timezone(v_timezone, now());
  v_local_date := v_local_now::date;
  v_dow := extract(isodow from v_local_now)::int;
  v_hour := extract(hour from v_local_now)::int;
  v_last_run := nullif(v_settings->>'last_run_on', '')::date;

  if not p_force then
    if v_dow <> coalesce((v_settings->>'day_of_week')::int, 1) then
      return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'wrong_day');
    end if;
    if v_hour <> coalesce((v_settings->>'local_hour')::int, 2) then
      return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'wrong_hour');
    end if;
    if v_last_run = v_local_date then
      return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_ran_today');
    end if;
  end if;

  -- Resolve expired active matches
  for v_match in
    select m.id
    from public.gang_war_matches m
    where m.status = 'active'
      and m.ends_on < v_local_date
  loop
    perform public.resolve_gang_war_match(v_match.id);
    v_resolved := v_resolved + 1;
  end loop;

  v_week_start := v_local_date - ((extract(isodow from v_local_date)::int) - 1);

  v_days := public.gang_war_ensure_week_days(v_week_start, v_settings);
  v_settings := v_days->'settings';

  v_created := public.create_gang_war_matches_for_week(v_week_start);

  v_settings := jsonb_set(
    v_settings,
    '{last_run_on}',
    to_jsonb(v_local_date::text),
    true
  );

  update public.app_settings
  set
    value = v_settings,
    updated_at = now()
  where key = 'gang_war_rollover';

  return jsonb_build_object(
    'ok', true,
    'local_date', v_local_date,
    'timezone', v_timezone,
    'resolved', v_resolved,
    'matches_created', v_created,
    'days_created', coalesce((v_days->>'days_created')::int, 0),
    'week_starts_on', v_week_start
  );
end;
$$;

revoke execute on function public.rollover_gang_wars(boolean)
  from public, anon, authenticated;
grant execute on function public.rollover_gang_wars(boolean)
  to service_role;

-- ----------------------------------------------------------------------------
-- Submit attempt
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

  return jsonb_build_object(
    'ok', true,
    'attempt_id', v_attempt.id,
    'score_submitted', v_attempt.score,
    'day_on', v_local_date,
    'member_day_contribution', v_contribution,
    'gang_day_score', public.gang_war_gang_day_score(p_match_id, p_gang_id, v_local_date),
    'gang_week_score', public.gang_war_gang_week_score(p_match_id, p_gang_id, v_local_date)
  );
end;
$$;

revoke execute on function public.submit_gang_war_attempt(uuid, uuid, numeric)
  from public, anon;
grant execute on function public.submit_gang_war_attempt(uuid, uuid, numeric)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Mark seen flags
-- ----------------------------------------------------------------------------
create or replace function public.mark_gang_war_seen(
  p_match_id uuid,
  p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_kind not in ('vs', 'result') then
    raise exception 'kind must be vs or result';
  end if;

  insert into public.gang_war_user_seen (user_id, match_id)
  values (v_user_id, p_match_id)
  on conflict (user_id, match_id) do nothing;

  if p_kind = 'vs' then
    update public.gang_war_user_seen
    set vs_seen_at = coalesce(vs_seen_at, now())
    where user_id = v_user_id
      and match_id = p_match_id;
  else
    update public.gang_war_user_seen
    set result_seen_at = coalesce(result_seen_at, now())
    where user_id = v_user_id
      and match_id = p_match_id;
  end if;

  return jsonb_build_object('ok', true, 'match_id', p_match_id, 'kind', p_kind);
end;
$$;

revoke execute on function public.mark_gang_war_seen(uuid, text)
  from public, anon;
grant execute on function public.mark_gang_war_seen(uuid, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Client read helpers
-- ----------------------------------------------------------------------------
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

create or replace function public.get_gang_war_history(p_gang_id uuid, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows jsonb := '[]'::jsonb;
  v_match record;
  v_opp public.gangs;
  v_ours_score numeric;
  v_theirs_score numeric;
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

  for v_match in
    select *
    from public.gang_war_matches m
    where m.status = 'resolved'
      and (m.gang_a_id = p_gang_id or m.gang_b_id = p_gang_id)
    order by m.ends_on desc
    limit greatest(1, least(coalesce(p_limit, 20), 50))
  loop
    if v_match.gang_a_id = p_gang_id then
      select * into v_opp from public.gangs where id = v_match.gang_b_id;
      v_ours_score := v_match.gang_a_score;
      v_theirs_score := v_match.gang_b_score;
    else
      select * into v_opp from public.gangs where id = v_match.gang_a_id;
      v_ours_score := v_match.gang_b_score;
      v_theirs_score := v_match.gang_a_score;
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'match_id', v_match.id,
      'starts_on', v_match.starts_on,
      'ends_on', v_match.ends_on,
      'division', v_match.division,
      'won', v_match.winner_gang_id = p_gang_id,
      'our_score', v_ours_score,
      'their_score', v_theirs_score,
      'opponent_name', v_opp.name,
      'opponent_is_bot', v_opp.war_bot_division is not null
    ));
  end loop;

  return jsonb_build_object('ok', true, 'history', v_rows);
end;
$$;

revoke execute on function public.get_gang_war_history(uuid, integer) from public, anon;
grant execute on function public.get_gang_war_history(uuid, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- Bootstrap + cron
-- ----------------------------------------------------------------------------
select public.rollover_gang_wars(true);

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'rollover-gang-wars';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
exception
  when undefined_table then
    null;
  when undefined_function then
    null;
end $$;

select cron.schedule(
  'rollover-gang-wars',
  '5 * * * *',
  $$select public.rollover_gang_wars(false)$$
);
