-- Auto-grant a sealed daily reward crate when the user finishes all daily goals.
-- No manual claim step — the crate appears in inventory immediately.

-- ----------------------------------------------------------------------------
-- Idempotent grant helper. Returns the crate when granted/already exists,
-- or null when the day is not yet complete.
-- ----------------------------------------------------------------------------
create or replace function public.try_grant_daily_reward_crate(
  p_user_id uuid,
  p_reward_date date
)
returns public.user_reward_crates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crate public.user_reward_crates;
begin
  if p_user_id is null or p_reward_date is null then
    return null;
  end if;

  select *
  into v_crate
  from public.user_reward_crates
  where user_id = p_user_id
    and source = 'daily_completion'
    and source_date = p_reward_date;

  if found then
    return v_crate;
  end if;

  if not public.user_completed_daily_goals(p_user_id, p_reward_date) then
    return null;
  end if;

  begin
    insert into public.user_reward_crates (
      user_id,
      source,
      source_date,
      status,
      tier,
      title,
      subtitle
    )
    values (
      p_user_id,
      'daily_completion',
      p_reward_date,
      'sealed',
      'aura',
      'Daily Reward Crate',
      'Earned by clearing every exercise for the day.'
    )
    returning * into v_crate;

    return v_crate;
  exception
    when unique_violation then
      select *
      into v_crate
      from public.user_reward_crates
      where user_id = p_user_id
        and source = 'daily_completion'
        and source_date = p_reward_date;
      return v_crate;
  end;
end;
$$;

revoke execute on function public.try_grant_daily_reward_crate(uuid, date)
  from public, anon, authenticated;

-- Keep claim_daily_reward as a thin authenticated wrapper (idempotent).
create or replace function public.claim_daily_reward(p_reward_date date default current_date)
returns public.user_reward_crates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_crate public.user_reward_crates;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_reward_date is null then
    raise exception 'Reward date is required';
  end if;

  v_crate := public.try_grant_daily_reward_crate(v_user_id, p_reward_date);

  if v_crate.id is null then
    raise exception 'Complete all daily exercises before claiming your reward';
  end if;

  return v_crate;
end;
$$;

revoke execute on function public.claim_daily_reward(date) from public, anon;
grant execute on function public.claim_daily_reward(date) to authenticated;

-- ----------------------------------------------------------------------------
-- After logging progress toward a daily goal exercise, auto-grant if complete.
-- ----------------------------------------------------------------------------
create or replace function public.auto_grant_daily_reward_from_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_date date;
begin
  if new.daily_goal_exercise_id is null then
    return new;
  end if;

  select
    a.user_id,
    coalesce(a.activity_date, (timezone('utc', a.created_at))::date)
  into v_user_id, v_date
  from public.activities a
  where a.id = new.activity_id;

  if v_user_id is null or v_date is null then
    return new;
  end if;

  perform public.try_grant_daily_reward_crate(v_user_id, v_date);
  return new;
end;
$$;

drop trigger if exists trg_auto_grant_daily_reward_ins on public.activity_exercises;
create trigger trg_auto_grant_daily_reward_ins
  after insert on public.activity_exercises
  for each row
  execute function public.auto_grant_daily_reward_from_activity();

drop trigger if exists trg_auto_grant_daily_reward_upd on public.activity_exercises;
create trigger trg_auto_grant_daily_reward_upd
  after update of amount, daily_goal_exercise_id on public.activity_exercises
  for each row
  execute function public.auto_grant_daily_reward_from_activity();
