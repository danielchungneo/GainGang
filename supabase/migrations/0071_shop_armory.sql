-- Cosmetics Armory: rotating Creds shop, spend ledger, purchase RPC.

-- ----------------------------------------------------------------------------
-- Ownership source: shop purchases
-- ----------------------------------------------------------------------------
alter table public.user_cosmetics
  drop constraint if exists user_cosmetics_source_check;

alter table public.user_cosmetics
  add constraint user_cosmetics_source_check
  check (source in ('crate', 'grant', 'shop'));

-- ----------------------------------------------------------------------------
-- Spend ledger (amounts always positive; balance decreases separately)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'currency_spend_kind' and typnamespace = 'public'::regnamespace
  ) then
    create type public.currency_spend_kind as enum ('shop_purchase');
  end if;
end;
$$;

create table if not exists public.currency_spends (
  id               uuid primary key default gen_random_uuid(),
  kind             public.currency_spend_kind not null,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  shop_listing_id  uuid,
  amount           integer not null check (amount > 0),
  created_at       timestamptz not null default now()
);

create index if not exists currency_spends_user_kind_idx
  on public.currency_spends (user_id, kind);

alter table public.currency_spends enable row level security;

drop policy if exists "currency_spends_select_own" on public.currency_spends;
create policy "currency_spends_select_own" on public.currency_spends
  for select using (auth.uid() = user_id);

grant select on public.currency_spends to authenticated;

create or replace function public.spend_currency(
  p_user_id uuid,
  p_amount integer,
  p_kind public.currency_spend_kind,
  p_shop_listing_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update public.profiles
  set currency = currency - p_amount
  where id = p_user_id
    and currency >= p_amount
  returning currency into v_balance;

  if not found then
    raise exception 'Insufficient Creds';
  end if;

  insert into public.currency_spends (kind, user_id, shop_listing_id, amount)
  values (p_kind, p_user_id, p_shop_listing_id, p_amount);

  return v_balance;
end;
$$;

revoke execute on function public.spend_currency(uuid, integer, public.currency_spend_kind, uuid)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Catalog
-- ----------------------------------------------------------------------------
create table if not exists public.shop_listings (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  product_kind            text not null check (product_kind in ('cosmetic', 'crate')),
  category                text not null
                            check (category in ('crates', 'titles', 'borders', 'banners')),
  cosmetic_id             text references public.cosmetic_items(id) on delete cascade,
  crate_key               text check (crate_key is null or crate_key in ('locker', 'vault')),
  crate_min_rarity        text check (
                            crate_min_rarity is null
                            or crate_min_rarity in ('E', 'D', 'C', 'B', 'A', 'S')
                          ),
  name                    text not null,
  description             text,
  rarity                  text not null check (rarity in ('E', 'D', 'C', 'B', 'A', 'S')),
  odds_label              text,
  price_creds             integer not null check (price_creds > 0),
  max_stock_per_rotation  integer check (
                            max_stock_per_rotation is null or max_stock_per_rotation > 0
                          ),
  is_featured             boolean not null default false,
  sort_order              integer not null default 0,
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  constraint shop_listings_product_shape check (
    (
      product_kind = 'cosmetic'
      and cosmetic_id is not null
      and crate_key is null
      and crate_min_rarity is null
    )
    or (
      product_kind = 'crate'
      and cosmetic_id is null
      and crate_key is not null
      and crate_min_rarity is not null
      and category = 'crates'
    )
  )
);

create index if not exists shop_listings_active_category_idx
  on public.shop_listings (active, category, sort_order);

create table if not exists public.shop_rotation_sales (
  listing_id   uuid not null references public.shop_listings(id) on delete cascade,
  rotation_key text not null,
  sold_count   integer not null default 0 check (sold_count >= 0),
  primary key (listing_id, rotation_key)
);

alter table public.shop_listings enable row level security;
alter table public.shop_rotation_sales enable row level security;

drop policy if exists "shop_listings_select_active" on public.shop_listings;
create policy "shop_listings_select_active" on public.shop_listings
  for select using (active = true);

drop policy if exists "shop_rotation_sales_select" on public.shop_rotation_sales;
create policy "shop_rotation_sales_select" on public.shop_rotation_sales
  for select using (true);

grant select on public.shop_listings to authenticated;
grant select on public.shop_rotation_sales to authenticated;

alter table public.currency_spends
  drop constraint if exists currency_spends_shop_listing_id_fkey;

alter table public.currency_spends
  add constraint currency_spends_shop_listing_id_fkey
  foreign key (shop_listing_id) references public.shop_listings(id) on delete set null;

-- Default Creds prices by rarity (server authority).
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

-- ISO week rotation (Mon 00:00 UTC → next Mon).
create or replace function public.shop_current_rotation_key(p_at timestamptz default now())
returns text
language sql
stable
as $$
  select to_char(timezone('utc', p_at), 'IYYY') || '-W' || to_char(timezone('utc', p_at), 'IW');
$$;

create or replace function public.shop_rotation_ends_at(p_at timestamptz default now())
returns timestamptz
language sql
stable
as $$
  select date_trunc('week', timezone('utc', p_at))::timestamp
         at time zone 'utc' + interval '7 days';
$$;

revoke execute on function public.shop_current_rotation_key(timestamptz)
  from public, anon;
grant execute on function public.shop_current_rotation_key(timestamptz) to authenticated;

revoke execute on function public.shop_rotation_ends_at(timestamptz)
  from public, anon;
grant execute on function public.shop_rotation_ends_at(timestamptz) to authenticated;

-- Apply loot JSON (shop crates open immediately — no sealed crate row).
create or replace function public.apply_crate_contents_rewards(
  p_user_id uuid,
  p_contents jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rewards jsonb := coalesce(p_contents -> 'rewards', '[]'::jsonb);
  v_reward jsonb;
  v_i integer;
  v_xp integer := 0;
  v_creds integer := 0;
  v_cosmetic_id text;
  v_old_xp integer;
  v_new_xp integer;
  v_has_xp boolean := false;
  v_has_creds boolean := false;
begin
  for v_i in 0 .. greatest(jsonb_array_length(v_rewards) - 1, 0) loop
    v_reward := v_rewards -> v_i;
    if v_reward ->> 'kind' = 'xp' then
      v_has_xp := true;
      v_xp := coalesce((v_reward ->> 'amount')::integer, 0);
    elsif v_reward ->> 'kind' = 'cosmetic' then
      v_cosmetic_id := v_reward ->> 'cosmeticId';
      if v_cosmetic_id is not null then
        insert into public.user_cosmetics (user_id, cosmetic_id, source)
        values (p_user_id, v_cosmetic_id, 'shop')
        on conflict (user_id, cosmetic_id) do nothing;
      end if;
    elsif v_reward ->> 'kind' = 'creds' then
      v_has_creds := true;
      v_creds := coalesce((v_reward ->> 'amount')::integer, 0);
    end if;
  end loop;

  if v_has_xp and v_xp > 0 then
    select xp into v_old_xp
    from public.profiles
    where id = p_user_id
    for update;

    v_new_xp := greatest(0, coalesce(v_old_xp, 0) + v_xp);

    update public.profiles
    set
      xp = v_new_xp,
      rank = public.rank_for_xp(v_new_xp)
    where id = p_user_id;

    insert into public.xp_awards (kind, user_id, xp_amount)
    values ('crate_reward', p_user_id, v_xp);
  end if;

  if v_has_creds and v_creds > 0 then
    perform public.grant_currency(p_user_id, v_creds, 'crate_reward', null);
  end if;
end;
$$;

revoke execute on function public.apply_crate_contents_rewards(uuid, jsonb)
  from public, anon, authenticated;

-- Storefront payload for the signed-in player.
create or replace function public.get_shop_stock()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rotation text := public.shop_current_rotation_key();
  v_ends_at timestamptz := public.shop_rotation_ends_at();
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.sort_order, x.name), '[]'::jsonb)
  into v_items
  from (
    select
      sl.id,
      sl.slug,
      sl.product_kind,
      sl.category,
      sl.cosmetic_id,
      sl.crate_key,
      sl.crate_min_rarity,
      sl.name,
      sl.description,
      sl.rarity,
      sl.odds_label,
      sl.price_creds,
      sl.is_featured,
      sl.sort_order,
      case
        when sl.max_stock_per_rotation is null then null
        else greatest(sl.max_stock_per_rotation - coalesce(srs.sold_count, 0), 0)
      end as stock_remaining,
      case
        when sl.product_kind = 'cosmetic' then exists (
          select 1 from public.user_cosmetics uc
          where uc.user_id = v_user_id and uc.cosmetic_id = sl.cosmetic_id
        )
        else false
      end as owned,
      case
        when sl.product_kind = 'cosmetic' and exists (
          select 1 from public.user_cosmetics uc
          where uc.user_id = v_user_id and uc.cosmetic_id = sl.cosmetic_id
        ) then true
        when sl.max_stock_per_rotation is not null
          and coalesce(srs.sold_count, 0) >= sl.max_stock_per_rotation then true
        else false
      end as sold_out,
      case
        when ci.id is null then null
        else jsonb_build_object(
          'id', ci.id,
          'kind', ci.kind,
          'rarity', ci.rarity,
          'name', ci.name,
          'description', ci.description,
          'style', ci.style,
          'active', ci.active,
          'created_at', ci.created_at
        )
      end as cosmetic
    from public.shop_listings sl
    left join public.cosmetic_items ci on ci.id = sl.cosmetic_id
    left join public.shop_rotation_sales srs
      on srs.listing_id = sl.id and srs.rotation_key = v_rotation
    where sl.active = true
      and (sl.product_kind = 'crate' or ci.active = true)
  ) x;

  return jsonb_build_object(
    'rotation_key', v_rotation,
    'rotation_ends_at', v_ends_at,
    'items', v_items
  );
end;
$$;

revoke execute on function public.get_shop_stock() from public, anon;
grant execute on function public.get_shop_stock() to authenticated;

-- Authoritative purchase: debit Creds, grant cosmetic or roll crate, return reveal payload.
create or replace function public.purchase_shop_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.shop_listings;
  v_rotation text := public.shop_current_rotation_key();
  v_sold integer := 0;
  v_balance integer;
  v_contents jsonb;
  v_item public.cosmetic_items;
  v_kind_label text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_listing_id is null then
    raise exception 'Listing id is required';
  end if;

  select * into v_listing
  from public.shop_listings
  where id = p_listing_id
    and active = true
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_listing.max_stock_per_rotation is not null then
    insert into public.shop_rotation_sales (listing_id, rotation_key, sold_count)
    values (v_listing.id, v_rotation, 0)
    on conflict (listing_id, rotation_key) do nothing;

    select sold_count into v_sold
    from public.shop_rotation_sales
    where listing_id = v_listing.id
      and rotation_key = v_rotation
    for update;

    if coalesce(v_sold, 0) >= v_listing.max_stock_per_rotation then
      raise exception 'Sold out';
    end if;
  end if;

  if v_listing.product_kind = 'cosmetic' then
    if exists (
      select 1 from public.user_cosmetics
      where user_id = v_user_id and cosmetic_id = v_listing.cosmetic_id
    ) then
      raise exception 'Already owned';
    end if;

    select * into v_item
    from public.cosmetic_items
    where id = v_listing.cosmetic_id
      and active = true;

    if not found then
      raise exception 'Cosmetic not available';
    end if;
  end if;

  -- Lock wallet row before debit.
  perform 1 from public.profiles where id = v_user_id for update;

  v_balance := public.spend_currency(
    v_user_id,
    v_listing.price_creds,
    'shop_purchase',
    v_listing.id
  );

  if v_listing.max_stock_per_rotation is not null then
    update public.shop_rotation_sales
    set sold_count = sold_count + 1
    where listing_id = v_listing.id
      and rotation_key = v_rotation;
  end if;

  if v_listing.product_kind = 'cosmetic' then
    insert into public.user_cosmetics (user_id, cosmetic_id, source)
    values (v_user_id, v_listing.cosmetic_id, 'shop')
    on conflict (user_id, cosmetic_id) do nothing;

    v_kind_label := case v_item.kind
      when 'title' then 'TITLE'
      when 'avatar_border' then 'AVATAR BORDER'
      when 'level_border' then 'LEVEL BORDER'
      when 'banner' then 'BANNER'
      else 'COSMETIC'
    end;

    v_contents := jsonb_build_object(
      'version', 1,
      'rewards', jsonb_build_array(
        jsonb_build_object(
          'kind', 'cosmetic',
          'rarity', v_item.rarity,
          'cosmeticId', v_item.id,
          'cosmeticKind', v_item.kind,
          'name', v_item.name,
          'label', v_kind_label || ' UNLOCKED',
          'value', v_item.name
        )
      )
    );
  else
    v_contents := public.with_crate_creds(
      public.build_crate_loot(v_user_id, v_listing.crate_min_rarity),
      v_listing.crate_min_rarity
    );
    perform public.apply_crate_contents_rewards(v_user_id, v_contents);
  end if;

  return jsonb_build_object(
    'listing_id', v_listing.id,
    'balance', v_balance,
    'contents', v_contents
  );
end;
$$;

revoke execute on function public.purchase_shop_listing(uuid) from public, anon;
grant execute on function public.purchase_shop_listing(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Seed rotating stock (idempotent by slug)
-- ----------------------------------------------------------------------------
insert into public.shop_listings (
  slug, product_kind, category, crate_key, crate_min_rarity,
  name, description, rarity, odds_label, price_creds,
  max_stock_per_rotation, is_featured, sort_order
)
values
  (
    'crate-vault', 'crate', 'crates', 'vault', 'B',
    'Epic Crate', 'One roll with Epic-or-better odds. Opens the moment you buy.',
    'B', 'EPIC–MYTHIC ODDS', 1000, null, false, 10
  ),
  (
    'crate-locker', 'crate', 'crates', 'locker', 'C',
    'Rare Crate', 'One roll with Rare-or-better odds. Opens the moment you buy.',
    'C', 'RARE–MYTHIC ODDS', 750, null, false, 20
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  odds_label = excluded.odds_label,
  price_creds = excluded.price_creds,
  crate_min_rarity = excluded.crate_min_rarity,
  active = true;

-- Featured drop — always Legendary (A) or Mythic (S): title, border, or banner.
insert into public.shop_listings (
  slug, product_kind, category, cosmetic_id,
  name, description, rarity, price_creds,
  max_stock_per_rotation, is_featured, sort_order
)
select
  'featured-drop',
  'cosmetic',
  case ci.kind
    when 'title' then 'titles'
    when 'avatar_border' then 'borders'
    else 'banners'
  end,
  ci.id,
  ci.name,
  coalesce(
    nullif(ci.description, ''),
    'This week''s Armory headliner. Limited stock — when it''s gone, it''s gone.'
  ),
  ci.rarity,
  public.shop_price_for_rarity(ci.rarity),
  1,
  true,
  0
from public.cosmetic_items ci
where ci.id = 'banner_solar_flare'
  and ci.active = true
  and ci.rarity in ('A', 'S')
on conflict (slug) do update set
  cosmetic_id = excluded.cosmetic_id,
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  price_creds = excluded.price_creds,
  is_featured = true,
  max_stock_per_rotation = 1,
  active = true;

-- Retire the old C-rank featured listing if present.
update public.shop_listings
set active = false, is_featured = false
where slug = 'featured-unstoppable';

-- Avoid duplicating the featured cosmetic in its category row.
update public.shop_listings
set active = false
where slug = 'banner-banner_solar_flare';

-- Titles row (includes former featured title)
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
  case when ci.rarity = 'C' then 2 else null end,
  false,
  case ci.rarity when 'C' then 30 when 'D' then 40 else 50 end
    + row_number() over (order by ci.rarity desc, ci.name)
from public.cosmetic_items ci
where ci.kind = 'title'
  and ci.active = true
  and ci.id in (
    'title_unstoppable',
    'title_iron_will',
    'title_no_days_off',
    'title_beast_mode',
    'title_apex_athlete',
    'title_the_machine',
    'title_early_riser',
    'title_grind_mode',
    'title_rep_chaser'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  price_creds = excluded.price_creds,
  max_stock_per_rotation = excluded.max_stock_per_rotation,
  active = true;

-- Borders
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
    'avatar_border_gilded',
    'avatar_border_plasma',
    'avatar_border_obsidian',
    'avatar_border_mythic',
    'avatar_border_prism',
    'avatar_border_abyss'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  price_creds = excluded.price_creds,
  max_stock_per_rotation = excluded.max_stock_per_rotation,
  active = true;

-- Banners
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
    'banner_royal_dusk',
    'banner_blood_moon',
    'banner_eclipse',
    'banner_spectrum',
    'banner_singularity'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  price_creds = excluded.price_creds,
  max_stock_per_rotation = excluded.max_stock_per_rotation,
  active = true;
