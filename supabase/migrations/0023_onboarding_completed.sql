-- First-run onboarding completion (null = needs onboarding)
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'When the user finished (or skipped to complete) first-run onboarding. Null means still needed.';

-- Existing accounts should not be forced through onboarding.
update public.profiles
set onboarding_completed_at = coalesce(created_at, now())
where onboarding_completed_at is null;
