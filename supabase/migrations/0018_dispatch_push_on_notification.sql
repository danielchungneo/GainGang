-- When an in-app alert is created, fan out an Expo push via the dispatch-push edge function.
create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  supabase_url text := 'https://uqgzzpxujaxgodfduczb.supabase.co';
begin
  perform net.http_post(
    url := supabase_url || '/functions/v1/dispatch-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'notification_id', new.id,
      'record', to_jsonb(new)
    )
  );
  return new;
exception
  when others then
    -- Never block creating the in-app alert if push dispatch fails.
    raise warning 'dispatch_push_for_notification failed: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_dispatch_push_on_notification on public.notifications;
create trigger trg_dispatch_push_on_notification
  after insert on public.notifications
  for each row
  execute function public.dispatch_push_for_notification();

revoke all on function public.dispatch_push_for_notification() from public, anon, authenticated;
