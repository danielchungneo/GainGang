-- Creds: guaranteed crate currency scaled by the sealed crate's rarity floor.
-- profiles.currency already exists; this wires grants, a ledger, and loot JSON.

comment on column public.profiles.currency is
  'Creds — spendable in-game currency for the cosmetic shop.';

-- ----------------------------------------------------------------------------
-- Ledger
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'currency_award_kind' and typnamespace = 'public'::regnamespace
  ) then
    create type public.currency_award_kind as enum ('crate_reward');
  end if;
end;
$$;

create table if not exists public.currency_awards (
  id              uuid primary key default gen_random_uuid(),
  kind            public.currency_award_kind not null,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  reward_crate_id uuid references public.user_reward_crates(id) on delete set null,
  amount          integer not null check (amount > 0),
  created_at      timestamptz not null default now()
);

create unique index if not exists currency_awards_crate_reward_unique
  on public.currency_awards (user_id, reward_crate_id)
  where kind = 'crate_reward' and reward_crate_id is not null;

create index if not exists currency_awards_user_kind_idx
  on public.currency_awards (user_id, kind);

alter table public.currency_awards enable row level security;

drop policy if exists "currency_awards_select_own" on public.currency_awards;
create policy "currency_awards_select_own" on public.currency_awards
  for select using (auth.uid() = user_id);

grant select on public.currency_awards to authenticated;

-- Block direct client writes to the wallet. Security-definer RPCs still can.
create or replace function public.protect_profile_currency()
returns trigger
language plpgsql
as $$
begin
  if new.currency is distinct from old.currency
     and current_user in ('authenticated', 'anon') then
    raise exception 'Cannot update currency directly';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_currency on public.profiles;
create trigger profiles_protect_currency
  before update on public.profiles
  for each row
  execute function public.protect_profile_currency();

-- ----------------------------------------------------------------------------
-- Amounts (must match lib/rewards/rarities.ts credsAmount)
-- E100 D250 C500 B1000 A2000 S5000
-- ----------------------------------------------------------------------------
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

-- Append a crate-tier Creds line if contents don't already have one.
create or replace function public.with_crate_creds(p_contents jsonb, p_crate_rarity text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_rarity text := case
    when p_crate_rarity in ('E', 'D', 'C', 'B', 'A', 'S') then p_crate_rarity
    else 'E'
  end;
  v_rewards jsonb := coalesce(p_contents -> 'rewards', '[]'::jsonb);
  v_i integer;
  v_reward jsonb;
begin
  if p_contents is null or jsonb_typeof(p_contents) is distinct from 'object' then
    return jsonb_build_object(
      'version', 1,
      'rewards', jsonb_build_array(public.creds_reward_json(v_rarity))
    );
  end if;

  for v_i in 0 .. greatest(jsonb_array_length(v_rewards) - 1, 0) loop
    v_reward := v_rewards -> v_i;
    if v_reward ->> 'kind' = 'creds' then
      return p_contents;
    end if;
  end loop;

  return jsonb_set(
    p_contents,
    '{rewards}',
    v_rewards || jsonb_build_array(public.creds_reward_json(v_rarity))
  );
end;
$$;

revoke execute on function public.with_crate_creds(jsonb, text)
  from public, anon, authenticated;

create or replace function public.grant_currency(
  p_user_id uuid,
  p_amount integer,
  p_kind public.currency_award_kind,
  p_reward_crate_id uuid default null
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
  set currency = currency + p_amount
  where id = p_user_id
  returning currency into v_balance;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.currency_awards (kind, user_id, reward_crate_id, amount)
  values (p_kind, p_user_id, p_reward_crate_id, p_amount);

  return v_balance;
end;
$$;

revoke execute on function public.grant_currency(uuid, integer, public.currency_award_kind, uuid)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Crate loot: exclusive XP vs cosmetic, plus guaranteed Creds at crate floor.
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
  v_crate_rarity text := case
    when p_min_rarity in ('E', 'D', 'C', 'B', 'A', 'S') then p_min_rarity
    else 'E'
  end;
  v_rarity text := public.roll_reward_rarity(v_crate_rarity);
  v_xp integer := public.reward_rarity_xp(v_rarity);
  v_badge integer := public.reward_rarity_badge_level(v_rarity);
  v_name text := public.reward_rarity_name(v_rarity);
  v_cosmetic public.cosmetic_items;
  v_kind_label text;
  v_has_unowned boolean := false;
  v_contents jsonb;
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

      v_contents := jsonb_build_object(
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
      return public.with_crate_creds(v_contents, v_crate_rarity);
    end if;
  end if;

  v_contents := jsonb_build_object(
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
  return public.with_crate_creds(v_contents, v_crate_rarity);
end;
$$;

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
-- Open crate: apply XP / cosmetic / Creds from generated contents.
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
  v_has_creds boolean := false;
  v_creds integer := 0;
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

  v_contents := public.with_crate_creds(
    public.build_crate_loot(v_user_id, v_min_rarity),
    v_min_rarity
  );
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
    elsif v_reward ->> 'kind' = 'creds' then
      v_has_creds := true;
      v_creds := coalesce(
        (v_reward ->> 'amount')::integer,
        public.reward_rarity_creds(v_min_rarity)
      );
    end if;
  end loop;

  if not v_has_creds then
    v_creds := public.reward_rarity_creds(v_min_rarity);
    v_has_creds := v_creds > 0;
  end if;

  select xp into v_old_xp
  from public.profiles
  where id = v_user_id
  for update;

  if v_has_xp and v_xp > 0 then
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

  if v_has_creds and v_creds > 0 then
    perform public.grant_currency(v_user_id, v_creds, 'crate_reward', v_crate.id);
  end if;

  v_top_name := public.reward_rarity_name(v_rarity);

  update public.user_reward_crates
  set
    status = 'opened',
    opened_at = now(),
    title = case
      when v_has_cosmetic and not v_has_xp then v_top_name || ' Cosmetic Cache'
      else v_top_name || ' XP Cache'
    end,
    subtitle = case
      when v_has_cosmetic and not v_has_xp then
        v_top_name || ' drop · ' || coalesce(v_cosmetic_name, 'cosmetic unlocked')
        || ' · +' || v_creds || ' Creds'
      else
        v_top_name || ' drop · +' || v_xp || ' XP · +' || v_creds || ' Creds'
    end,
    contents = v_contents
  where id = v_crate.id
  returning * into v_crate;

  return v_crate;
end;
$$;

revoke execute on function public.open_reward_crate(uuid) from public, anon;
grant execute on function public.open_reward_crate(uuid) to authenticated;
