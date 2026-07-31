-- Soft-visibility for the exercise catalog: inactive rows stay in the DB
-- (and on existing plans) but are hidden from weekly-plan pickers until enabled.

alter table public.exercises
  add column if not exists active boolean not null default true;

comment on column public.exercises.active is
  'When false, exercise is hidden from weekly planning pickers and cannot be newly assigned. Existing plan slots keep working.';

create index if not exists exercises_category_active_idx
  on public.exercises (category, active);

-- ----------------------------------------------------------------------------
-- create_weekly_plan: only allow active catalog exercises
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
  v_ex_id  uuid;
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
      v_ex_id := (v_ex->>'exercise_id')::uuid;

      if not exists (
        select 1 from public.exercises e
        where e.id = v_ex_id and e.active
      ) then
        raise exception 'Exercise % is not available for planning', v_ex_id;
      end if;

      insert into public.daily_goal_exercises (
        daily_goal_id,
        exercise_id,
        unit,
        individual_target,
        sort_order
      )
      select
        v_goal.id,
        v_ex_id,
        e.unit,
        (v_ex->>'individual_target')::numeric(10, 1),
        v_sort
      from public.exercises e
      where e.id = v_ex_id;

      v_sort := v_sort + 1;
    end loop;
  end loop;

  return v_plan;
end;
$$;

revoke execute on function public.create_weekly_plan(uuid, date, jsonb) from public, anon, authenticated;
revoke execute on function public.create_weekly_plan(uuid, date, jsonb, boolean) from public, anon;
grant  execute on function public.create_weekly_plan(uuid, date, jsonb, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- update_weekly_plan: active exercises, or ones already on the day (grandfathered)
-- ----------------------------------------------------------------------------
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
  v_ex_id  uuid;
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
      v_ex_id := (v_ex->>'exercise_id')::uuid;

      if not exists (
        select 1 from public.exercises e
        where e.id = v_ex_id
          and (
            e.active
            or exists (
              select 1
              from public.daily_goal_exercises dge
              where dge.daily_goal_id = v_goal.id
                and dge.exercise_id = e.id
            )
          )
      ) then
        raise exception 'Exercise % is not available for planning', v_ex_id;
      end if;

      insert into public.daily_goal_exercises (
        daily_goal_id,
        exercise_id,
        unit,
        individual_target,
        sort_order
      )
      select
        v_goal.id,
        v_ex_id,
        e.unit,
        (v_ex->>'individual_target')::numeric(10, 1),
        v_sort
      from public.exercises e
      where e.id = v_ex_id
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
