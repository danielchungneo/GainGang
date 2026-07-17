-- ============================================================================
-- Gang club banners: banner_url column + public storage bucket
-- ============================================================================

alter table public.gangs
  add column if not exists banner_url text;

comment on column public.gangs.banner_url is
  'Public URL for the gang club banner image (storage).';

-- Keep invite preview in sync with the new column
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
    'banner_url', v_gang.banner_url,
    'privacy', v_gang.privacy,
    'member_count', coalesce(v_count, 0),
    'already_member', v_already
  );
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gang-banners',
  'gang-banners',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Gang banners are publicly accessible" on storage.objects;
create policy "Gang banners are publicly accessible"
  on storage.objects
  for select
  to public
  using (bucket_id = 'gang-banners');

drop policy if exists "Gang admins can upload banners" on storage.objects;
create policy "Gang admins can upload banners"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'gang-banners'
    and public.is_gang_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Gang admins can update banners" on storage.objects;
create policy "Gang admins can update banners"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'gang-banners'
    and public.is_gang_admin(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'gang-banners'
    and public.is_gang_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Gang admins can delete banners" on storage.objects;
create policy "Gang admins can delete banners"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'gang-banners'
    and public.is_gang_admin(((storage.foldername(name))[1])::uuid)
  );
