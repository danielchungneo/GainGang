-- Split starter border crate into icon_border + level_border so users can get both.

-- Drop old check, migrate rows, add new check.
alter table public.user_starter_cosmetic_crates
  drop constraint if exists user_starter_cosmetic_crates_category_check;

-- Remap any opened 'border' rows to the matching subtype from the granted cosmetic.
update public.user_starter_cosmetic_crates usc
set category = case ci.kind
  when 'avatar_border' then 'icon_border'
  when 'level_border' then 'level_border'
  else usc.category
end
from public.cosmetic_items ci
where usc.cosmetic_id = ci.id
  and usc.category = 'border';

alter table public.user_starter_cosmetic_crates
  add constraint user_starter_cosmetic_crates_category_check
  check (category in ('banner', 'title', 'icon_border', 'level_border'));

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
     or p_category not in ('banner', 'title', 'icon_border', 'level_border') then
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
      or (p_category = 'icon_border' and ci.kind = 'avatar_border')
      or (p_category = 'level_border' and ci.kind = 'level_border')
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
    when 'avatar_border' then 'ICON BORDER'
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
