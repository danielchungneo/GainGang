-- ============================================================================
-- Gang size cap: max 25 members. New joins only — oversized gangs keep
-- existing members but cannot accept new ones until under the cap.
-- MAX_GANG_MEMBERS = 25
-- ============================================================================

create or replace function public.join_gang(p_invite_code text)
returns public.gangs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gang public.gangs;
  v_count integer;
  v_max_members constant integer := 25;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gang from public.gangs
  where invite_code = upper(trim(p_invite_code));

  if v_gang.id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Already a member — idempotent success.
  if exists (
    select 1 from public.gang_members
    where gang_id = v_gang.id and user_id = auth.uid()
  ) then
    return v_gang;
  end if;

  select count(*)::integer into v_count
  from public.gang_members
  where gang_id = v_gang.id;

  if coalesce(v_count, 0) >= v_max_members then
    raise exception 'This Gang is full (25 members max)';
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
  v_max_members constant integer := 25;
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

  if coalesce(v_count, 0) >= v_max_members then
    raise exception 'This Gang is full (25 members max)';
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
  v_max_members constant integer := 25;
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

  return json_build_object(
    'id', v_gang.id,
    'name', v_gang.name,
    'description', v_gang.description,
    'icon', v_gang.icon,
    'banner_url', v_gang.banner_url,
    'privacy', v_gang.privacy,
    'member_count', coalesce(v_count, 0),
    'already_member', v_already,
    'max_members', v_max_members,
    'is_full', coalesce(v_count, 0) >= v_max_members
  );
end;
$$;
