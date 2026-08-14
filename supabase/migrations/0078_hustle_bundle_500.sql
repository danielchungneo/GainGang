-- Hustle Bundle: 1,000 → 500 Creds. Must stay in sync with lib/shop.ts CREDS_PACKS.

create or replace function public.creds_amount_for_iap_product(p_product_id text)
returns integer
language sql
immutable
as $$
  select case p_product_id
    when 'com.danielchungneo.gaingang.creds.hustle' then 500
    when 'com.danielchungneo.gaingang.creds.beast' then 6500
    when 'com.danielchungneo.gaingang.creds.apex' then 15000
    else null
  end;
$$;

revoke execute on function public.creds_amount_for_iap_product(text)
  from public, anon, authenticated;
