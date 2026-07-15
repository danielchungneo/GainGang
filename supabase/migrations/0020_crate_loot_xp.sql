-- Roll rarity-weighted XP loot when opening a daily reward crate.
-- Extensible contents jsonb: { version: 1, rewards: [{ kind, rarity, ... }] }
-- Requires 0019_crate_loot_xp_enum.sql (crate_reward on xp_award_kind).

alter table public.xp_awards
  add column if not exists reward_crate_id uuid
    references public.user_reward_crates(id) on delete cascade;

create unique index if not exists xp_awards_crate_reward_unique
  on public.xp_awards (user_id, reward_crate_id)
  where kind = 'crate_reward' and reward_crate_id is not null;

-- ----------------------------------------------------------------------------
-- Weighted rarity roll (weights must match lib/rewards/rarities.ts)
--   E 45 · D 25 · C 15 · B 9 · A 5 · S 1   (sum 100)
-- ----------------------------------------------------------------------------
create or replace function public.roll_reward_rarity()
returns text
language plpgsql
volatile
as $$
declare
  v_roll integer := floor(random() * 100); -- 0..99
begin
  if v_roll < 45 then
    return 'E';
  elsif v_roll < 70 then
    return 'D';
  elsif v_roll < 85 then
    return 'C';
  elsif v_roll < 94 then
    return 'B';
  elsif v_roll < 99 then
    return 'A';
  else
    return 'S';
  end if;
end;
$$;

revoke execute on function public.roll_reward_rarity() from public, anon, authenticated;

create or replace function public.reward_rarity_xp(p_rarity text)
returns integer
language sql
immutable
as $$
  select case p_rarity
    when 'E' then 25
    when 'D' then 50
    when 'C' then 100
    when 'B' then 200
    when 'A' then 400
    when 'S' then 800
    else 25
  end;
$$;

revoke execute on function public.reward_rarity_xp(text) from public, anon, authenticated;

create or replace function public.reward_rarity_badge_level(p_rarity text)
returns integer
language sql
immutable
as $$
  select case p_rarity
    when 'E' then 5
    when 'D' then 15
    when 'C' then 25
    when 'B' then 35
    when 'A' then 45
    when 'S' then 55
    else 5
  end;
$$;

revoke execute on function public.reward_rarity_badge_level(text) from public, anon, authenticated;

create or replace function public.reward_rarity_name(p_rarity text)
returns text
language sql
immutable
as $$
  select case p_rarity
    when 'E' then 'Common'
    when 'D' then 'Uncommon'
    when 'C' then 'Rare'
    when 'B' then 'Epic'
    when 'A' then 'Legendary'
    when 'S' then 'Mythic'
    else 'Common'
  end;
$$;

revoke execute on function public.reward_rarity_name(text) from public, anon, authenticated;

create or replace function public.rank_for_xp(p_xp integer)
returns text
language sql
immutable
as $$
  select case
    when p_xp >= 20000 then 'S'
    when p_xp >= 9000 then 'A'
    when p_xp >= 4000 then 'B'
    when p_xp >= 1500 then 'C'
    when p_xp >= 500 then 'D'
    else 'E'
  end;
$$;

revoke execute on function public.rank_for_xp(integer) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Build loot payload for a daily crate. Add more reward kinds here later.
-- ----------------------------------------------------------------------------
create or replace function public.build_crate_loot()
returns jsonb
language plpgsql
volatile
as $$
declare
  v_rarity text := public.roll_reward_rarity();
  v_xp integer := public.reward_rarity_xp(v_rarity);
  v_badge integer := public.reward_rarity_badge_level(v_rarity);
  v_name text := public.reward_rarity_name(v_rarity);
begin
  return jsonb_build_object(
    'version', 1,
    'rewards', jsonb_build_array(
      jsonb_build_object(
        'kind', 'xp',
        'rarity', v_rarity,
        'amount', v_xp,
        'badgeLevel', v_badge,
        'label', upper(v_name) || ' XP DROP',
        'value', '+' || v_xp || ' XP'
      )
    )
  );
end;
$$;

revoke execute on function public.build_crate_loot() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Open crate: roll loot once, grant XP, persist contents + tier.
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

  v_contents := public.build_crate_loot();
  v_reward := v_contents -> 'rewards' -> 0;
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

  update public.user_reward_crates
  set
    status = 'opened',
    opened_at = now(),
    tier = v_rarity,
    title = public.reward_rarity_name(v_rarity) || ' XP Cache',
    subtitle =
      public.reward_rarity_name(v_rarity)
      || ' drop · +'
      || v_xp
      || ' XP',
    contents = v_contents
  where id = v_crate.id
  returning * into v_crate;

  return v_crate;
end;
$$;

revoke execute on function public.open_reward_crate(uuid) from public, anon;
grant execute on function public.open_reward_crate(uuid) to authenticated;
