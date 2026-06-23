-- Idempotent XP milestone tracking — prevents re-farming goal bonuses by editing amounts.

create type public.xp_award_kind as enum ('activity_log', 'personal_goal', 'gang_goal');

create table if not exists public.xp_awards (
  id                     uuid primary key default gen_random_uuid(),
  kind                   public.xp_award_kind not null,
  user_id                uuid references public.profiles(id) on delete cascade,
  gang_id                uuid references public.gangs(id) on delete cascade,
  daily_goal_exercise_id uuid references public.daily_goal_exercises(id) on delete cascade,
  quest_id               uuid references public.quests(id) on delete cascade,
  xp_amount              integer not null check (xp_amount > 0),
  created_at             timestamptz not null default now()
);

create unique index if not exists xp_awards_activity_log_dge
  on public.xp_awards (user_id, daily_goal_exercise_id)
  where kind = 'activity_log' and daily_goal_exercise_id is not null;

create unique index if not exists xp_awards_activity_log_quest
  on public.xp_awards (user_id, quest_id)
  where kind = 'activity_log' and quest_id is not null;

create unique index if not exists xp_awards_personal_goal_dge
  on public.xp_awards (user_id, daily_goal_exercise_id)
  where kind = 'personal_goal' and daily_goal_exercise_id is not null;

create unique index if not exists xp_awards_personal_goal_quest
  on public.xp_awards (user_id, quest_id)
  where kind = 'personal_goal' and quest_id is not null;

create unique index if not exists xp_awards_gang_goal_dge
  on public.xp_awards (gang_id, daily_goal_exercise_id)
  where kind = 'gang_goal' and daily_goal_exercise_id is not null;

create unique index if not exists xp_awards_gang_goal_quest
  on public.xp_awards (gang_id, quest_id)
  where kind = 'gang_goal' and quest_id is not null;

create index if not exists xp_awards_user_kind_idx
  on public.xp_awards (user_id, kind);

alter table public.xp_awards enable row level security;

drop policy if exists "xp_awards_select_own" on public.xp_awards;
create policy "xp_awards_select_own" on public.xp_awards
  for select using (auth.uid() = user_id);

drop policy if exists "xp_awards_insert_personal" on public.xp_awards;
create policy "xp_awards_insert_personal" on public.xp_awards
  for insert with check (
    user_id = auth.uid()
    and kind in ('activity_log', 'personal_goal')
  );

drop policy if exists "xp_awards_insert_gang_goal" on public.xp_awards;
create policy "xp_awards_insert_gang_goal" on public.xp_awards
  for insert with check (
    kind = 'gang_goal'
    and user_id is null
    and gang_id is not null
    and exists (
      select 1 from public.gang_members gm
      where gm.gang_id = xp_awards.gang_id
        and gm.user_id = auth.uid()
    )
  );

grant select, insert on public.xp_awards to authenticated;
