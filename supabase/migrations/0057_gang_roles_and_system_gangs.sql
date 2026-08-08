-- ============================================================================
-- Gang roles + system gangs
-- - Replace unused `admin` role with `captain`
-- - Captains: weekly plans + kick members (not captains/owners/promote)
-- - Owners: full control including promote/demote, transfer, delete
-- - System gangs: no human owner, uncapped membership, not competition-eligible
-- - create_system_gang is service_role / admin-tool only
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schema: gangs flags + nullable owner for system gangs
-- ---------------------------------------------------------------------------
alter table public.gangs
  add column if not exists is_system boolean not null default false,
  add column if not exists max_members integer,
  add column if not exists eligible_for_gang_competitions boolean not null default true;

comment on column public.gangs.is_system is
  'Platform-managed gang (no human owner). Created via create_system_gang.';
comment on column public.gangs.max_members is
  'Join cap. NULL means unlimited (system gangs). Default 25 for user gangs.';
comment on column public.gangs.eligible_for_gang_competitions is
  'When false, gang cannot enter future gang-vs-gang competitions.';

-- Backfill existing user gangs.
update public.gangs
set
  is_system = false,
  max_members = coalesce(max_members, 25),
  eligible_for_gang_competitions = coalesce(eligible_for_gang_competitions, true)
where is_system = false;

alter table public.gangs
  alter column owner_id drop not null;

alter table public.gangs
  drop constraint if exists gangs_system_owner_ck;

alter table public.gangs
  add constraint gangs_system_owner_ck check (
    (is_system = true and owner_id is null)
    or (is_system = false and owner_id is not null)
  );

alter table public.gangs
  drop constraint if exists gangs_max_members_ck;

alter table public.gangs
  add constraint gangs_max_members_ck check (
    max_members is null or max_members >= 1
  );

-- ---------------------------------------------------------------------------
-- Schema: admin → captain role
-- ---------------------------------------------------------------------------
update public.gang_members
set role = 'captain'
where role = 'admin';

alter table public.gang_members
  drop constraint if exists gang_members_role_check;

alter table public.gang_members
  add constraint gang_members_role_check
  check (role = any (array['owner'::text, 'captain'::text, 'member'::text]));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_gang_admin(p_gang_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  -- Owner or captain (legacy name kept for existing RLS / call sites).
  select exists (
    select 1 from public.gang_members
    where gang_id = p_gang_id
      and user_id = p_user_id
      and role in ('owner', 'captain')
  );
$$;

create or replace function public.is_gang_captain(p_gang_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.gang_members
    where gang_id = p_gang_id
      and user_id = p_user_id
      and role = 'captain'
  );
$$;

create or replace function public.can_manage_weekly_plan(
  p_gang_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_gang_admin(p_gang_id, p_user_id);
$$;

revoke execute on function public.is_gang_captain(uuid, uuid) from public, anon;
grant  execute on function public.is_gang_captain(uuid, uuid) to authenticated;
revoke execute on function public.can_manage_weekly_plan(uuid, uuid) from public, anon;
grant  execute on function public.can_manage_weekly_plan(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: settings / banners owner-only; kick only via RPC (self-leave stays)
-- ---------------------------------------------------------------------------
drop policy if exists "gangs_update_admin" on public.gangs;
drop policy if exists "gangs_update_owner" on public.gangs;
create policy "gangs_update_owner" on public.gangs
  for update
  using (public.is_gang_owner(id))
  with check (public.is_gang_owner(id));

drop policy if exists "gang_members_admin_update" on public.gang_members;
drop policy if exists "gang_members_update_owner" on public.gang_members;
create policy "gang_members_update_owner" on public.gang_members
  for update
  using (public.is_gang_owner(gang_id))
  with check (public.is_gang_owner(gang_id));

drop policy if exists "gang_members_leave" on public.gang_members;
create policy "gang_members_leave" on public.gang_members
  for delete using (
    user_id = auth.uid()
    and role <> 'owner'
  );

drop policy if exists "Gang admins can upload banners" on storage.objects;
create policy "Gang owners can upload banners"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'gang-banners'
    and public.is_gang_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Gang admins can update banners" on storage.objects;
drop policy if exists "Gang owners can update banners" on storage.objects;
create policy "Gang owners can update banners"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'gang-banners'
    and public.is_gang_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'gang-banners'
    and public.is_gang_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Gang admins can delete banners" on storage.objects;
drop policy if exists "Gang owners can delete banners" on storage.objects;
create policy "Gang owners can delete banners"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'gang-banners'
    and public.is_gang_owner(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- create_gang: explicit user-gang defaults
-- ---------------------------------------------------------------------------
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
    eligible_for_gang_competitions
  )
  values (
    p_name,
    p_description,
    p_icon,
    coalesce(p_privacy, 'public'),
    auth.uid(),
    false,
    25,
    true
  )
  returning * into v_gang;

  insert into public.gang_members (gang_id, user_id, role)
  values (v_gang.id, auth.uid(), 'owner');

  return v_gang;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin tool: system gang (service_role only — no membership for creator)
-- ---------------------------------------------------------------------------
create or replace function public.create_system_gang(
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
  insert into public.gangs (
    name,
    description,
    icon,
    privacy,
    owner_id,
    is_system,
    max_members,
    eligible_for_gang_competitions
  )
  values (
    p_name,
    p_description,
    p_icon,
    coalesce(p_privacy, 'public'),
    null,
    true,
    null,
    false
  )
  returning * into v_gang;

  return v_gang;
end;
$$;

revoke execute on function public.create_system_gang(text, text, text, text) from public, anon, authenticated;
grant  execute on function public.create_system_gang(text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Join / preview: per-gang max_members (null = unlimited)
-- ---------------------------------------------------------------------------
create or replace function public.join_gang(p_invite_code text)
returns public.gangs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gang from public.gangs
  where invite_code = upper(trim(p_invite_code));

  if v_gang.id is null then
    raise exception 'Invalid invite code';
  end if;

  if exists (
    select 1 from public.gang_members
    where gang_id = v_gang.id and user_id = auth.uid()
  ) then
    return v_gang;
  end if;

  select count(*)::integer into v_count
  from public.gang_members
  where gang_id = v_gang.id;

  if v_gang.max_members is not null and coalesce(v_count, 0) >= v_gang.max_members then
    raise exception 'This Gang is full (% members max)', v_gang.max_members;
  end if;

  insert into public.gang_members (gang_id, user_id, role)
  values (v_gang.id, auth.uid(), 'member');

  return v_gang;
end;
$$;

create or replace function public.join_public_gang(p_gang_id uuid)
returns public.gangs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gang from public.gangs where id = p_gang_id;

  if v_gang.id is null then
    raise exception 'Gang not found';
  end if;
  if v_gang.privacy <> 'public' then
    raise exception 'This gang is invite-only';
  end if;

  if exists (
    select 1 from public.gang_members
    where gang_id = v_gang.id and user_id = auth.uid()
  ) then
    return v_gang;
  end if;

  select count(*)::integer into v_count
  from public.gang_members
  where gang_id = v_gang.id;

  if v_gang.max_members is not null and coalesce(v_count, 0) >= v_gang.max_members then
    raise exception 'This Gang is full (% members max)', v_gang.max_members;
  end if;

  insert into public.gang_members (gang_id, user_id, role)
  values (v_gang.id, auth.uid(), 'member');

  return v_gang;
end;
$$;

create or replace function public.preview_gang_invite(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
  v_count int;
  v_already boolean;
  v_is_full boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gang
  from public.gangs
  where invite_code = upper(trim(p_invite_code));

  if v_gang.id is null then
    raise exception 'Invalid or expired invite';
  end if;

  select count(*)::int into v_count
  from public.gang_members
  where gang_id = v_gang.id;

  v_already := public.is_gang_member(v_gang.id);
  v_is_full := v_gang.max_members is not null
    and coalesce(v_count, 0) >= v_gang.max_members;

  return json_build_object(
    'id', v_gang.id,
    'name', v_gang.name,
    'description', v_gang.description,
    'icon', v_gang.icon,
    'banner_url', v_gang.banner_url,
    'privacy', v_gang.privacy,
    'member_count', coalesce(v_count, 0),
    'already_member', v_already,
    'max_members', v_gang.max_members,
    'is_full', v_is_full,
    'is_system', v_gang.is_system,
    'eligible_for_gang_competitions', v_gang.eligible_for_gang_competitions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Weekly plans: owner or captain
-- ---------------------------------------------------------------------------
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
  if not public.can_manage_weekly_plan(p_gang_id) then
    raise exception 'Only the gang owner or a captain can create weekly plans';
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

  if not public.can_manage_weekly_plan(v_plan.gang_id) then
    raise exception 'Only the gang owner or a captain can edit weekly plans';
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

-- ---------------------------------------------------------------------------
-- Kick / promote / transfer
-- ---------------------------------------------------------------------------
create or replace function public.kick_gang_member(
  p_gang_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot kick yourself';
  end if;

  select role into v_actor_role
  from public.gang_members
  where gang_id = p_gang_id and user_id = auth.uid();

  if v_actor_role is null or v_actor_role not in ('owner', 'captain') then
    raise exception 'Only the owner or a captain can remove members';
  end if;

  select role into v_target_role
  from public.gang_members
  where gang_id = p_gang_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception 'The gang owner cannot be removed';
  end if;
  if v_actor_role = 'captain' and v_target_role <> 'member' then
    raise exception 'Captains can only remove members';
  end if;

  delete from public.gang_members
  where gang_id = p_gang_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.kick_gang_member(uuid, uuid) from public, anon;
grant  execute on function public.kick_gang_member(uuid, uuid) to authenticated;

create or replace function public.set_gang_member_role(
  p_gang_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_gang_owner(p_gang_id) then
    raise exception 'Only the gang owner can change roles';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Use transfer ownership to change the owner';
  end if;
  if p_role not in ('captain', 'member') then
    raise exception 'Role must be captain or member';
  end if;

  select role into v_target_role
  from public.gang_members
  where gang_id = p_gang_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Cannot change the owner role this way';
  end if;

  update public.gang_members
  set role = p_role
  where gang_id = p_gang_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.set_gang_member_role(uuid, uuid, text) from public, anon;
grant  execute on function public.set_gang_member_role(uuid, uuid, text) to authenticated;

create or replace function public.transfer_gang_ownership(
  p_gang_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gang from public.gangs where id = p_gang_id;
  if v_gang.id is null then
    raise exception 'Gang not found';
  end if;
  if v_gang.is_system then
    raise exception 'System gangs have no human owner';
  end if;
  if not public.is_gang_owner(p_gang_id) then
    raise exception 'Only the gang owner can transfer ownership';
  end if;
  if p_new_owner_id = auth.uid() then
    raise exception 'You already own this gang';
  end if;

  select role into v_target_role
  from public.gang_members
  where gang_id = p_gang_id and user_id = p_new_owner_id;

  if v_target_role is null then
    raise exception 'New owner must already be a member';
  end if;

  update public.gang_members
  set role = 'member'
  where gang_id = p_gang_id and user_id = auth.uid();

  update public.gang_members
  set role = 'owner'
  where gang_id = p_gang_id and user_id = p_new_owner_id;

  update public.gangs
  set owner_id = p_new_owner_id
  where id = p_gang_id;
end;
$$;

revoke execute on function public.transfer_gang_ownership(uuid, uuid) from public, anon;
grant  execute on function public.transfer_gang_ownership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Delete: block system gangs; still owner-only for user gangs
-- ---------------------------------------------------------------------------
create or replace function public.delete_gang(p_gang_id uuid)
returns void
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

  select * into v_gang from public.gangs where id = p_gang_id;
  if v_gang.id is null then
    raise exception 'Gang not found';
  end if;
  if v_gang.is_system then
    raise exception 'System gangs cannot be deleted from the app';
  end if;
  if not public.is_gang_owner(p_gang_id) then
    raise exception 'Only the gang owner can delete this gang';
  end if;

  delete from public.weekly_plans where gang_id = p_gang_id;
  delete from public.quests where gang_id = p_gang_id;
  delete from public.activities where gang_id = p_gang_id;
  delete from public.xp_awards where gang_id = p_gang_id;
  delete from public.exercises where gang_id = p_gang_id;
  delete from public.gangs where id = p_gang_id;
end;
$$;

revoke execute on function public.delete_gang(uuid) from public, anon;
grant  execute on function public.delete_gang(uuid) to authenticated;
