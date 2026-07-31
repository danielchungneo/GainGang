-- ============================================================================
-- Force store update config
-- - Remote min native versions for iOS / Android
-- - Readable by anon so the gate works before sign-in
-- ============================================================================

insert into public.app_settings (key, value)
values (
  'force_update',
  jsonb_build_object(
    'min_ios_version', '1.0.1',
    'min_android_version', '1.0.1',
    'ios_store_url', 'https://apps.apple.com/us/app/gain-gang/id6792023328',
    'android_store_url', 'https://play.google.com/store/apps/details?id=com.danielchungneo.gaingang',
    'message', 'A new version of GainGang is required. Update from the store to continue.'
  )
)
on conflict (key) do update
set
  value = excluded.value,
  updated_at = now();

-- Allow unauthenticated clients to read force-update config only.
drop policy if exists "app_settings_select_force_update_anon" on public.app_settings;
create policy "app_settings_select_force_update_anon" on public.app_settings
  for select to anon
  using (key = 'force_update');
