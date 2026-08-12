-- Scale crate Creds payouts 10x. Must match lib/rewards/rarities.ts credsAmount.

create or replace function public.reward_rarity_creds(p_rarity text)
returns integer
language sql
immutable
as $$
  select case p_rarity
    when 'E' then 100
    when 'D' then 250
    when 'C' then 500
    when 'B' then 1000
    when 'A' then 2000
    when 'S' then 5000
    else 100
  end;
$$;

revoke execute on function public.reward_rarity_creds(text)
  from public, anon, authenticated;
