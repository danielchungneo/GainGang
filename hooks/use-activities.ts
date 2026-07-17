import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { rankForXp } from '@/types';
import { queryKeys } from '@/lib/query-keys';
import { todayISO } from '@/lib/format';
import { refreshPersonalStreak } from '@/lib/streaks';
import { supabase } from '@/lib/supabase';
import type {
  Activity,
  ActivityExercise,
  ActivityExerciseSnapshot,
  ActivityFeedItem,
  ActivityWithExercises,
  ExerciseCategory,
  ExerciseUnit,
} from '@/types';

/** Flat XP for logging a new activity. */
export const XP_ACTIVITY_LOG = 10;
/** Bonus XP when the user hits their personal goal target. */
export const XP_PERSONAL_GOAL = 40;
/** Bonus XP for every gang member when the gang goal is completed. */
export const XP_GANG_GOAL = 50;

export interface QuestXpContext {
  gangId: string;
  gangTarget: number;
  individualTarget: number;
  gangTotalBefore: number;
  gangTotalAfter: number;
  userTotalBefore: number;
  userTotalAfter: number;
}

export interface ActivityXpRefs {
  dailyGoalExerciseId?: string;
  questId?: string;
}

export interface ActivitySaveResult {
  activity: Activity;
  exercise: ActivityExercise;
  xpAwarded: number;
}

const PG_UNIQUE_VIOLATION = '23505';

const ACTIVITY_SELECT = '*, exercises:activity_exercises(*)';

/** Best-effort XP estimate for UI previews (does not check persisted awards). */
export function estimateSessionXp(input: {
  isNewActivity: boolean;
  questXpContext?: QuestXpContext;
}): number {
  let total = input.isNewActivity ? XP_ACTIVITY_LOG : 0;
  const ctx = input.questXpContext;
  if (!ctx) return total;

  if (ctx.individualTarget > 0 && ctx.userTotalAfter >= ctx.individualTarget) {
    total += XP_PERSONAL_GOAL;
  }
  if (ctx.gangTarget > 0 && ctx.gangTotalAfter >= ctx.gangTarget) {
    total += XP_GANG_GOAL;
  }
  return total;
}

/** @deprecated Use estimateSessionXp — real awards are idempotent via xp_awards. */
export const computeSessionXp = estimateSessionXp;

/** The social feed for a single gang. */
export function useGangFeed(gangId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.feed(gangId),
    enabled: !!gangId,
    queryFn: async (): Promise<ActivityFeedItem[]> => {
      const { data, error } = await supabase
        .from('activities')
        .select(`${ACTIVITY_SELECT}, author:profiles(id, full_name, username, avatar_url, xp)`)
        .eq('gang_id', gangId)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return hydrateFeed((data ?? []) as ActivityWithAuthor[], userId);
    },
  });
}

/** The signed-in user's exercise lines for a daily goal. */
export function useDailyGoalActivities(dailyGoalId?: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.dailyGoalActivities(dailyGoalId, userId),
    enabled: !!dailyGoalId && !!userId,
    queryFn: async (): Promise<ActivityExercise[]> => {
      const { data: parent, error } = await supabase
        .from('activities')
        .select(ACTIVITY_SELECT)
        .eq('user_id', userId!)
        .eq('daily_goal_id', dailyGoalId!)
        .maybeSingle();
      if (error) throw error;
      return (parent?.exercises as ActivityExercise[] | undefined) ?? [];
    },
  });
}

/** The signed-in user's activity for a specific quest (if they've logged one). */
export function useQuestActivity(questId?: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.questActivity(questId, userId),
    enabled: !!questId && !!userId,
    queryFn: async (): Promise<ActivityExerciseSnapshot | null> => {
      const { data, error } = await supabase
        .from('activities')
        .select(ACTIVITY_SELECT)
        .eq('quest_id', questId!)
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const exercises = (data.exercises as ActivityExercise[] | undefined) ?? [];
      const exercise = exercises[0];
      if (!exercise) return null;

      return {
        ...exercise,
        gang_id: data.gang_id,
        quest_id: data.quest_id,
        daily_goal_id: data.daily_goal_id,
      };
    },
  });
}

/** The signed-in user's own activity history. */
/** Activities logged by a user (own profile or someone you can view via RLS). */
export function useUserActivities(userId?: string) {
  return useQuery({
    queryKey: queryKeys.myActivities(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ActivityWithExercises[]> => {
      const { data, error } = await supabase
        .from('activities')
        .select(ACTIVITY_SELECT)
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const rows: ActivityWithExercises[] = (data ?? []).map((row) => ({
        ...(row as Activity),
        exercises: (row.exercises as ActivityExercise[] | undefined) ?? [],
      }));

      return attachEngagementCounts(rows);
    },
  });
}

/** @deprecated Prefer useUserActivities(session.user.id) — kept for existing call sites. */
export function useMyActivities() {
  const { session } = useAuth();
  return useUserActivities(session?.user.id);
}

export interface LogActivityInput {
  gangId?: string;
  questId?: string;
  dailyGoalId?: string;
  dailyGoalExerciseId?: string;
  exerciseId?: string;
  exerciseName: string;
  category?: ExerciseCategory;
  unit: ExerciseUnit;
  amount: number;
  sets?: number;
  notes?: string;
  photoUrl?: string;
  activityDate?: string;
  questXpContext?: QuestXpContext;
  /** When false, skip flat activity-log XP (used for cross-gang fan-out). Default true. */
  awardActivityLogXp?: boolean;
  /** When true, skip personal streak refresh (caller already refreshed). Default false. */
  skipStreakRefresh?: boolean;
}

export interface UpdateActivityInput {
  exerciseRowId: string;
  activityId: string;
  gangId?: string | null;
  exerciseId?: string;
  exerciseName: string;
  category?: ExerciseCategory;
  unit: ExerciseUnit;
  amount: number;
  sets?: number;
  notes?: string;
  previousAmount: number;
  previousUnit: ExerciseUnit;
  dailyGoalExerciseId?: string;
  questId?: string;
  questXpContext?: QuestXpContext;
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (input: UpdateActivityInput): Promise<ActivitySaveResult> => {
      if (!userId) throw new Error('Not authenticated');

      const now = new Date().toISOString();
      const { data: exercise, error } = await supabase
        .from('activity_exercises')
        .update({
          exercise_id: input.exerciseId ?? null,
          exercise_name: input.exerciseName,
          category: input.category ?? null,
          unit: input.unit,
          amount: input.amount,
          sets: input.sets ?? null,
          notes: input.notes ?? null,
          updated_at: now,
        })
        .eq('id', input.exerciseRowId)
        .select('*')
        .single();
      if (error) throw error;

      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .update({ updated_at: now })
        .eq('id', input.activityId)
        .select('*')
        .single();
      if (activityError) throw activityError;

      const xpAwarded = await processActivityXp({
        userId,
        isNewActivity: false,
        questXpContext: input.questXpContext,
        refs: {
          dailyGoalExerciseId: input.dailyGoalExerciseId ?? exercise.daily_goal_exercise_id ?? undefined,
          questId: input.questId ?? activity.quest_id ?? undefined,
        },
      });
      await refreshPersonalStreak(userId);
      return { activity, exercise, xpAwarded };
    },
    onSuccess: ({ activity }) => {
      invalidateActivityQueries(queryClient, activity, userId);
    },
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (input: LogActivityInput): Promise<ActivitySaveResult> => {
      if (!userId) throw new Error('Not authenticated');

      const parent = await findOrCreateParentActivity(userId, input);
      const { exercise, isNewExercise } = await upsertActivityExercise(parent.id, input);

      const now = new Date().toISOString();
      const activityUpdates = {
        updated_at: now,
        ...(input.photoUrl ? { photo_url: input.photoUrl } : {}),
        ...(input.notes && !input.dailyGoalExerciseId ? { notes: input.notes } : {}),
      };

      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .update(activityUpdates)
        .eq('id', parent.id)
        .select('*')
        .single();
      if (activityError) throw activityError;

      const xpAwarded = await processActivityXp({
        userId,
        isNewActivity: isNewExercise && input.awardActivityLogXp !== false,
        questXpContext: input.questXpContext,
        refs: {
          dailyGoalExerciseId: input.dailyGoalExerciseId,
          questId: input.questId,
        },
      });
      if (!input.skipStreakRefresh) {
        await refreshPersonalStreak(userId);
      }
      return { activity, exercise, xpAwarded };
    },
    onSuccess: ({ activity }) => {
      invalidateActivityQueries(queryClient, activity, userId);
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (activity: Pick<Activity, 'id' | 'gang_id'>): Promise<void> => {
      const { error } = await supabase.from('activities').delete().eq('id', activity.id);
      if (error) throw error;
      if (userId) await refreshPersonalStreak(userId);
    },
    onSuccess: (_d, activity) => {
      if (activity.gang_id) queryClient.invalidateQueries({ queryKey: queryKeys.feed(activity.gang_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}

// ---- helpers ----
type ActivityWithAuthor = ActivityWithExercises & { author: ActivityFeedItem['author'] };

async function loadEngagementCounts(
  activityIds: string[],
): Promise<Map<string, { kudos_count: number; comment_count: number }>> {
  const counts = new Map<string, { kudos_count: number; comment_count: number }>();
  for (const id of activityIds) {
    counts.set(id, { kudos_count: 0, comment_count: 0 });
  }
  if (activityIds.length === 0) return counts;

  // Chunk `.in()` filters so PostgREST URLs stay under practical length limits.
  const chunkSize = 40;
  for (let i = 0; i < activityIds.length; i += chunkSize) {
    const chunk = activityIds.slice(i, i + chunkSize);
    const [{ data: kudos, error: kudosError }, { data: comments, error: commentsError }] =
      await Promise.all([
        supabase.from('kudos').select('activity_id').in('activity_id', chunk),
        supabase.from('comments').select('activity_id').in('activity_id', chunk),
      ]);
    if (kudosError) throw kudosError;
    if (commentsError) throw commentsError;

    for (const row of kudos ?? []) {
      const current = counts.get(row.activity_id);
      if (current) current.kudos_count += 1;
    }
    for (const row of comments ?? []) {
      const current = counts.get(row.activity_id);
      if (current) current.comment_count += 1;
    }
  }

  return counts;
}

async function attachEngagementCounts<T extends { id: string }>(
  rows: T[],
): Promise<(T & { kudos_count: number; comment_count: number })[]> {
  const counts = await loadEngagementCounts(rows.map((row) => row.id));
  return rows.map((row) => {
    const engagement = counts.get(row.id);
    return {
      ...row,
      kudos_count: engagement?.kudos_count ?? 0,
      comment_count: engagement?.comment_count ?? 0,
    };
  });
}

async function hydrateFeed(
  rows: ActivityWithAuthor[],
  userId?: string,
): Promise<ActivityFeedItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((a) => a.id);
  const withCounts = await attachEngagementCounts(rows);

  let myKudos = new Set<string>();
  if (userId) {
    const { data: mine, error } = await supabase
      .from('kudos')
      .select('activity_id')
      .eq('user_id', userId)
      .in('activity_id', ids);
    if (error) throw error;
    myKudos = new Set((mine ?? []).map((k) => k.activity_id));
  }

  return withCounts.map((a) => ({
    ...a,
    exercises: a.exercises ?? [],
    has_kudos: myKudos.has(a.id),
  }));
}

async function resolveDailyGoalMeta(dailyGoalExerciseId: string): Promise<{
  dailyGoalId: string;
  activityDate: string;
}> {
  const { data, error } = await supabase
    .from('daily_goal_exercises')
    .select('daily_goal_id, daily_goals(goal_date)')
    .eq('id', dailyGoalExerciseId)
    .single();
  if (error) throw error;

  const goalDate = (data.daily_goals as { goal_date: string } | null)?.goal_date;
  if (!goalDate) throw new Error('Daily goal not found');

  return { dailyGoalId: data.daily_goal_id, activityDate: goalDate };
}

async function findOrCreateParentActivity(
  userId: string,
  input: LogActivityInput,
): Promise<Activity> {
  let dailyGoalId = input.dailyGoalId ?? null;
  let activityDate = input.activityDate ?? todayISO();

  if (input.dailyGoalExerciseId) {
    const meta = await resolveDailyGoalMeta(input.dailyGoalExerciseId);
    dailyGoalId = meta.dailyGoalId;
    activityDate = meta.activityDate;
  }

  let query = supabase.from('activities').select('*').eq('user_id', userId);

  if (dailyGoalId) {
    query = query.eq('daily_goal_id', dailyGoalId);
  } else if (input.questId) {
    query = query.eq('quest_id', input.questId);
  } else if (input.gangId) {
    query = query.eq('activity_date', activityDate).eq('gang_id', input.gangId).is('daily_goal_id', null).is('quest_id', null);
  } else {
    query = query.eq('activity_date', activityDate).is('gang_id', null).is('daily_goal_id', null).is('quest_id', null);
  }

  const { data: existing, error: lookupError } = await query.maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('activities')
    .insert({
      user_id: userId,
      gang_id: input.gangId ?? null,
      quest_id: input.questId ?? null,
      daily_goal_id: dailyGoalId,
      activity_date: activityDate,
      notes: input.notes && !input.dailyGoalExerciseId ? input.notes : null,
      photo_url: input.photoUrl ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function upsertActivityExercise(
  activityId: string,
  input: LogActivityInput,
): Promise<{ exercise: ActivityExercise; isNewExercise: boolean }> {
  const now = new Date().toISOString();
  const row = {
    exercise_id: input.exerciseId ?? null,
    exercise_name: input.exerciseName,
    category: input.category ?? null,
    unit: input.unit,
    amount: input.amount,
    sets: input.sets ?? null,
    notes: input.notes ?? null,
    daily_goal_exercise_id: input.dailyGoalExerciseId ?? null,
    updated_at: now,
  };

  if (input.dailyGoalExerciseId) {
    const { data: existing, error: lookupError } = await supabase
      .from('activity_exercises')
      .select('id')
      .eq('activity_id', activityId)
      .eq('daily_goal_exercise_id', input.dailyGoalExerciseId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      const { data, error } = await supabase
        .from('activity_exercises')
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return { exercise: data, isNewExercise: false };
    }
  }

  const { data, error } = await supabase
    .from('activity_exercises')
    .insert({ ...row, activity_id: activityId })
    .select('*')
    .single();
  if (error) throw error;
  return { exercise: data, isNewExercise: true };
}

function invalidateActivityQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  activity: Activity,
  userId?: string,
) {
  if (activity.gang_id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.feed(activity.gang_id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.gangQuests(activity.gang_id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.activeWeeklyPlan(activity.gang_id) });
  }
  if (activity.quest_id) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.questActivity(activity.quest_id, userId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.quest(activity.quest_id, userId),
    });
  }
  if (activity.daily_goal_id) {
    queryClient.invalidateQueries({ queryKey: ['daily-goals'] });
    queryClient.invalidateQueries({ queryKey: ['activities', 'daily-goal'] });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
  queryClient.invalidateQueries({ queryKey: ['quests', 'mine'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
}

/** Adjust XP by a delta and re-derive rank from the new total. */
async function adjustXp(userId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp')
    .eq('id', userId)
    .maybeSingle();
  const newXp = Math.max(0, (profile?.xp ?? 0) + delta);
  await supabase.from('profiles').update({ xp: newXp, rank: rankForXp(newXp) }).eq('id', userId);
}

interface XpAwardInsert {
  kind: 'activity_log' | 'personal_goal' | 'gang_goal';
  user_id?: string | null;
  gang_id?: string | null;
  daily_goal_exercise_id?: string | null;
  quest_id?: string | null;
  xp_amount: number;
}

/** Insert an award row; returns false if this milestone was already paid out. */
async function tryInsertXpAward(row: XpAwardInsert): Promise<boolean> {
  const { error } = await supabase.from('xp_awards').insert(row);
  if (error?.code === PG_UNIQUE_VIOLATION) return false;
  if (error) throw error;
  return true;
}

async function processActivityXp(input: {
  userId: string;
  isNewActivity: boolean;
  questXpContext?: QuestXpContext;
  refs: ActivityXpRefs;
}): Promise<number> {
  let total = 0;
  const { userId, isNewActivity, questXpContext: ctx, refs } = input;
  const hasGoalRef = !!(refs.dailyGoalExerciseId || refs.questId);

  if (isNewActivity) {
    if (hasGoalRef) {
      const inserted = await tryInsertXpAward({
        kind: 'activity_log',
        user_id: userId,
        daily_goal_exercise_id: refs.dailyGoalExerciseId ?? null,
        quest_id: refs.questId ?? null,
        xp_amount: XP_ACTIVITY_LOG,
      });
      if (inserted) {
        await adjustXp(userId, XP_ACTIVITY_LOG);
        total += XP_ACTIVITY_LOG;
      }
    } else {
      await adjustXp(userId, XP_ACTIVITY_LOG);
      total += XP_ACTIVITY_LOG;
    }
  }

  if (ctx && ctx.individualTarget > 0 && ctx.userTotalAfter >= ctx.individualTarget) {
    const inserted = await tryInsertXpAward({
      kind: 'personal_goal',
      user_id: userId,
      daily_goal_exercise_id: refs.dailyGoalExerciseId ?? null,
      quest_id: refs.questId ?? null,
      xp_amount: XP_PERSONAL_GOAL,
    });
    if (inserted) {
      await adjustXp(userId, XP_PERSONAL_GOAL);
      total += XP_PERSONAL_GOAL;
    }
  }

  if (ctx && ctx.gangTarget > 0 && ctx.gangTotalAfter >= ctx.gangTarget) {
    const inserted = await tryInsertXpAward({
      kind: 'gang_goal',
      user_id: null,
      gang_id: ctx.gangId,
      daily_goal_exercise_id: refs.dailyGoalExerciseId ?? null,
      quest_id: refs.questId ?? null,
      xp_amount: XP_GANG_GOAL,
    });
    if (inserted) {
      await awardGangGoalXp(ctx.gangId);
      total += XP_GANG_GOAL;
    }
  }

  return total;
}

/** Daily-goal exercise IDs that already earned personal-goal XP for the signed-in user. */
export async function fetchPersonalGoalAwardedExerciseIds(
  dailyGoalExerciseIds: string[],
): Promise<Set<string>> {
  if (dailyGoalExerciseIds.length === 0) return new Set();

  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('xp_awards')
    .select('daily_goal_exercise_id')
    .eq('user_id', userId)
    .eq('kind', 'personal_goal')
    .in('daily_goal_exercise_id', dailyGoalExerciseIds);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => row.daily_goal_exercise_id)
      .filter((id): id is string => !!id),
  );
}

/** Whether personal-goal XP was already awarded for a legacy quest. */
export async function hasPersonalGoalAward(questId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from('xp_awards')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'personal_goal')
    .eq('quest_id', questId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Award gang-goal XP to every member when the collective target is hit. */
async function awardGangGoalXp(gangId: string): Promise<void> {
  const { data: members, error } = await supabase
    .from('gang_members')
    .select('user_id')
    .eq('gang_id', gangId);
  if (error) throw error;

  await Promise.all((members ?? []).map((m) => adjustXp(m.user_id, XP_GANG_GOAL)));
}
