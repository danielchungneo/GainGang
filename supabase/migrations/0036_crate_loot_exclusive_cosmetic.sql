-- Exclusive crate loot: roll rarity, then either one unowned same-rarity cosmetic
-- (65%) or XP (35%). If no unowned cosmetics exist at that rarity, always XP.
-- Never grants a cosmetic the user already owns.
-- Rarity weights: E 40 · D 25 · C 18 · B 10 · A 5 · S 2

-- ----------------------------------------------------------------------------
-- Weighted rarity roll (must match lib/rewards/rarities.ts)
-- ----------------------------------------------------------------------------
create or replace function public.roll_reward_rarity()
returns text
language plpgsql
volatile
as $$
declare
  v_roll integer := floor(random() * 100); -- 0..99
begin
  if v_roll < 40 then
    return 'E';
  elsif v_roll < 65 then
    return 'D';
  elsif v_roll < 83 then
    return 'C';
  elsif v_roll < 93 then
    return 'B';
  elsif v_roll < 98 then
    return 'A';
  else
    return 'S';
  end if;
end;
$$;

revoke execute on function public.roll_reward_rarity() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Pick a random unowned active cosmetic of a given rarity (no duplicates).
-- Returns null row when none are available.
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
  if p_user_id is null or p_rarity is null then
    return null;
  end if;

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

  return v_item;
end;
$$;

revoke execute on function public.pick_crate_cosmetic(text, uuid)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Crate loot: exclusive XP vs cosmetic for the rolled rarity.
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
  v_cosmetic public.cosmetic_items;
  v_kind_label text;
  v_has_unowned boolean := false;
begin
  if p_user_id is not null then
    select exists (
      select 1
      from public.cosmetic_items ci
      where ci.active = true
        and ci.rarity = v_rarity
        and not exists (
          select 1 from public.user_cosmetics uc
          where uc.user_id = p_user_id and uc.cosmetic_id = ci.id
        )
    ) into v_has_unowned;
  end if;

  -- Unowned cosmetics at this rarity → 65% cosmetic, 35% XP.
  if v_has_unowned and random() < 0.65 then
    v_cosmetic := public.pick_crate_cosmetic(v_rarity, p_user_id);

    if v_cosmetic.id is not null then
      v_kind_label := case v_cosmetic.kind
        when 'title' then 'TITLE'
        when 'avatar_border' then 'AVATAR BORDER'
        when 'level_border' then 'LEVEL BORDER'
        when 'banner' then 'BANNER'
        else 'COSMETIC'
      end;

      return jsonb_build_object(
        'version', 1,
        'rewards', jsonb_build_array(
          jsonb_build_object(
            'kind', 'cosmetic',
            'rarity', v_cosmetic.rarity,
            'cosmeticId', v_cosmetic.id,
            'cosmeticKind', v_cosmetic.kind,
            'name', v_cosmetic.name,
            'label', v_kind_label || ' UNLOCKED',
            'value', v_cosmetic.name
          )
        )
      );
    end if;
  end if;

  -- No eligible cosmetic (or XP won the roll) → XP only.
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

revoke execute on function public.build_crate_loot(uuid) from public, anon, authenticated;

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
-- Open crate: grant only the rolled reward (XP and/or cosmetic).
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
  v_xp integer := 0;
  v_old_xp integer;
  v_new_xp integer;
  v_rewards jsonb;
  v_i integer;
  v_cosmetic_id text;
  v_top_name text;
  v_reward_count integer;
  v_has_xp boolean := false;
  v_has_cosmetic boolean := false;
  v_cosmetic_name text;
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
  v_rewards := coalesce(v_contents -> 'rewards', '[]'::jsonb);
  v_reward_count := jsonb_array_length(v_rewards);
  v_rarity := coalesce(v_rewards -> 0 ->> 'rarity', 'E');

  for v_i in 0 .. greatest(v_reward_count - 1, 0) loop
    v_reward := v_rewards -> v_i;
    if v_reward ->> 'kind' = 'xp' then
      v_has_xp := true;
      v_xp := coalesce((v_reward ->> 'amount')::integer, public.reward_rarity_xp(v_rarity));
      v_rarity := coalesce(v_reward ->> 'rarity', v_rarity);
    elsif v_reward ->> 'kind' = 'cosmetic' then
      v_has_cosmetic := true;
      v_cosmetic_id := v_reward ->> 'cosmeticId';
      v_cosmetic_name := coalesce(v_reward ->> 'name', v_reward ->> 'value', 'Cosmetic');
      v_rarity := coalesce(v_reward ->> 'rarity', v_rarity);
    end if;
  end loop;

  if v_has_xp and v_xp > 0 then
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
  end if;

  if v_has_cosmetic and v_cosmetic_id is not null then
    insert into public.user_cosmetics (user_id, cosmetic_id, source)
    values (v_user_id, v_cosmetic_id, 'crate')
    on conflict (user_id, cosmetic_id) do nothing;
  end if;

  v_top_name := public.reward_rarity_name(v_rarity);

  update public.user_reward_crates
  set
    status = 'opened',
    opened_at = now(),
    tier = v_rarity,
    title = case
      when v_has_cosmetic and not v_has_xp then v_top_name || ' Cosmetic Cache'
      else v_top_name || ' XP Cache'
    end,
    subtitle = case
      when v_has_cosmetic and not v_has_xp then
        v_top_name || ' drop · ' || coalesce(v_cosmetic_name, 'cosmetic unlocked')
      else
        v_top_name || ' drop · +' || v_xp || ' XP'
    end,
    contents = v_contents
  where id = v_crate.id
  returning * into v_crate;

  return v_crate;
end;
$$;

revoke execute on function public.open_reward_crate(uuid) from public, anon;
grant execute on function public.open_reward_crate(uuid) to authenticated;
