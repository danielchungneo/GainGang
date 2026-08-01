-- Owner-only hard delete for gangs. Cleans related rows in a safe order so
-- daily_goal_exercises → exercises ON DELETE RESTRICT cannot block the cascade.

create or replace function public.delete_gang(p_gang_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.gangs where id = p_gang_id) then
    raise exception 'Gang not found';
  end if;

  if not public.is_gang_owner(p_gang_id) then
    raise exception 'Only the gang owner can delete this gang';
  end if;

  -- Clear plan slots before gang-custom exercises (RESTRICT on exercise_id).
  delete from public.weekly_plans
  where gang_id = p_gang_id;

  delete from public.quests
  where gang_id = p_gang_id;

  -- Match UI copy: permanently remove gang activity (cascades children).
  delete from public.activities
  where gang_id = p_gang_id;

  delete from public.xp_awards
  where gang_id = p_gang_id;

  delete from public.exercises
  where gang_id = p_gang_id;

  -- Cascades gang_members; nulls notifications.gang_id.
  delete from public.gangs
  where id = p_gang_id;
end;
$$;

revoke execute on function public.delete_gang(uuid) from public, anon;
grant  execute on function public.delete_gang(uuid) to authenticated;
