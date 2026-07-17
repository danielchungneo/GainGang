-- New accounts start with the onboarding starter XP (+25).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starter_xp integer := 25;
begin
  insert into public.profiles (id, full_name, xp, rank)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_starter_xp,
    public.rank_for_xp(v_starter_xp)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
