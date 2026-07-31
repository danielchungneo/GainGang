-- ============================================================================
-- Profile cosmetics: titles, avatar borders, level borders, profile banners.
-- Unlocked via daily crates (~30% chance of same-rarity cosmetic bonus).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Catalog
-- ----------------------------------------------------------------------------
create table if not exists public.cosmetic_items (
  id          text primary key,
  kind        text not null
                check (kind in ('title', 'avatar_border', 'level_border', 'banner')),
  rarity      text not null
                check (rarity in ('E', 'D', 'C', 'B', 'A', 'S')),
  name        text not null,
  description text,
  style       jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists cosmetic_items_kind_rarity_idx
  on public.cosmetic_items (kind, rarity)
  where active = true;

comment on table public.cosmetic_items is
  'Unlockable profile cosmetics (titles, borders, banners).';

-- ----------------------------------------------------------------------------
-- Ownership
-- ----------------------------------------------------------------------------
create table if not exists public.user_cosmetics (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id text not null references public.cosmetic_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  source      text not null default 'crate'
                check (source in ('crate', 'grant')),
  primary key (user_id, cosmetic_id)
);

create index if not exists user_cosmetics_user_idx
  on public.user_cosmetics (user_id);

comment on table public.user_cosmetics is
  'Cosmetics owned by a user.';

-- ----------------------------------------------------------------------------
-- Equipped slots on profiles
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists equipped_title_id text
    references public.cosmetic_items(id) on delete set null;

alter table public.profiles
  add column if not exists equipped_avatar_border_id text
    references public.cosmetic_items(id) on delete set null;

alter table public.profiles
  add column if not exists equipped_level_border_id text
    references public.cosmetic_items(id) on delete set null;

alter table public.profiles
  add column if not exists equipped_banner_id text
    references public.cosmetic_items(id) on delete set null;

comment on column public.profiles.equipped_title_id is
  'Currently equipped title cosmetic.';
comment on column public.profiles.equipped_avatar_border_id is
  'Currently equipped avatar border cosmetic.';
comment on column public.profiles.equipped_level_border_id is
  'Currently equipped level badge border cosmetic.';
comment on column public.profiles.equipped_banner_id is
  'Currently equipped profile banner cosmetic.';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.cosmetic_items enable row level security;
alter table public.user_cosmetics enable row level security;

drop policy if exists "cosmetic_items_select" on public.cosmetic_items;
create policy "cosmetic_items_select" on public.cosmetic_items
  for select to authenticated
  using (active = true);

drop policy if exists "user_cosmetics_select" on public.user_cosmetics;
create policy "user_cosmetics_select" on public.user_cosmetics
  for select to authenticated
  using (true);

-- Inserts only via security-definer functions (crate open / grants).
-- No client insert/update/delete policies.

-- ----------------------------------------------------------------------------
-- Validate equipped cosmetics on profile update
-- ----------------------------------------------------------------------------
create or replace function public.validate_equipped_cosmetics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if new.equipped_title_id is distinct from old.equipped_title_id
     and new.equipped_title_id is not null then
    select kind into v_kind from public.cosmetic_items where id = new.equipped_title_id;
    if v_kind is distinct from 'title' then
      raise exception 'Invalid title cosmetic';
    end if;
    if not exists (
      select 1 from public.user_cosmetics
      where user_id = new.id and cosmetic_id = new.equipped_title_id
    ) then
      raise exception 'You do not own that title';
    end if;
  end if;

  if new.equipped_avatar_border_id is distinct from old.equipped_avatar_border_id
     and new.equipped_avatar_border_id is not null then
    select kind into v_kind from public.cosmetic_items where id = new.equipped_avatar_border_id;
    if v_kind is distinct from 'avatar_border' then
      raise exception 'Invalid avatar border cosmetic';
    end if;
    if not exists (
      select 1 from public.user_cosmetics
      where user_id = new.id and cosmetic_id = new.equipped_avatar_border_id
    ) then
      raise exception 'You do not own that avatar border';
    end if;
  end if;

  if new.equipped_level_border_id is distinct from old.equipped_level_border_id
     and new.equipped_level_border_id is not null then
    select kind into v_kind from public.cosmetic_items where id = new.equipped_level_border_id;
    if v_kind is distinct from 'level_border' then
      raise exception 'Invalid level border cosmetic';
    end if;
    if not exists (
      select 1 from public.user_cosmetics
      where user_id = new.id and cosmetic_id = new.equipped_level_border_id
    ) then
      raise exception 'You do not own that level border';
    end if;
  end if;

  if new.equipped_banner_id is distinct from old.equipped_banner_id
     and new.equipped_banner_id is not null then
    select kind into v_kind from public.cosmetic_items where id = new.equipped_banner_id;
    if v_kind is distinct from 'banner' then
      raise exception 'Invalid banner cosmetic';
    end if;
    if not exists (
      select 1 from public.user_cosmetics
      where user_id = new.id and cosmetic_id = new.equipped_banner_id
    ) then
      raise exception 'You do not own that banner';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validate_cosmetics on public.profiles;
create trigger profiles_validate_cosmetics
  before update on public.profiles
  for each row
  execute function public.validate_equipped_cosmetics();

-- ----------------------------------------------------------------------------
-- Equip / unequip RPCs
-- ----------------------------------------------------------------------------
create or replace function public.equip_cosmetic(p_cosmetic_id text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.cosmetic_items;
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_cosmetic_id is null or length(trim(p_cosmetic_id)) = 0 then
    raise exception 'Cosmetic id is required';
  end if;

  select * into v_item
  from public.cosmetic_items
  where id = p_cosmetic_id and active = true;

  if not found then
    raise exception 'Cosmetic not found';
  end if;

  if not exists (
    select 1 from public.user_cosmetics
    where user_id = v_user_id and cosmetic_id = p_cosmetic_id
  ) then
    raise exception 'You do not own that cosmetic';
  end if;

  if v_item.kind = 'title' then
    update public.profiles set equipped_title_id = p_cosmetic_id
    where id = v_user_id
    returning * into v_profile;
  elsif v_item.kind = 'avatar_border' then
    update public.profiles set equipped_avatar_border_id = p_cosmetic_id
    where id = v_user_id
    returning * into v_profile;
  elsif v_item.kind = 'level_border' then
    update public.profiles set equipped_level_border_id = p_cosmetic_id
    where id = v_user_id
    returning * into v_profile;
  elsif v_item.kind = 'banner' then
    update public.profiles set equipped_banner_id = p_cosmetic_id
    where id = v_user_id
    returning * into v_profile;
  else
    raise exception 'Unknown cosmetic kind';
  end if;

  return v_profile;
end;
$$;

revoke execute on function public.equip_cosmetic(text) from public, anon;
grant execute on function public.equip_cosmetic(text) to authenticated;

create or replace function public.unequip_cosmetic(p_kind text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_kind is null
     or p_kind not in ('title', 'avatar_border', 'level_border', 'banner') then
    raise exception 'Invalid cosmetic kind';
  end if;

  if p_kind = 'title' then
    update public.profiles set equipped_title_id = null
    where id = v_user_id
    returning * into v_profile;
  elsif p_kind = 'avatar_border' then
    update public.profiles set equipped_avatar_border_id = null
    where id = v_user_id
    returning * into v_profile;
  elsif p_kind = 'level_border' then
    update public.profiles set equipped_level_border_id = null
    where id = v_user_id
    returning * into v_profile;
  else
    update public.profiles set equipped_banner_id = null
    where id = v_user_id
    returning * into v_profile;
  end if;

  return v_profile;
end;
$$;

revoke execute on function public.unequip_cosmetic(text) from public, anon;
grant execute on function public.unequip_cosmetic(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Seed catalog (~3–4 per kind across rarities)
-- ----------------------------------------------------------------------------
insert into public.cosmetic_items (id, kind, rarity, name, description, style) values
  -- Titles
  ('title_rookie', 'title', 'E', 'Rookie', 'Just getting started.', '{}'::jsonb),
  ('title_iron_will', 'title', 'C', 'Iron Will', 'Unbreakable resolve.', '{}'::jsonb),
  ('title_shadow_hunter', 'title', 'B', 'Shadow Hunter', 'Moves in silence.', '{}'::jsonb),
  ('title_sovereign', 'title', 'S', 'Sovereign', 'Top of the food chain.', '{}'::jsonb),

  -- Avatar borders
  ('avatar_border_slate', 'avatar_border', 'E', 'Slate Ring', 'A simple steel frame.',
    '{"colors":["#94A3B8","#64748B"],"glow":"#94A3B8","width":3}'::jsonb),
  ('avatar_border_ember', 'avatar_border', 'D', 'Ember Ring', 'Warm forge glow.',
    '{"colors":["#F59E0B","#EA580C"],"glow":"#F59E0B","width":3}'::jsonb),
  ('avatar_border_azure', 'avatar_border', 'B', 'Azure Ring', 'Cool system neon.',
    '{"colors":["#38BDF8","#2563EB"],"glow":"#38BDF8","width":3}'::jsonb),
  ('avatar_border_mythic', 'avatar_border', 'S', 'Mythic Ring', 'Impossible prism light.',
    '{"colors":["#A855F7","#F472B6"],"glow":"#C084FC","width":4}'::jsonb),

  -- Level borders
  ('level_border_steel', 'level_border', 'E', 'Steel Frame', 'Basic badge trim.',
    '{"colors":["#CBD5E1","#94A3B8"],"glow":"#94A3B8","width":2}'::jsonb),
  ('level_border_jade', 'level_border', 'C', 'Jade Frame', 'Fresh rank glow.',
    '{"colors":["#34D399","#059669"],"glow":"#34D399","width":2}'::jsonb),
  ('level_border_crimson', 'level_border', 'A', 'Crimson Frame', 'High-stakes heat.',
    '{"colors":["#F87171","#DC2626"],"glow":"#F87171","width":3}'::jsonb),
  ('level_border_void', 'level_border', 'S', 'Void Frame', 'Edge of the abyss.',
    '{"colors":["#818CF8","#4F46E5"],"glow":"#818CF8","width":3}'::jsonb),

  -- Profile banners
  ('banner_dawn', 'banner', 'E', 'Dawn Wash', 'Soft morning gradient.',
    '{"colors":["#FDE68A","#FDBA74","#FB7185"]}'::jsonb),
  ('banner_depth', 'banner', 'D', 'Ocean Depth', 'Cool blue dive.',
    '{"colors":["#0EA5E9","#0369A1","#0F172A"]}'::jsonb),
  ('banner_aurora', 'banner', 'B', 'Aurora Sweep', 'Northern lights wash.',
    '{"colors":["#22D3EE","#A78BFA","#F472B6"]}'::jsonb),
  ('banner_eclipse', 'banner', 'S', 'Eclipse Veil', 'Mythic dark gradient.',
    '{"colors":["#1E1B4B","#7C3AED","#F43F5E"]}'::jsonb)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Pick a random active cosmetic of a given rarity (prefer unowned by p_user_id)
-- ----------------------------------------------------------------------------
create or replace function public.pick_crate_cosmetic(
  p_rarity text,
  p_user_id uuid
)
returns public.cosmetic_items
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_item public.cosmetic_items;
begin
  -- Prefer unowned at this rarity.
  select ci.* into v_item
  from public.cosmetic_items ci
  where ci.active = true
    and ci.rarity = p_rarity
    and not exists (
      select 1 from public.user_cosmetics uc
      where uc.user_id = p_user_id and uc.cosmetic_id = ci.id
    )
  order by random()
  limit 1;

  if found then
    return v_item;
  end if;

  -- Fallback: any active at this rarity (duplicate OK — open will no-op insert).
  select ci.* into v_item
  from public.cosmetic_items ci
  where ci.active = true
    and ci.rarity = p_rarity
  order by random()
  limit 1;

  return v_item;
end;
$$;

revoke execute on function public.pick_crate_cosmetic(text, uuid)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Crate loot: always XP; ~30% chance of same-rarity cosmetic bonus.
-- Note: build_crate_loot now takes the opening user so it can prefer unowned.
-- ----------------------------------------------------------------------------
create or replace function public.build_crate_loot(p_user_id uuid default null)
returns jsonb
language plpgsql
volatile
as $$
declare
  v_rarity text := public.roll_reward_rarity();
  v_xp integer := public.reward_rarity_xp(v_rarity);
  v_badge integer := public.reward_rarity_badge_level(v_rarity);
  v_name text := public.reward_rarity_name(v_rarity);
  v_rewards jsonb;
  v_cosmetic public.cosmetic_items;
  v_kind_label text;
begin
  v_rewards := jsonb_build_array(
    jsonb_build_object(
      'kind', 'xp',
      'rarity', v_rarity,
      'amount', v_xp,
      'badgeLevel', v_badge,
      'label', upper(v_name) || ' XP DROP',
      'value', '+' || v_xp || ' XP'
    )
  );

  -- ~30% chance of a cosmetic of the same rarity.
  if random() < 0.30 and p_user_id is not null then
    v_cosmetic := public.pick_crate_cosmetic(v_rarity, p_user_id);
    if v_cosmetic.id is not null then
      v_kind_label := case v_cosmetic.kind
        when 'title' then 'TITLE'
        when 'avatar_border' then 'AVATAR BORDER'
        when 'level_border' then 'LEVEL BORDER'
        when 'banner' then 'BANNER'
        else 'COSMETIC'
      end;

      v_rewards := v_rewards || jsonb_build_array(
        jsonb_build_object(
          'kind', 'cosmetic',
          'rarity', v_cosmetic.rarity,
          'cosmeticId', v_cosmetic.id,
          'cosmeticKind', v_cosmetic.kind,
          'name', v_cosmetic.name,
          'label', v_kind_label || ' UNLOCKED',
          'value', v_cosmetic.name
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'version', 1,
    'rewards', v_rewards
  );
end;
$$;

revoke execute on function public.build_crate_loot(uuid) from public, anon, authenticated;

-- Keep zero-arg overload for any callers / replays that still use it.
create or replace function public.build_crate_loot()
returns jsonb
language plpgsql
volatile
as $$
begin
  return public.build_crate_loot(null);
end;
$$;

revoke execute on function public.build_crate_loot() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Open crate: roll loot, grant XP + cosmetics, persist contents.
-- ----------------------------------------------------------------------------
create or replace function public.open_reward_crate(p_crate_id uuid)
returns public.user_reward_crates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_crate public.user_reward_crates;
  v_contents jsonb;
  v_reward jsonb;
  v_rarity text;
  v_xp integer;
  v_old_xp integer;
  v_new_xp integer;
  v_rewards jsonb;
  v_i integer;
  v_cosmetic_id text;
  v_top_name text;
  v_reward_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_crate_id is null then
    raise exception 'Crate id is required';
  end if;

  select *
  into v_crate
  from public.user_reward_crates
  where id = p_crate_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Reward crate not found';
  end if;

  -- Already opened — return persisted loot (safe to replay reveal).
  if v_crate.status = 'opened' then
    return v_crate;
  end if;

  v_contents := public.build_crate_loot(v_user_id);
  v_rewards := v_contents -> 'rewards';
  v_reward := v_rewards -> 0;
  v_rarity := coalesce(v_reward ->> 'rarity', 'E');
  v_xp := coalesce((v_reward ->> 'amount')::integer, public.reward_rarity_xp(v_rarity));

  -- Grant XP + re-derive rank.
  select xp into v_old_xp
  from public.profiles
  where id = v_user_id
  for update;

  v_new_xp := greatest(0, coalesce(v_old_xp, 0) + v_xp);

  update public.profiles
  set
    xp = v_new_xp,
    rank = public.rank_for_xp(v_new_xp)
  where id = v_user_id;

  insert into public.xp_awards (kind, user_id, reward_crate_id, xp_amount)
  values ('crate_reward', v_user_id, v_crate.id, v_xp);

  -- Grant any cosmetic rewards.
  v_reward_count := jsonb_array_length(v_rewards);
  for v_i in 0 .. (v_reward_count - 1) loop
    v_reward := v_rewards -> v_i;
    if v_reward ->> 'kind' = 'cosmetic' then
      v_cosmetic_id := v_reward ->> 'cosmeticId';
      if v_cosmetic_id is not null then
        insert into public.user_cosmetics (user_id, cosmetic_id, source)
        values (v_user_id, v_cosmetic_id, 'crate')
        on conflict (user_id, cosmetic_id) do nothing;
      end if;
    end if;
  end loop;

  v_top_name := public.reward_rarity_name(v_rarity);

  update public.user_reward_crates
  set
    status = 'opened',
    opened_at = now(),
    tier = v_rarity,
    title = v_top_name || case
      when v_reward_count > 1 then ' Cache + Cosmetic'
      else ' XP Cache'
    end,
    subtitle =
      v_top_name
      || ' drop · +'
      || v_xp
      || ' XP'
      || case
           when v_reward_count > 1 then ' · cosmetic unlocked'
           else ''
         end,
    contents = v_contents
  where id = v_crate.id
  returning * into v_crate;

  return v_crate;
end;
$$;

revoke execute on function public.open_reward_crate(uuid) from public, anon;
grant execute on function public.open_reward_crate(uuid) to authenticated;
