-- List a user's followers or following with enough profile fields for the UI.
-- Uses security definer so listed profiles remain visible even when the viewer
-- does not already share a direct follow/gang relationship with every person.

create or replace function public.can_view_follow_list(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() is not null
    and (
      p_user_id = auth.uid()
      or public.shares_gang(auth.uid(), p_user_id)
      or public.is_following(auth.uid(), p_user_id)
      or public.is_following(p_user_id, auth.uid())
    );
$$;

revoke all on function public.can_view_follow_list(uuid) from public, anon;
grant execute on function public.can_view_follow_list(uuid) to authenticated;

create or replace function public.list_follows(
  p_user_id uuid,
  p_list text
)
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  xp integer,
  created_at timestamptz,
  viewer_is_following boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_list not in ('followers', 'following') then
    raise exception 'Invalid list. Use followers or following.';
  end if;

  if not public.can_view_follow_list(p_user_id) then
    raise exception 'Not allowed to view this follow list';
  end if;

  if p_list = 'followers' then
    return query
    select
      p.id as user_id,
      p.full_name,
      p.username,
      p.avatar_url,
      p.xp,
      f.created_at,
      public.is_following(auth.uid(), p.id) as viewer_is_following
    from public.follows f
    join public.profiles p on p.id = f.follower_id
    where f.following_id = p_user_id
    order by f.created_at desc;
  else
    return query
    select
      p.id as user_id,
      p.full_name,
      p.username,
      p.avatar_url,
      p.xp,
      f.created_at,
      public.is_following(auth.uid(), p.id) as viewer_is_following
    from public.follows f
    join public.profiles p on p.id = f.following_id
    where f.follower_id = p_user_id
    order by f.created_at desc;
  end if;
end;
$$;

revoke all on function public.list_follows(uuid, text) from public, anon;
grant execute on function public.list_follows(uuid, text) to authenticated;

comment on function public.list_follows(uuid, text) is
  'Returns followers or following for a profile the viewer is allowed to see, including whether the viewer already follows each listed user.';
