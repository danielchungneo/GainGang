-- ============================================================================
-- GainGang — Update an active weekly plan in place
-- ============================================================================

create or replace function public.update_weekly_plan(
  p_plan_id uuid,
  p_days    jsonb
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

  if not public.is_gang_admin(v_plan.gang_id) then
    raise exception 'Only gang admins can edit weekly plans';
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

  return v_plan;
end;
$$;

revoke execute on function public.update_weekly_plan(uuid, jsonb) from public, anon;
grant  execute on function public.update_weekly_plan(uuid, jsonb) to authenticated;
