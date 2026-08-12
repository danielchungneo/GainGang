-- Creds reveal label: drop rarity prefix ("RARE CREDS" → "CREDS").

create or replace function public.creds_reward_json(p_crate_rarity text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'kind', 'creds',
    'rarity', p_crate_rarity,
    'amount', public.reward_rarity_creds(p_crate_rarity),
    'badgeLevel', public.reward_rarity_badge_level(p_crate_rarity),
    'label', 'CREDS',
    'value', '+' || public.reward_rarity_creds(p_crate_rarity) || ' Creds'
  );
$$;

revoke execute on function public.creds_reward_json(text)
  from public, anon, authenticated;
