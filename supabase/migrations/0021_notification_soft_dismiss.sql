-- Soft-dismiss alerts so read notifications can be hidden without hard delete.
alter table public.notifications
  add column if not exists dismissed_at timestamptz null;

create index if not exists notifications_user_active_idx
  on public.notifications (user_id, is_read, created_at desc)
  where dismissed_at is null;
