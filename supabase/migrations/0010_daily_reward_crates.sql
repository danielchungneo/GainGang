-- Daily reward crates: claim a sealed crate when all of today's personal
-- daily-goal exercises are complete, store it in inventory, and open later.

create type public.reward_crate_status as enum ('sealed', 'opened');
create type public.reward_crate_source as enum ('daily_completion');

create table if not exists public.user_reward_crates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  source       public.reward_crate_source not null default 'daily_completion',
  source_date  date not null,
  status       public.reward_crate_status not null default 'sealed',
  tier         text not null default 'aura'
                 check (tier in ('aura', 'E', 'D', 'C', 'B', 'A', 'S')),
  title        text not null default 'Daily Reward Crate',
  subtitle     text,
  contents     jsonb,
  claimed_at   timestamptz not null default now(),
  opened_at    timestamptz,
  created_at   timestamptz not null default now(),
  constraint user_reward_crates_opened_at_check
    check (
      (status = 'sealed' and opened_at is null)
      or (status = 'opened' and opened_at is not null)
    )
);

-- One daily-completion crate per user per calendar day.
create unique index if not exists user_reward_crates_daily_unique
  on public.user_reward_crates (user_id, source_date)
  where source = 'daily_completion';

create index if not exists user_reward_crates_user_status_idx
  on public.user_reward_crates (user_id, status, claimed_at desc);

alter table public.user_reward_crates enable row level security;

drop policy if exists "user_reward_crates_select_own" on public.user_reward_crates;
create policy "user_reward_crates_select_own" on public.user_reward_crates
  for select using (auth.uid() = user_id);

-- Inserts/updates go through security-definer RPCs only.
revoke insert, update, delete on public.user_reward_crates from public, anon, authenticated;
grant select on public.user_reward_crates to authenticated;

-- ----------------------------------------------------------------------------
-- Helper: has the user personally cleared every exercise for goals on p_date?
-- Requires at least one qualifying exercise that day.
-- ----------------------------------------------------------------------------
create or replace function public.user_completed_daily_goals(
  p_user_id uuid,
  p_date    date
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exercise_count integer;
  v_incomplete_count integer;
begin
  if p_user_id is null or p_date is null then
    return false;
  end if;

  select count(*)
  into v_exercise_count
  from public.daily_goal_exercises dge
  join public.daily_goals dg on dg.id = dge.daily_goal_id
  join public.weekly_plans wp on wp.id = dg.weekly_plan_id
  join public.gang_members gm
    on gm.gang_id = wp.gang_id
   and gm.user_id = p_user_id
  where dg.goal_date = p_date
    and wp.status = 'active';

  if coalesce(v_exercise_count, 0) = 0 then
    return false;
  end if;

  select count(*)
  into v_incomplete_count
  from public.daily_goal_exercises dge
  join public.daily_goals dg on dg.id = dge.daily_goal_id
  join public.weekly_plans wp on wp.id = dg.weekly_plan_id
  join public.gang_members gm
    on gm.gang_id = wp.gang_id
   and gm.user_id = p_user_id
  left join (
    select
      ae.daily_goal_exercise_id,
      act.user_id,
      coalesce(sum(ae.amount), 0)::numeric as user_total
    from public.activity_exercises ae
    join public.activities act on act.id = ae.activity_id
    where ae.daily_goal_exercise_id is not null
    group by ae.daily_goal_exercise_id, act.user_id
  ) prog
    on prog.daily_goal_exercise_id = dge.id
   and prog.user_id = p_user_id
  where dg.goal_date = p_date
    and wp.status = 'active'
    and dge.individual_target > 0
    and coalesce(prog.user_total, 0) < dge.individual_target;

  return coalesce(v_incomplete_count, 0) = 0;
end;
$$;

revoke execute on function public.user_completed_daily_goals(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Claim today's (or a given day's) daily reward crate into inventory.
-- ----------------------------------------------------------------------------
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

  -- Already claimed — return existing row (idempotent).
  select *
  into v_crate
  from public.user_reward_crates
  where user_id = v_user_id
    and source = 'daily_completion'
    and source_date = p_reward_date;

  if found then
    return v_crate;
  end if;

  if not public.user_completed_daily_goals(v_user_id, p_reward_date) then
    raise exception 'Complete all daily exercises before claiming your reward';
  end if;

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
    v_user_id,
    'daily_completion',
    p_reward_date,
    'sealed',
    'aura',
    'Daily Reward Crate',
    'Earned by clearing every exercise for the day.'
  )
  returning * into v_crate;

  return v_crate;
end;
$$;

revoke execute on function public.claim_daily_reward(date) from public, anon;
grant execute on function public.claim_daily_reward(date) to authenticated;

-- ----------------------------------------------------------------------------
-- Open a sealed crate (loot contents come later — empty object for now).
-- ----------------------------------------------------------------------------
create or replace function public.open_reward_crate(p_crate_id uuid)
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

  if p_crate_id is null then
    raise exception 'Crate id is required';
  end if;

  select *
  into v_crate
  from public.user_reward_crates
  where id = p_crate_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Reward crate not found';
  end if;

  if v_crate.status = 'opened' then
    return v_crate;
  end if;

  update public.user_reward_crates
  set
    status = 'opened',
    opened_at = now(),
    contents = coalesce(contents, '{}'::jsonb)
  where id = v_crate.id
  returning * into v_crate;

  return v_crate;
end;
$$;

revoke execute on function public.open_reward_crate(uuid) from public, anon;
grant execute on function public.open_reward_crate(uuid) to authenticated;
