-- ============================================================================
-- Adaptive weekly plan rollover
-- - is_adaptive flag on weekly_plans
-- - Configurable bump caps / schedule via app_settings
-- - Monday local-time job via pg_cron that copies or bumps next week
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SCHEMA
-- ----------------------------------------------------------------------------
alter table public.weekly_plans
  add column if not exists is_adaptive boolean not null default false;

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated" on public.app_settings
  for select to authenticated using (true);

insert into public.app_settings (key, value)
values (
  'weekly_plan_rollover',
  jsonb_build_object(
    'timezone', 'America/New_York',
    'local_hour', 2,
    'local_minute', 0,
    'day_of_week', 1,
    'bump_reps', 5,
    'bump_seconds', 30,
    'bump_miles', 0.5,
    'cap_reps', 100,
    'cap_seconds', 300,
    'cap_miles', 5,
    'last_run_on', null
  )
)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- HELPERS
-- ----------------------------------------------------------------------------
create or replace function public.is_gang_owner(p_gang_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.gangs
    where id = p_gang_id and owner_id = p_user_id
  );
$$;

revoke execute on function public.is_gang_owner(uuid, uuid) from public, anon;
grant  execute on function public.is_gang_owner(uuid, uuid) to authenticated;

create or replace function public.gang_member_count_on_date(
  p_gang_id uuid,
  p_on_date date,
  p_timezone text default 'America/New_York'
)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.gang_members gm
  where gm.gang_id = p_gang_id
    and (gm.joined_at at time zone p_timezone)::date <= p_on_date;
$$;

revoke execute on function public.gang_member_count_on_date(uuid, date, text) from public, anon;
grant  execute on function public.gang_member_count_on_date(uuid, date, text) to authenticated;

create or replace function public.weekly_plan_gang_completed(
  p_plan_id uuid,
  p_timezone text default 'America/New_York'
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.daily_goal_exercises dge
    join public.daily_goals dg on dg.id = dge.daily_goal_id
    join public.weekly_plans wp on wp.id = dg.weekly_plan_id
    where dg.weekly_plan_id = p_plan_id
      and coalesce((
        select sum(ae.amount)
        from public.activity_exercises ae
        where ae.daily_goal_exercise_id = dge.id
      ), 0) < (
        dge.individual_target
        * greatest(public.gang_member_count_on_date(wp.gang_id, dg.goal_date, p_timezone), 1)
      )
  );
$$;

revoke execute on function public.weekly_plan_gang_completed(uuid, text) from public, anon;
grant  execute on function public.weekly_plan_gang_completed(uuid, text) to authenticated;

create or replace function public.adaptive_target_for_unit(
  p_unit text,
  p_current numeric,
  p_settings jsonb
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_bumped numeric;
  v_cap numeric;
begin
  if p_unit = 'reps' then
    v_bumped := p_current + coalesce((p_settings->>'bump_reps')::numeric, 5);
    v_cap := coalesce((p_settings->>'cap_reps')::numeric, 100);
  elsif p_unit = 'seconds' then
    v_bumped := p_current + coalesce((p_settings->>'bump_seconds')::numeric, 30);
    v_cap := coalesce((p_settings->>'cap_seconds')::numeric, 300);
  elsif p_unit = 'miles' then
    v_bumped := p_current + coalesce((p_settings->>'bump_miles')::numeric, 0.5);
    v_cap := coalesce((p_settings->>'cap_miles')::numeric, 5);
  else
    return p_current;
  end if;

  return least(v_bumped, v_cap);
end;
$$;

-- ----------------------------------------------------------------------------
-- CREATE / UPDATE weekly plans (owner-only + is_adaptive)
-- ----------------------------------------------------------------------------
create or replace function public.create_weekly_plan(
  p_gang_id     uuid,
  p_starts_on   date,
  p_days        jsonb,
  p_is_adaptive boolean default false
)
returns public.weekly_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan   public.weekly_plans;
  v_day    jsonb;
  v_ex     jsonb;
  v_goal   public.daily_goals;
  v_sort   smallint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_gang_owner(p_gang_id) then
    raise exception 'Only the gang creator can create weekly plans';
  end if;

  update public.weekly_plans
  set status = 'completed'
  where gang_id = p_gang_id and status = 'active';

  insert into public.weekly_plans (gang_id, starts_on, ends_on, is_adaptive)
  values (p_gang_id, p_starts_on, p_starts_on + 6, coalesce(p_is_adaptive, false))
  returning * into v_plan;

  for v_day in select * from jsonb_array_elements(p_days)
  loop
    insert into public.daily_goals (
      weekly_plan_id, day_of_week, title, day_category, goal_date
    )
    values (
      v_plan.id,
      (v_day->>'day_of_week')::smallint,
      coalesce(v_day->>'title', ''),
      nullif(v_day->>'day_category', '')::text,
      p_starts_on + ((v_day->>'day_of_week')::int - 1)
    )
    returning * into v_goal;

    v_sort := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      insert into public.daily_goal_exercises (
        daily_goal_id,
        exercise_id,
        unit,
        individual_target,
        sort_order
      )
      select
        v_goal.id,
        (v_ex->>'exercise_id')::uuid,
        e.unit,
        (v_ex->>'individual_target')::numeric(10, 1),
        v_sort
      from public.exercises e
      where e.id = (v_ex->>'exercise_id')::uuid;

      v_sort := v_sort + 1;
    end loop;
  end loop;

  return v_plan;
end;
$$;

revoke execute on function public.create_weekly_plan(uuid, date, jsonb) from public, anon, authenticated;
revoke execute on function public.create_weekly_plan(uuid, date, jsonb, boolean) from public, anon;
grant  execute on function public.create_weekly_plan(uuid, date, jsonb, boolean) to authenticated;

create or replace function public.update_weekly_plan(
  p_plan_id     uuid,
  p_days        jsonb,
  p_is_adaptive boolean default null
)
returns public.weekly_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan   public.weekly_plans;
  v_day    jsonb;
  v_ex     jsonb;
  v_goal   public.daily_goals;
  v_sort   smallint;
  v_ex_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_plan
  from public.weekly_plans
  where id = p_plan_id and status = 'active';

  if v_plan.id is null then
    raise exception 'Active weekly plan not found';
  end if;

  if not public.is_gang_owner(v_plan.gang_id) then
    raise exception 'Only the gang creator can edit weekly plans';
  end if;

  if p_is_adaptive is not null then
    update public.weekly_plans
    set is_adaptive = p_is_adaptive
    where id = p_plan_id
    returning * into v_plan;
  end if;

  for v_day in select * from jsonb_array_elements(p_days)
  loop
    select * into v_goal
    from public.daily_goals
    where weekly_plan_id = p_plan_id
      and day_of_week = (v_day->>'day_of_week')::smallint;

    if v_goal.id is null then
      insert into public.daily_goals (
        weekly_plan_id, day_of_week, title, day_category, goal_date
      )
      values (
        p_plan_id,
        (v_day->>'day_of_week')::smallint,
        coalesce(v_day->>'title', ''),
        nullif(v_day->>'day_category', '')::text,
        v_plan.starts_on + ((v_day->>'day_of_week')::int - 1)
      )
      returning * into v_goal;
    else
      update public.daily_goals
      set
        title = coalesce(v_day->>'title', ''),
        day_category = nullif(v_day->>'day_category', '')::text
      where id = v_goal.id;
    end if;

    select coalesce(array_agg((elem->>'exercise_id')::uuid), '{}')
    into v_ex_ids
    from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb)) elem;

    delete from public.daily_goal_exercises dge
    where dge.daily_goal_id = v_goal.id
      and (cardinality(v_ex_ids) = 0 or dge.exercise_id <> all(v_ex_ids));

    v_sort := 0;
    for v_ex in select * from jsonb_array_elements(coalesce(v_day->'exercises', '[]'::jsonb))
    loop
      insert into public.daily_goal_exercises (
        daily_goal_id,
        exercise_id,
        unit,
        individual_target,
        sort_order
      )
      select
        v_goal.id,
        (v_ex->>'exercise_id')::uuid,
        e.unit,
        (v_ex->>'individual_target')::numeric(10, 1),
        v_sort
      from public.exercises e
      where e.id = (v_ex->>'exercise_id')::uuid
      on conflict (daily_goal_id, exercise_id) do update
      set
        unit = excluded.unit,
        individual_target = excluded.individual_target,
        sort_order = excluded.sort_order;

      v_sort := v_sort + 1;
    end loop;
  end loop;

  select * into v_plan from public.weekly_plans where id = p_plan_id;
  return v_plan;
end;
$$;

revoke execute on function public.update_weekly_plan(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.update_weekly_plan(uuid, jsonb, boolean) from public, anon;
grant  execute on function public.update_weekly_plan(uuid, jsonb, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- ROLLOVER JOB
-- ----------------------------------------------------------------------------
create or replace function public.rollover_weekly_plans(p_force boolean default false)
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
  v_plan public.weekly_plans;
  v_new_plan public.weekly_plans;
  v_next_starts date;
  v_completed boolean;
  v_should_bump boolean;
  v_old_goal public.daily_goals;
  v_new_goal public.daily_goals;
  v_ex record;
  v_target numeric;
  v_created int := 0;
  v_skipped int := 0;
  v_bumped int := 0;
  v_copied int := 0;
begin
  select value into v_settings
  from public.app_settings
  where key = 'weekly_plan_rollover';

  if v_settings is null then
    raise exception 'weekly_plan_rollover settings missing';
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
    -- Allow the whole configured hour (cron runs hourly).
    if v_last_run = v_local_date then
      return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_ran_today');
    end if;
  end if;

  for v_plan in
    select *
    from public.weekly_plans
    where status = 'active'
      and ends_on < v_local_date
    order by ends_on asc
  loop
    v_next_starts := v_plan.ends_on + 1;

    if exists (
      select 1
      from public.weekly_plans wp
      where wp.gang_id = v_plan.gang_id
        and wp.starts_on = v_next_starts
        and wp.id <> v_plan.id
    ) then
      update public.weekly_plans
      set status = case
        when public.weekly_plan_gang_completed(v_plan.id, v_timezone) then 'completed'
        else 'failed'
      end
      where id = v_plan.id;

      -- Promote the pre-created next plan if it isn't active yet.
      update public.weekly_plans
      set status = 'active'
      where gang_id = v_plan.gang_id
        and starts_on = v_next_starts
        and status <> 'active'
        and not exists (
          select 1 from public.weekly_plans x
          where x.gang_id = v_plan.gang_id and x.status = 'active'
        );

      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_completed := public.weekly_plan_gang_completed(v_plan.id, v_timezone);
    v_should_bump := v_plan.is_adaptive and v_completed;

    update public.weekly_plans
    set status = case when v_completed then 'completed' else 'failed' end
    where id = v_plan.id;

    insert into public.weekly_plans (gang_id, starts_on, ends_on, status, is_adaptive)
    values (
      v_plan.gang_id,
      v_next_starts,
      v_next_starts + 6,
      'active',
      v_plan.is_adaptive
    )
    returning * into v_new_plan;

    for v_old_goal in
      select * from public.daily_goals
      where weekly_plan_id = v_plan.id
      order by day_of_week
    loop
      insert into public.daily_goals (
        weekly_plan_id, day_of_week, title, day_category, goal_date
      )
      values (
        v_new_plan.id,
        v_old_goal.day_of_week,
        v_old_goal.title,
        v_old_goal.day_category,
        v_next_starts + (v_old_goal.day_of_week - 1)
      )
      returning * into v_new_goal;

      for v_ex in
        select *
        from public.daily_goal_exercises
        where daily_goal_id = v_old_goal.id
        order by sort_order, id
      loop
        if v_should_bump then
          v_target := public.adaptive_target_for_unit(v_ex.unit, v_ex.individual_target, v_settings);
        else
          v_target := v_ex.individual_target;
        end if;

        insert into public.daily_goal_exercises (
          daily_goal_id, exercise_id, unit, individual_target, sort_order
        )
        values (
          v_new_goal.id,
          v_ex.exercise_id,
          v_ex.unit,
          v_target,
          v_ex.sort_order
        );
      end loop;
    end loop;

    v_created := v_created + 1;
    if v_should_bump then
      v_bumped := v_bumped + 1;
    else
      v_copied := v_copied + 1;
    end if;
  end loop;

  update public.app_settings
  set
    value = jsonb_set(value, '{last_run_on}', to_jsonb(v_local_date::text), true),
    updated_at = now()
  where key = 'weekly_plan_rollover';

  return jsonb_build_object(
    'ok', true,
    'local_date', v_local_date,
    'timezone', v_timezone,
    'created', v_created,
    'bumped', v_bumped,
    'copied', v_copied,
    'skipped_existing', v_skipped
  );
end;
$$;

revoke execute on function public.rollover_weekly_plans(boolean) from public, anon, authenticated;
grant  execute on function public.rollover_weekly_plans(boolean) to service_role;

-- ----------------------------------------------------------------------------
-- pg_cron: check hourly; function enforces Mon 2 AM in configured timezone
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'rollover-weekly-plans';
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
  'rollover-weekly-plans',
  '5 * * * *',
  $$select public.rollover_weekly_plans(false)$$
);
