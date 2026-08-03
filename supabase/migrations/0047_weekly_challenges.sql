-- ============================================================================
-- Weekly challenges
-- - Global rotating max-effort challenges (camera-verified in app)
-- - Best-score entries; first attempt each week grants XP
-- - Monday 2 AM ET rollover via pg_cron (same pattern as weekly plans)
-- Requires 0046_challenge_attempt_xp_kind.sql (committed enum value)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- XP awards: link to weekly challenges
-- ----------------------------------------------------------------------------
alter table public.xp_awards
  add column if not exists weekly_challenge_id uuid;

-- ----------------------------------------------------------------------------
-- SCHEMA
-- ----------------------------------------------------------------------------
create table if not exists public.challenge_types (
  id                  uuid primary key default gen_random_uuid(),
  exercise_id         uuid not null references public.exercises(id),
  slug                text not null unique,
  name                text not null,
  description         text not null,
  mode                text not null check (mode in ('timed_reps', 'max_hold')),
  time_limit_seconds  integer check (time_limit_seconds is null or time_limit_seconds > 0),
  unit                text not null check (unit in ('reps', 'seconds')),
  sort_order          smallint not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  constraint challenge_types_mode_limit_ck check (
    (mode = 'timed_reps' and time_limit_seconds is not null and unit = 'reps')
    or (mode = 'max_hold' and time_limit_seconds is null and unit = 'seconds')
  )
);

create table if not exists public.weekly_challenges (
  id                 uuid primary key default gen_random_uuid(),
  challenge_type_id  uuid not null references public.challenge_types(id),
  starts_on          date not null,
  ends_on            date not null,
  status             text not null default 'active'
                       check (status in ('active', 'completed')),
  created_at         timestamptz not null default now(),
  constraint weekly_challenges_range_ck check (ends_on >= starts_on)
);

create unique index if not exists weekly_challenges_starts_on_uidx
  on public.weekly_challenges (starts_on);

create unique index if not exists weekly_challenges_one_active_uidx
  on public.weekly_challenges ((1))
  where status = 'active';

create index if not exists weekly_challenges_status_ends_idx
  on public.weekly_challenges (status, ends_on);

create table if not exists public.challenge_entries (
  id                   uuid primary key default gen_random_uuid(),
  weekly_challenge_id  uuid not null references public.weekly_challenges(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  best_score           numeric(10, 1) not null check (best_score >= 0),
  attempt_count        integer not null default 1 check (attempt_count > 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (weekly_challenge_id, user_id)
);

create index if not exists challenge_entries_challenge_score_idx
  on public.challenge_entries (weekly_challenge_id, best_score desc);

-- FK for xp_awards now that weekly_challenges exists
do $$
begin
  alter table public.xp_awards
    drop constraint if exists xp_awards_weekly_challenge_id_fkey;
  alter table public.xp_awards
    add constraint xp_awards_weekly_challenge_id_fkey
    foreign key (weekly_challenge_id)
    references public.weekly_challenges(id)
    on delete cascade;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists xp_awards_challenge_attempt_unique
  on public.xp_awards (user_id, weekly_challenge_id)
  where kind = 'challenge_attempt' and weekly_challenge_id is not null;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.challenge_types enable row level security;
alter table public.weekly_challenges enable row level security;
alter table public.challenge_entries enable row level security;

drop policy if exists "challenge_types_select_authenticated" on public.challenge_types;
create policy "challenge_types_select_authenticated" on public.challenge_types
  for select to authenticated using (true);

drop policy if exists "weekly_challenges_select_authenticated" on public.weekly_challenges;
create policy "weekly_challenges_select_authenticated" on public.weekly_challenges
  for select to authenticated using (true);

drop policy if exists "challenge_entries_select_authenticated" on public.challenge_entries;
create policy "challenge_entries_select_authenticated" on public.challenge_entries
  for select to authenticated using (true);

-- Writes go through security definer RPCs only
revoke insert, update, delete on public.challenge_types from authenticated, anon;
revoke insert, update, delete on public.weekly_challenges from authenticated, anon;
revoke insert, update, delete on public.challenge_entries from authenticated, anon;

grant select on public.challenge_types to authenticated;
grant select on public.weekly_challenges to authenticated;
grant select on public.challenge_entries to authenticated;

-- ----------------------------------------------------------------------------
-- Seed challenge types (camera-supported exercises)
-- ----------------------------------------------------------------------------
insert into public.challenge_types (
  exercise_id, slug, name, description, mode, time_limit_seconds, unit, sort_order
)
select e.id, v.slug, v.name, v.description, v.mode, v.time_limit_seconds, v.unit, v.sort_order
from (values
  (
    'pushups_60',
    'Push-up Challenge',
    'Complete as many push-ups as you can in 60 seconds.',
    'timed_reps',
    60,
    'reps',
    0,
    'Push-ups'
  ),
  (
    'situps_60',
    'Sit-up Challenge',
    'Complete as many sit-ups as you can in 60 seconds.',
    'timed_reps',
    60,
    'reps',
    1,
    'Sit-ups'
  ),
  (
    'plank_max',
    'Plank Challenge',
    'Hold a plank for as long as you can.',
    'max_hold',
    null::integer,
    'seconds',
    2,
    'Plank'
  ),
  (
    'squats_60',
    'Squat Challenge',
    'Complete as many squats as you can in 60 seconds.',
    'timed_reps',
    60,
    'reps',
    3,
    'Bodyweight Squats'
  ),
  (
    'crunches_60',
    'Crunch Challenge',
    'Complete as many crunches as you can in 60 seconds.',
    'timed_reps',
    60,
    'reps',
    4,
    'Crunches'
  )
) as v(slug, name, description, mode, time_limit_seconds, unit, sort_order, exercise_name)
join public.exercises e on e.name = v.exercise_name
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  mode = excluded.mode,
  time_limit_seconds = excluded.time_limit_seconds,
  unit = excluded.unit,
  sort_order = excluded.sort_order,
  exercise_id = excluded.exercise_id,
  active = true;

-- ----------------------------------------------------------------------------
-- Settings
-- ----------------------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'weekly_challenge_rollover',
  jsonb_build_object(
    'timezone', 'America/New_York',
    'local_hour', 2,
    'local_minute', 0,
    'day_of_week', 1,
    'first_attempt_xp', 25,
    'rotation_slugs', jsonb_build_array(
      'pushups_60', 'situps_60', 'plank_max', 'squats_60', 'crunches_60'
    ),
    'rotation_index', 0,
    'last_run_on', null
  )
)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.challenge_type_for_rotation_index(
  p_settings jsonb,
  p_index integer
)
returns public.challenge_types
language plpgsql
stable
set search_path = public
as $$
declare
  v_slugs jsonb;
  v_len int;
  v_slug text;
  v_type public.challenge_types;
begin
  v_slugs := coalesce(p_settings->'rotation_slugs', '[]'::jsonb);
  v_len := jsonb_array_length(v_slugs);
  if v_len = 0 then
    raise exception 'weekly_challenge_rollover.rotation_slugs is empty';
  end if;

  v_slug := v_slugs ->> ((p_index % v_len + v_len) % v_len);

  select * into v_type
  from public.challenge_types
  where slug = v_slug and active = true;

  if v_type.id is null then
    raise exception 'Challenge type not found for slug %', v_slug;
  end if;

  return v_type;
end;
$$;

revoke execute on function public.challenge_type_for_rotation_index(jsonb, integer)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Submit attempt (best score only + first-attempt XP)
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

  -- First attempt of the week: grant XP (idempotent via unique index)
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

  return jsonb_build_object(
    'ok', true,
    'accepted', v_accepted,
    'is_first_attempt', v_is_first,
    'previous_best', v_previous,
    'best_score', v_entry.best_score,
    'attempt_count', v_entry.attempt_count,
    'score_submitted', round(p_score, 1),
    'unit', v_type.unit,
    'xp_awarded', case when v_xp_awarded then v_xp else 0 end
  );
end;
$$;

revoke execute on function public.submit_challenge_attempt(uuid, numeric)
  from public, anon;
grant execute on function public.submit_challenge_attempt(uuid, numeric)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Rollover (Monday local-time job)
-- ----------------------------------------------------------------------------
create or replace function public.rollover_weekly_challenges(p_force boolean default false)
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
  v_index int;
  v_type public.challenge_types;
  v_week_start date;
  v_created boolean := false;
  v_completed int := 0;
  v_challenge public.weekly_challenges;
begin
  select value into v_settings
  from public.app_settings
  where key = 'weekly_challenge_rollover';

  if v_settings is null then
    raise exception 'weekly_challenge_rollover settings missing';
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

  -- Close expired active challenges
  update public.weekly_challenges
  set status = 'completed'
  where status = 'active'
    and ends_on < v_local_date;

  get diagnostics v_completed = row_count;

  -- ISO Monday of the current local week
  v_week_start := v_local_date - ((extract(isodow from v_local_date)::int) - 1);

  if not exists (
    select 1
    from public.weekly_challenges
    where starts_on = v_week_start
  ) then
    v_index := coalesce((v_settings->>'rotation_index')::int, 0);
    v_type := public.challenge_type_for_rotation_index(v_settings, v_index);

    insert into public.weekly_challenges (
      challenge_type_id, starts_on, ends_on, status
    )
    values (
      v_type.id,
      v_week_start,
      v_week_start + 6,
      'active'
    )
    returning * into v_challenge;

    v_settings := jsonb_set(
      v_settings,
      '{rotation_index}',
      to_jsonb(v_index + 1),
      true
    );
    v_created := true;
  end if;

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
  where key = 'weekly_challenge_rollover';

  return jsonb_build_object(
    'ok', true,
    'local_date', v_local_date,
    'timezone', v_timezone,
    'completed', v_completed,
    'created', v_created,
    'weekly_challenge_id', v_challenge.id,
    'challenge_type_slug', v_type.slug,
    'starts_on', v_challenge.starts_on,
    'ends_on', v_challenge.ends_on
  );
end;
$$;

revoke execute on function public.rollover_weekly_challenges(boolean)
  from public, anon, authenticated;
grant execute on function public.rollover_weekly_challenges(boolean)
  to service_role;

-- Bootstrap current week immediately (force)
select public.rollover_weekly_challenges(true);

-- ----------------------------------------------------------------------------
-- pg_cron: check hourly; function enforces Mon 2 AM in configured timezone
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'rollover-weekly-challenges';
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
  'rollover-weekly-challenges',
  '5 * * * *',
  $$select public.rollover_weekly_challenges(false)$$
);
