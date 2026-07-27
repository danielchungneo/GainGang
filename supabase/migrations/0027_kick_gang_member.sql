-- Harden gang member removal: owners/admins can kick others, but the owner
-- membership row cannot be deleted by anyone (including other admins).
-- Self-leave remains allowed for non-owner rows via user_id = auth.uid().

drop policy if exists "gang_members_leave" on public.gang_members;
create policy "gang_members_leave" on public.gang_members
  for delete using (
    (
      user_id = auth.uid()
      and role <> 'owner'
    )
    or (
      public.is_gang_admin(gang_id)
      and role <> 'owner'
      and user_id <> auth.uid()
    )
  );
