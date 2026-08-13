-- Shop rotation: weekly → daily (24h, UTC midnight → next midnight).

create or replace function public.shop_current_rotation_key(p_at timestamptz default now())
returns text
language sql
stable
as $$
  select to_char(timezone('utc', p_at), 'YYYY-MM-DD');
$$;

create or replace function public.shop_rotation_ends_at(p_at timestamptz default now())
returns timestamptz
language sql
stable
as $$
  select date_trunc('day', timezone('utc', p_at))::timestamp
         at time zone 'utc' + interval '1 day';
$$;

revoke execute on function public.shop_current_rotation_key(timestamptz)
  from public, anon;
grant execute on function public.shop_current_rotation_key(timestamptz) to authenticated;

revoke execute on function public.shop_rotation_ends_at(timestamptz)
  from public, anon;
grant execute on function public.shop_rotation_ends_at(timestamptz) to authenticated;
