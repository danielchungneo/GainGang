-- Enum value level_up must already exist (see 0038_add_level_up_crate_source.sql).

drop function if exists public.roll_reward_rarity();
drop function if exists public.roll_reward_rarity(text);
drop function if exists public.build_crate_loot(uuid);
drop function if exists public.build_crate_loot();
drop function if exists public.build_crate_loot(uuid, text);

alter table public.user_reward_crates
  add column if not exists source_level integer;

comment on column public.user_reward_crates.source_level is
  'For level_up crates: the player level that granted this crate.';

comment on column public.user_reward_crates.tier is
  'Crate floor rarity (E–S). Sealed crates use this as the minimum loot rarity.';

create unique index if not exists user_reward_crates_level_up_unique
  on public.user_reward_crates (user_id, source_level)
  where source = 'level_up' and source_level is not null;

-- Existing sealed daily crates were stored as aura — treat them as D floors.
update public.user_reward_crates
set tier = 'D'
where source = 'daily_completion'
  and status = 'sealed'
  and tier = 'aura';

-- ----------------------------------------------------------------------------
-- XP → level (must match types/index.ts XP_LEVEL_BASE=100, INCREMENT=25)
-- ----------------------------------------------------------------------------
create or replace function public.xp_to_advance_from_level(p_level integer)
returns integer
language sql
immutable
as $$
  select 100 + (greatest(1, coalesce(p_level, 1)) - 1) * 25;
$$;

revoke execute on function public.xp_to_advance_from_level(integer)
  from public, anon, authenticated;

create or replace function public.level_from_xp(p_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  v_level integer := 1;
  v_acc integer := 0;
  v_need integer;
  v_total integer := greatest(0, coalesce(p_xp, 0));
begin
  loop
    v_need := public.xp_to_advance_from_level(v_level);
    exit when v_acc + v_need > v_total;
    v_acc := v_acc + v_need;
    v_level := v_level + 1;
    exit when v_level > 10000;
  end loop;
  return v_level;
end;
$$;

revoke execute on function public.level_from_xp(integer)
  from public, anon, authenticated;

create or replace function public.crate_tier_for_level(p_level integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_level, 0) > 0 and p_level % 10 = 0 then 'B'
    when coalesce(p_level, 0) > 0 and p_level % 5 = 0 then 'C'
    else 'E'
  end;
$$;

revoke execute on function public.crate_tier_for_level(integer)
  from public, anon, authenticated;

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

-- ----------------------------------------------------------------------------
-- Weighted rarity roll with a minimum floor.
-- Base weights (must match lib/rewards/rarities.ts): E40 D25 C18 B10 A5 S2
-- Eligible tiers keep relative weight; removed tiers are excluded and the rest
-- are renormalormalized by rolling against their weight sum.
-- ----------------------------------------------------------------------------
create or replace function public.roll_reward_rarity(p_min_rarity text default 'E')
returns text
language plpgsql
volatile
as $$
declare
  v_labels text[] := array['E', 'D', 'C', 'B', 'A', 'S'];
  v_weights integer[] := array[40, 25, 18, 10, 5, 2];
  v_start integer := 1;
  v_i integer;
  v_sum integer := 0;
  v_roll integer;
  v_cursor integer := 0;
begin
  for v_i in 1 .. array_length(v_labels, 1) loop
    if v_labels[v_i] = upper(coalesce(p_min_rarity, 'E')) then
      v_start := v_i;
      exit;
    end if;
  end loop;

  for v_i in v_start .. array_length(v_weights, 1) loop
    v_sum := v_sum + v_weights[v_i];
  end loop;

  if v_sum <= 0 then
    return v_labels[v_start];
  end if;

  v_roll := floor(random() * v_sum)::integer; -- 0 .. v_sum-1

  for v_i in v_start .. array_length(v_weights, 1) loop
    v_cursor := v_cursor + v_weights[v_i];
    if v_roll < v_cursor then
      return v_labels[v_i];
    end if;
  end loop;

  return v_labels[array_length(v_labels, 1)];
end;
$$;

-- Keep zero-arg overload for any callers.
create or replace function public.roll_reward_rarity()
returns text
language plpgsql
volatile
as $$
begin
  return public.roll_reward_rarity('E');
end;
$$;

revoke execute on function public.roll_reward_rarity(text) from public, anon, authenticated;
revoke execute on function public.roll_reward_rarity() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Crate loot: exclusive XP vs cosmetic; rarity floored by crate tier.
-- ----------------------------------------------------------------------------
create or replace function public.build_crate_loot(
  p_user_id uuid default null,
  p_min_rarity text default 'E'
)
returns jsonb
language plpgsql
volatile
as $$
declare
  v_rarity text := public.roll_reward_rarity(p_min_rarity);
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

-- Back-compat single-arg overload.
create or replace function public.build_crate_loot(p_user_id uuid)
returns jsonb
language plpgsql
volatile
as $$
begin
  return public.build_crate_loot(p_user_id, 'E');
end;
$$;

create or replace function public.build_crate_loot()
returns jsonb
language plpgsql
volatile
as $$
begin
  return public.build_crate_loot(null, 'E');
end;
$$;

revoke execute on function public.build_crate_loot(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.build_crate_loot(uuid)
  from public, anon, authenticated;
revoke execute on function public.build_crate_loot()
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Open crate using its sealed tier as the loot floor.
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
  v_min_rarity text;
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

  if v_crate.status = 'opened' then
    return v_crate;
  end if;

  v_min_rarity := case
    when v_crate.tier in ('E', 'D', 'C', 'B', 'A', 'S') then v_crate.tier
    else 'E'
  end;

  v_contents := public.build_crate_loot(v_user_id, v_min_rarity);
  v_rewards := coalesce(v_contents -> 'rewards', '[]'::jsonb);
  v_reward_count := jsonb_array_length(v_rewards);
  v_rarity := coalesce(v_rewards -> 0 ->> 'rarity', v_min_rarity);

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
    -- Keep sealed crate floor in `tier`; loot rarity lives in contents.
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

-- ----------------------------------------------------------------------------
-- Daily completion → uncommon (D) sealed crate
-- ----------------------------------------------------------------------------
create or replace function public.try_grant_daily_reward_crate(
  p_user_id uuid,
  p_reward_date date
)
returns public.user_reward_crates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crate public.user_reward_crates;
begin
  if p_user_id is null or p_reward_date is null then
    return null;
  end if;

  select *
  into v_crate
  from public.user_reward_crates
  where user_id = p_user_id
    and source = 'daily_completion'
    and source_date = p_reward_date;

  if found then
    return v_crate;
  end if;

  if not public.user_completed_daily_goals(p_user_id, p_reward_date) then
    return null;
  end if;

  begin
    insert into public.user_reward_crates (
      user_id,
      source,
      source_date,
      status,
      tier,
      title,
      subtitle
    )
    values (
      p_user_id,
      'daily_completion',
      p_reward_date,
      'sealed',
      'D',
      'Uncommon Reward Crate',
      'Earned by clearing every exercise for the day. Guarantees Uncommon or better.'
    )
    returning * into v_crate;

    return v_crate;
  exception
    when unique_violation then
      select *
      into v_crate
      from public.user_reward_crates
      where user_id = p_user_id
        and source = 'daily_completion'
        and source_date = p_reward_date;
      return v_crate;
  end;
end;
$$;

revoke execute on function public.try_grant_daily_reward_crate(uuid, date)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Level-up crates (one sealed crate per level crossed)
-- ----------------------------------------------------------------------------
create or replace function public.try_grant_level_up_crate(
  p_user_id uuid,
  p_level integer
)
returns public.user_reward_crates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crate public.user_reward_crates;
  v_tier text;
  v_name text;
begin
  if p_user_id is null or p_level is null or p_level < 1 then
    return null;
  end if;

  select *
  into v_crate
  from public.user_reward_crates
  where user_id = p_user_id
    and source = 'level_up'
    and source_level = p_level;

  if found then
    return v_crate;
  end if;

  v_tier := public.crate_tier_for_level(p_level);
  v_name := public.reward_rarity_name(v_tier);

  begin
    insert into public.user_reward_crates (
      user_id,
      source,
      source_date,
      source_level,
      status,
      tier,
      title,
      subtitle
    )
    values (
      p_user_id,
      'level_up',
      current_date,
      p_level,
      'sealed',
      v_tier,
      v_name || ' Level-Up Crate',
      'Reached level ' || p_level || '. Guarantees ' || v_name || ' or better.'
    )
    returning * into v_crate;

    return v_crate;
  exception
    when unique_violation then
      select *
      into v_crate
      from public.user_reward_crates
      where user_id = p_user_id
        and source = 'level_up'
        and source_level = p_level;
      return v_crate;
  end;
end;
$$;

revoke execute on function public.try_grant_level_up_crate(uuid, integer)
  from public, anon, authenticated;

create or replace function public.grant_level_up_crates_on_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_level integer;
  v_new_level integer;
  v_level integer;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.xp is not distinct from old.xp then
    return new;
  end if;

  v_old_level := public.level_from_xp(old.xp);
  v_new_level := public.level_from_xp(new.xp);

  if v_new_level <= v_old_level then
    return new;
  end if;

  for v_level in (v_old_level + 1) .. v_new_level loop
    perform public.try_grant_level_up_crate(new.id, v_level);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_grant_level_up_crates on public.profiles;
create trigger trg_grant_level_up_crates
  after update of xp on public.profiles
  for each row
  execute function public.grant_level_up_crates_on_xp();
