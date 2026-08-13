-- Soften top-tier crate Creds. Must match lib/rewards/rarities.ts credsAmount.
-- Epic 1000 → 750, Legendary 2000 → 1000, Mythic 5000 → 2500.

create or replace function public.reward_rarity_creds(p_rarity text)
returns integer
language sql
immutable
as $$
  select case p_rarity
    when 'E' then 100
    when 'D' then 250
    when 'C' then 500
    when 'B' then 750
    when 'A' then 1000
    when 'S' then 2500
    else 100
  end;
$$;

revoke execute on function public.reward_rarity_creds(text)
  from public, anon, authenticated;
