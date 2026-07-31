-- ============================================================================
-- One free, guaranteed, non-duplicate starter cosmetic crate per category.
-- Categories: banner, title, border. Staging rollout.
-- ============================================================================

create table if not exists public.user_starter_cosmetic_crates (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  category   text not null check (category in ('banner', 'title', 'border')),
  cosmetic_id text not null references public.cosmetic_items(id) on delete restrict,
  opened_at  timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.user_starter_cosmetic_crates enable row level security;

drop policy if exists "starter_cosmetic_crates_select_self"
  on public.user_starter_cosmetic_crates;
create policy "starter_cosmetic_crates_select_self"
  on public.user_starter_cosmetic_crates
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.user_starter_cosmetic_crates is
  'Tracks the one-time starter crate opened in each cosmetic inventory category.';

create or replace function public.open_starter_cosmetic_crate(p_category text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.cosmetic_items;
  v_kind_label text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_category is null
     or p_category not in ('banner', 'title', 'border') then
    raise exception 'Invalid starter crate category';
  end if;

  if exists (
    select 1
    from public.user_starter_cosmetic_crates
    where user_id = v_user_id
      and category = p_category
  ) then
    raise exception 'This starter crate has already been opened';
  end if;

  select ci.*
  into v_item
  from public.cosmetic_items ci
  where ci.active = true
    and (
      (p_category = 'banner' and ci.kind = 'banner')
      or (p_category = 'title' and ci.kind = 'title')
      or (
        p_category = 'border'
        and ci.kind in ('avatar_border', 'level_border')
      )
    )
    and not exists (
      select 1
      from public.user_cosmetics uc
      where uc.user_id = v_user_id
        and uc.cosmetic_id = ci.id
    )
  order by random()
  limit 1;

  if not found then
    raise exception 'You already own every cosmetic in this category';
  end if;

  -- The unique key makes concurrent opens safe. The whole RPC is atomic.
  insert into public.user_starter_cosmetic_crates (
    user_id,
    category,
    cosmetic_id
  )
  values (
    v_user_id,
    p_category,
    v_item.id
  );

  insert into public.user_cosmetics (user_id, cosmetic_id, source)
  values (v_user_id, v_item.id, 'crate')
  on conflict (user_id, cosmetic_id) do nothing;

  v_kind_label := case v_item.kind
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
        'rarity', v_item.rarity,
        'cosmeticId', v_item.id,
        'cosmeticKind', v_item.kind,
        'name', v_item.name,
        'label', v_kind_label || ' UNLOCKED',
        'value', v_item.name
      )
    )
  );
end;
$$;

revoke execute on function public.open_starter_cosmetic_crate(text)
  from public, anon;
grant execute on function public.open_starter_cosmetic_crate(text)
  to authenticated;
