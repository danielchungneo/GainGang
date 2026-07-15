-- Allow invitees to preview a gang by invite code (invite-only gangs are otherwise RLS-hidden).
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
    'privacy', v_gang.privacy,
    'member_count', coalesce(v_count, 0),
    'already_member', v_already
  );
end;
$$;

revoke all on function public.preview_gang_invite(text) from public;
grant execute on function public.preview_gang_invite(text) to authenticated;

comment on function public.preview_gang_invite(text) is
  'Returns a limited gang preview for a valid invite code so invitees can confirm before joining.';
