-- One-time Focus lock intro for accounts that already finished onboarding
-- before Focus lock shipped. Null = still need to show the intro.
alter table public.profiles
  add column if not exists focus_lock_intro_seen_at timestamptz;

comment on column public.profiles.focus_lock_intro_seen_at is
  'When the user saw (or was exempted from) the post-update Focus lock intro. Null means show it once to already-onboarded users. New signups are stamped at create time because they see Focus lock in pre-auth onboarding.';

-- New accounts see Focus lock during the pre-auth tour — never show the
-- post-login intro after they finish crew setup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starter_xp integer := 25;
begin
  insert into public.profiles (id, full_name, xp, rank, focus_lock_intro_seen_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_starter_xp,
    public.rank_for_xp(v_starter_xp),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
