-- Rebalance Armory prices: cosmetics above same-tier crate floors;
-- Rare crate uses a true C floor; Epic crate sticker bumped slightly.

create or replace function public.shop_price_for_rarity(p_rarity text)
returns integer
language sql
immutable
as $$
  select case p_rarity
    when 'E' then 150
    when 'D' then 320
    when 'C' then 650
    when 'B' then 1000
    when 'A' then 1800
    when 'S' then 3200
    else 150
  end;
$$;

revoke execute on function public.shop_price_for_rarity(text)
  from public, anon, authenticated;

-- Reprice active cosmetic listings from the new ladder.
update public.shop_listings sl
set price_creds = public.shop_price_for_rarity(sl.rarity)
where sl.product_kind = 'cosmetic'
  and sl.active = true;

-- Rare crate: C floor so name/odds match the payout.
update public.shop_listings
set
  name = 'Rare Crate',
  description = 'One roll with Rare-or-better odds. Opens the moment you buy.',
  rarity = 'C',
  crate_min_rarity = 'C',
  odds_label = 'RARE–MYTHIC ODDS',
  price_creds = 750
where slug = 'crate-locker';

-- Epic crate: clearer net cost after the B-floor Creds refund.
update public.shop_listings
set
  name = 'Epic Crate',
  description = 'One roll with Epic-or-better odds. Opens the moment you buy.',
  rarity = 'B',
  crate_min_rarity = 'B',
  odds_label = 'EPIC–MYTHIC ODDS',
  price_creds = 1000
where slug = 'crate-vault';
