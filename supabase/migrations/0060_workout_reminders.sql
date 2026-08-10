-- Automated workout reminders (v1): midday nudge + evening last call / streak-at-risk.
-- Hourly pg_cron checks local hour in app timezone (same source as weekly plan rollover).

-- ---------------------------------------------------------------------------
-- Notification type
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'kudos',
    'comment',
    'mention',
    'quest',
    'achievement',
    'rank_up',
    'gang',
    'poke',
    'daily_goal',
    'follow',
    'workout_reminder'
  ));

-- ---------------------------------------------------------------------------
-- Idempotency log (one send per user / day / slot)
-- ---------------------------------------------------------------------------
create table if not exists public.workout_reminder_sends (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  reminder_date  date not null,
  slot           text not null check (slot in ('midday', 'evening')),
  notification_id uuid references public.notifications(id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (user_id, reminder_date, slot)
);

create index if not exists workout_reminder_sends_date_idx
  on public.workout_reminder_sends (reminder_date, slot);

alter table public.workout_reminder_sends enable row level security;

-- Service-role / security definer only — no client policies.

-- ---------------------------------------------------------------------------
-- Incomplete-day helper (required exercises left for the user)
-- ---------------------------------------------------------------------------
create or replace function public.user_has_incomplete_daily_goals(
  p_user_id uuid,
  p_date date
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_incomplete_count integer;
  v_has_pull_up_bar boolean;
  v_has_weights boolean;
begin
  if p_user_id is null or p_date is null then
    return false;
  end if;

  select p.has_pull_up_bar, p.has_weights
  into v_has_pull_up_bar, v_has_weights
  from public.profiles p
  where p.id = p_user_id;

  if not found then
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
  join public.exercises e on e.id = dge.exercise_id
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
    and public.profile_has_equipment(
      v_has_pull_up_bar,
      v_has_weights,
      e.required_equipment
    )
    and coalesce(prog.user_total, 0) < dge.individual_target;

  return coalesce(v_incomplete_count, 0) > 0;
end;
$$;

revoke all on function public.user_has_incomplete_daily_goals(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sender
-- ---------------------------------------------------------------------------
create or replace function public.send_workout_reminders(
  p_force boolean default false,
  p_force_slot text default null
)
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
  v_local_hour integer;
  v_slot text;
  v_user record;
  v_body text;
  v_notification_id uuid;
  v_sent integer := 0;
  v_skipped integer := 0;
  v_candidates integer := 0;
begin
  if p_force_slot is not null and p_force_slot not in ('midday', 'evening') then
    raise exception 'Invalid slot. Use midday or evening.';
  end if;

  select value
  into v_settings
  from public.app_settings
  where key = 'weekly_plan_rollover';

  v_timezone := coalesce(v_settings->>'timezone', 'America/New_York');
  v_local_now := timezone(v_timezone, now());
  v_local_date := v_local_now::date;
  v_local_hour := extract(hour from v_local_now)::integer;

  if p_force and p_force_slot is not null then
    v_slot := p_force_slot;
  elsif v_local_hour = 13 then
    v_slot := 'midday';
  elsif v_local_hour = 19 then
    v_slot := 'evening';
  elsif p_force then
    -- Force without slot: pick midday during daytime, evening otherwise.
    v_slot := case when v_local_hour < 17 then 'midday' else 'evening' end;
  else
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'outside_send_window',
      'timezone', v_timezone,
      'local_hour', v_local_hour,
      'local_date', v_local_date
    );
  end if;

  for v_user in
    select distinct gm.user_id, p.current_streak
    from public.gang_members gm
    join public.profiles p on p.id = gm.user_id
    where public.user_has_incomplete_daily_goals(gm.user_id, v_local_date)
  loop
    v_candidates := v_candidates + 1;

    if exists (
      select 1
      from public.workout_reminder_sends s
      where s.user_id = v_user.user_id
        and s.reminder_date = v_local_date
        and s.slot = v_slot
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_slot = 'midday' then
      v_body := 'Still time to clear today''s Gain. Open GainGang and finish your exercises.';
    elsif coalesce(v_user.current_streak, 0) >= 2 then
      v_body := format(
        'Day %s streak on the line. Finish today''s exercises to keep it going.',
        v_user.current_streak
      );
    else
      v_body := 'Last call — finish today''s Gain before the day ends.';
    end if;

    insert into public.notifications (user_id, type, body)
    values (v_user.user_id, 'workout_reminder', v_body)
    returning id into v_notification_id;

    insert into public.workout_reminder_sends (
      user_id,
      reminder_date,
      slot,
      notification_id
    )
    values (
      v_user.user_id,
      v_local_date,
      v_slot,
      v_notification_id
    );

    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'slot', v_slot,
    'timezone', v_timezone,
    'local_date', v_local_date,
    'local_hour', v_local_hour,
    'candidates', v_candidates,
    'sent', v_sent,
    'already_sent', v_skipped
  );
end;
$$;

revoke all on function public.send_workout_reminders(boolean, text) from public, anon, authenticated;
grant execute on function public.send_workout_reminders(boolean, text) to service_role;

comment on function public.send_workout_reminders(boolean, text) is
  'Sends midday (1pm) and evening (7pm) workout reminders in the weekly_plan_rollover timezone for users with incomplete required exercises.';

-- ---------------------------------------------------------------------------
-- pg_cron: hourly; function enforces local send windows
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'send-workout-reminders';
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
  'send-workout-reminders',
  '10 * * * *',
  $$select public.send_workout_reminders(false, null)$$
);
