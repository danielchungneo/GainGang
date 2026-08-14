-- IAP Cred bundles (RevenueCat / App Store / Play consumables).
-- Product IDs must stay in sync with lib/shop.ts CREDS_PACKS.
-- Depends on 0076_iap_award_kind (enum value 'iap_purchase').

create table if not exists public.iap_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null,
  store_transaction_id text not null,
  revenuecat_event_id text,
  amount integer not null check (amount > 0),
  store text,
  environment text,
  created_at timestamptz not null default now(),
  constraint iap_purchases_store_transaction_id_key unique (store_transaction_id)
);

create unique index if not exists iap_purchases_revenuecat_event_id_key
  on public.iap_purchases (revenuecat_event_id)
  where revenuecat_event_id is not null;

create index if not exists iap_purchases_user_id_idx
  on public.iap_purchases (user_id);

comment on table public.iap_purchases is
  'Idempotent ledger for store Cred-bundle purchases (RevenueCat / IAP).';

alter table public.iap_purchases enable row level security;

create or replace function public.creds_amount_for_iap_product(p_product_id text)
returns integer
language sql
immutable
as $$
  select case p_product_id
    when 'com.danielchungneo.gaingang.creds.hustle' then 1000
    when 'com.danielchungneo.gaingang.creds.beast' then 6500
    when 'com.danielchungneo.gaingang.creds.apex' then 15000
    else null
  end;
$$;

revoke execute on function public.creds_amount_for_iap_product(text)
  from public, anon, authenticated;

create or replace function public.grant_iap_creds(
  p_user_id uuid,
  p_product_id text,
  p_store_transaction_id text,
  p_revenuecat_event_id text default null,
  p_store text default null,
  p_environment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount integer;
  v_balance integer;
  v_existing public.iap_purchases%rowtype;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if coalesce(trim(p_store_transaction_id), '') = '' then
    raise exception 'Store transaction id is required';
  end if;

  v_amount := public.creds_amount_for_iap_product(p_product_id);
  if v_amount is null then
    raise exception 'Unknown IAP product: %', p_product_id;
  end if;

  if p_revenuecat_event_id is not null then
    select * into v_existing
    from public.iap_purchases
    where revenuecat_event_id = p_revenuecat_event_id;

    if found then
      select currency into v_balance from public.profiles where id = p_user_id;
      return jsonb_build_object(
        'ok', true,
        'already_fulfilled', true,
        'amount_granted', 0,
        'balance', coalesce(v_balance, 0),
        'product_id', v_existing.product_id,
        'store_transaction_id', v_existing.store_transaction_id
      );
    end if;
  end if;

  select * into v_existing
  from public.iap_purchases
  where store_transaction_id = p_store_transaction_id;

  if found then
    select currency into v_balance from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', true,
      'already_fulfilled', true,
      'amount_granted', 0,
      'balance', coalesce(v_balance, 0),
      'product_id', v_existing.product_id,
      'store_transaction_id', v_existing.store_transaction_id
    );
  end if;

  insert into public.iap_purchases (
    user_id,
    product_id,
    store_transaction_id,
    revenuecat_event_id,
    amount,
    store,
    environment
  )
  values (
    p_user_id,
    p_product_id,
    p_store_transaction_id,
    nullif(trim(p_revenuecat_event_id), ''),
    v_amount,
    p_store,
    p_environment
  );

  v_balance := public.grant_currency(
    p_user_id,
    v_amount,
    'iap_purchase'::public.currency_award_kind,
    null
  );

  return jsonb_build_object(
    'ok', true,
    'already_fulfilled', false,
    'amount_granted', v_amount,
    'balance', v_balance,
    'product_id', p_product_id,
    'store_transaction_id', p_store_transaction_id
  );
exception
  when unique_violation then
    select * into v_existing
    from public.iap_purchases
    where store_transaction_id = p_store_transaction_id
       or (p_revenuecat_event_id is not null and revenuecat_event_id = p_revenuecat_event_id)
    limit 1;

    select currency into v_balance from public.profiles where id = p_user_id;
    return jsonb_build_object(
      'ok', true,
      'already_fulfilled', true,
      'amount_granted', 0,
      'balance', coalesce(v_balance, 0),
      'product_id', coalesce(v_existing.product_id, p_product_id),
      'store_transaction_id', coalesce(v_existing.store_transaction_id, p_store_transaction_id)
    );
end;
$$;

revoke execute on function public.grant_iap_creds(uuid, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.grant_iap_creds(uuid, text, text, text, text, text)
  to service_role;
