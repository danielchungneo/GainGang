-- Broaden Armory cosmetic stock:
-- Borders / banners: 1 Mythic (S), 1 Legendary (A), 2 of each lower rarity.
-- Titles: no B+ exist yet — stock 2 Common / Uncommon / Rare.
-- Featured drop stays separate and is excluded from its category row.

-- ----------------------------------------------------------------------------
-- Borders — curated ladder
-- ----------------------------------------------------------------------------
insert into public.shop_listings (
  slug, product_kind, category, cosmetic_id,
  name, description, rarity, price_creds,
  max_stock_per_rotation, is_featured, sort_order
)
select
  'border-' || ci.id,
  'cosmetic',
  'borders',
  ci.id,
  ci.name,
  ci.description,
  ci.rarity,
  public.shop_price_for_rarity(ci.rarity),
  case when ci.rarity in ('A', 'S') then 1 else null end,
  false,
  case ci.rarity
    when 'S' then 10 when 'A' then 20 when 'B' then 30
    when 'C' then 40 when 'D' then 50 else 60
  end + row_number() over (order by ci.rarity desc, ci.name)
from public.cosmetic_items ci
where ci.kind = 'avatar_border'
  and ci.active = true
  and ci.id in (
    -- S ×1
    'avatar_border_mythic',
    -- A ×1
    'avatar_border_gilded',
    -- B ×2
    'avatar_border_neon',
    'avatar_border_ice',
    -- C ×2
    'avatar_border_volt',
    'avatar_border_mint',
    -- D ×2
    'avatar_border_ember',
    'avatar_border_copper',
    -- E ×2
    'avatar_border_slate',
    'avatar_border_mist'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  price_creds = excluded.price_creds,
  max_stock_per_rotation = excluded.max_stock_per_rotation,
  is_featured = false,
  sort_order = excluded.sort_order,
  active = true;

-- ----------------------------------------------------------------------------
-- Banners — curated ladder (skip featured Solar Flare)
-- ----------------------------------------------------------------------------
insert into public.shop_listings (
  slug, product_kind, category, cosmetic_id,
  name, description, rarity, price_creds,
  max_stock_per_rotation, is_featured, sort_order
)
select
  'banner-' || ci.id,
  'cosmetic',
  'banners',
  ci.id,
  ci.name,
  ci.description,
  ci.rarity,
  public.shop_price_for_rarity(ci.rarity),
  case when ci.rarity in ('A', 'S') then 1 else null end,
  false,
  case ci.rarity
    when 'S' then 10 when 'A' then 20 when 'B' then 30
    when 'C' then 40 when 'D' then 50 else 60
  end + row_number() over (order by ci.rarity desc, ci.name)
from public.cosmetic_items ci
where ci.kind = 'banner'
  and ci.active = true
  and ci.id in (
    -- S ×1
    'banner_singularity',
    -- A ×1
    'banner_blood_moon',
    -- B ×2
    'banner_aurora',
    'banner_voltage',
    -- C ×2
    'banner_neon_city',
    'banner_berry',
    -- D ×2
    'banner_sunset',
    'banner_storm',
    -- E ×2
    'banner_dawn',
    'banner_fog'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  price_creds = excluded.price_creds,
  max_stock_per_rotation = excluded.max_stock_per_rotation,
  is_featured = false,
  sort_order = excluded.sort_order,
  active = true;

-- ----------------------------------------------------------------------------
-- Titles — 2× Rare / Uncommon / Common (highest available is C)
-- ----------------------------------------------------------------------------
insert into public.shop_listings (
  slug, product_kind, category, cosmetic_id,
  name, description, rarity, price_creds,
  max_stock_per_rotation, is_featured, sort_order
)
select
  'title-' || ci.id,
  'cosmetic',
  'titles',
  ci.id,
  ci.name,
  ci.description,
  ci.rarity,
  public.shop_price_for_rarity(ci.rarity),
  null,
  false,
  case ci.rarity when 'C' then 30 when 'D' then 40 else 50 end
    + row_number() over (order by ci.rarity desc, ci.name)
from public.cosmetic_items ci
where ci.kind = 'title'
  and ci.active = true
  and ci.id in (
    -- C ×2
    'title_unstoppable',
    'title_beast_mode',
    -- D ×2
    'title_iron_will',
    'title_grind_mode',
    -- E ×2
    'title_rookie',
    'title_day_one'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  price_creds = excluded.price_creds,
  max_stock_per_rotation = excluded.max_stock_per_rotation,
  is_featured = false,
  sort_order = excluded.sort_order,
  active = true;

-- ----------------------------------------------------------------------------
-- Retire cosmetics not in the curated set (keep crates + featured-drop)
-- ----------------------------------------------------------------------------
with keep as (
  select unnest(array[
    -- borders
    'avatar_border_mythic',
    'avatar_border_gilded',
    'avatar_border_neon',
    'avatar_border_ice',
    'avatar_border_volt',
    'avatar_border_mint',
    'avatar_border_ember',
    'avatar_border_copper',
    'avatar_border_slate',
    'avatar_border_mist',
    -- banners
    'banner_singularity',
    'banner_blood_moon',
    'banner_aurora',
    'banner_voltage',
    'banner_neon_city',
    'banner_berry',
    'banner_sunset',
    'banner_storm',
    'banner_dawn',
    'banner_fog',
    -- titles
    'title_unstoppable',
    'title_beast_mode',
    'title_iron_will',
    'title_grind_mode',
    'title_rookie',
    'title_day_one'
  ]) as cosmetic_id
  union
  select cosmetic_id
  from public.shop_listings
  where slug = 'featured-drop'
    and cosmetic_id is not null
)
update public.shop_listings sl
set active = false, is_featured = false
where sl.product_kind = 'cosmetic'
  and sl.slug <> 'featured-drop'
  and sl.cosmetic_id is not null
  and not exists (
    select 1 from keep k where k.cosmetic_id = sl.cosmetic_id
  );

-- Never also list the featured cosmetic in its category scroller.
update public.shop_listings sl
set active = false
where sl.product_kind = 'cosmetic'
  and sl.is_featured = false
  and sl.slug <> 'featured-drop'
  and sl.cosmetic_id = (
    select cosmetic_id from public.shop_listings where slug = 'featured-drop'
  );
