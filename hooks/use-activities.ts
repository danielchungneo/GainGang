import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { rankForXp } from '@/types';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { Activity, ActivityFeedItem, ExerciseCategory, ExerciseUnit } from '@/types';

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
  xpAwarded: number;
}

const PG_UNIQUE_VIOLATION = '23505';

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
        .select('*, author:profiles(id, full_name, username, avatar_url, xp)')
        .eq('gang_id', gangId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return hydrateFeed((data ?? []) as ActivityWithAuthor[], userId);
    },
  });
}

/** The signed-in user's activities for all exercises in a daily goal. */
export function useDailyGoalActivities(dailyGoalId?: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.dailyGoalActivities(dailyGoalId, userId),
    enabled: !!dailyGoalId && !!userId,
    queryFn: async (): Promise<Activity[]> => {
      const { data: exercises, error: eErr } = await supabase
        .from('daily_goal_exercises')
        .select('id')
        .eq('daily_goal_id', dailyGoalId!);
      if (eErr) throw eErr;
      const exerciseGoalIds = (exercises ?? []).map((e) => e.id);
      if (exerciseGoalIds.length === 0) return [];

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId!)
        .in('daily_goal_exercise_id', exerciseGoalIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // One activity per exercise goal — keep the most recent if duplicates exist.
      const byExercise = new Map<string, Activity>();
      for (const row of data ?? []) {
        if (row.daily_goal_exercise_id && !byExercise.has(row.daily_goal_exercise_id)) {
          byExercise.set(row.daily_goal_exercise_id, row);
        }
      }
      return [...byExercise.values()];
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
    queryFn: async (): Promise<Activity | null> => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('quest_id', questId!)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** The signed-in user's own activity history. */
export function useMyActivities() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: queryKeys.myActivities(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface LogActivityInput {
  gangId?: string;
  questId?: string;
  dailyGoalExerciseId?: string;
  exerciseId?: string;
  exerciseName: string;
  category?: ExerciseCategory;
  unit: ExerciseUnit;
  amount: number;
  sets?: number;
  notes?: string;
  photoUrl?: string;
  questXpContext?: QuestXpContext;
}

export interface UpdateActivityInput {
  id: string;
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
  questXpContext?: QuestXpContext;
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (input: UpdateActivityInput): Promise<ActivitySaveResult> => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('activities')
        .update({
          exercise_id: input.exerciseId ?? null,
          exercise_name: input.exerciseName,
          category: input.category ?? null,
          unit: input.unit,
          amount: input.amount,
          sets: input.sets ?? null,
          notes: input.notes ?? null,
        })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;

      const xpAwarded = await processActivityXp({
        userId,
        isNewActivity: false,
        questXpContext: input.questXpContext,
        refs: {
          dailyGoalExerciseId: data.daily_goal_exercise_id ?? undefined,
          questId: data.quest_id ?? undefined,
        },
      });
      return { activity: data, xpAwarded };
    },
    onSuccess: ({ activity }) => {
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
      if (activity.daily_goal_exercise_id) {
        queryClient.invalidateQueries({ queryKey: ['daily-goals'] });
        queryClient.invalidateQueries({ queryKey: ['activities', 'daily-goal'] });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
      queryClient.invalidateQueries({ queryKey: ['quests', 'mine'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
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

      if (input.dailyGoalExerciseId) {
        const { data: existing, error: lookupError } = await supabase
          .from('activities')
          .select('id, amount, unit, daily_goal_exercise_id, quest_id')
          .eq('user_id', userId)
          .eq('daily_goal_exercise_id', input.dailyGoalExerciseId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lookupError) throw lookupError;

        if (existing) {
          const { data, error } = await supabase
            .from('activities')
            .update({
              exercise_id: input.exerciseId ?? null,
              exercise_name: input.exerciseName,
              category: input.category ?? null,
              unit: input.unit,
              amount: input.amount,
              sets: input.sets ?? null,
              notes: input.notes ?? null,
            })
            .eq('id', existing.id)
            .select('*')
            .single();
          if (error) throw error;

          const xpAwarded = await processActivityXp({
            userId,
            isNewActivity: false,
            questXpContext: input.questXpContext,
            refs: {
              dailyGoalExerciseId: data.daily_goal_exercise_id ?? undefined,
              questId: data.quest_id ?? undefined,
            },
          });
          return { activity: data, xpAwarded };
        }
      }

      const { data, error } = await supabase
        .from('activities')
        .insert({
          user_id: userId,
          gang_id: input.gangId ?? null,
          quest_id: input.questId ?? null,
          daily_goal_exercise_id: input.dailyGoalExerciseId ?? null,
          exercise_id: input.exerciseId ?? null,
          exercise_name: input.exerciseName,
          category: input.category ?? null,
          unit: input.unit,
          amount: input.amount,
          sets: input.sets ?? null,
          notes: input.notes ?? null,
          photo_url: input.photoUrl ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;

      const xpAwarded = await processActivityXp({
        userId,
        isNewActivity: true,
        questXpContext: input.questXpContext,
        refs: {
          dailyGoalExerciseId: input.dailyGoalExerciseId,
          questId: input.questId,
        },
      });
      return { activity: data, xpAwarded };
    },
    onSuccess: ({ activity }) => {
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
      if (activity.daily_goal_exercise_id) {
        queryClient.invalidateQueries({ queryKey: ['daily-goals'] });
        queryClient.invalidateQueries({ queryKey: ['activities', 'daily-goal'] });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
      queryClient.invalidateQueries({ queryKey: ['quests', 'mine'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (activity: Pick<Activity, 'id' | 'gang_id'>): Promise<void> => {
      const { error } = await supabase.from('activities').delete().eq('id', activity.id);
      if (error) throw error;
    },
    onSuccess: (_d, activity) => {
      if (activity.gang_id) queryClient.invalidateQueries({ queryKey: queryKeys.feed(activity.gang_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(session?.user.id) });
    },
  });
}

// ---- helpers ----
type ActivityWithAuthor = Activity & { author: ActivityFeedItem['author'] };

async function hydrateFeed(
  rows: ActivityWithAuthor[],
  userId?: string,
): Promise<ActivityFeedItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((a) => a.id);

  const { data: engagement } = await supabase
    .from('activity_engagement')
    .select('activity_id, kudos_count, comment_count')
    .in('activity_id', ids);
  const engMap = new Map((engagement ?? []).map((e) => [e.activity_id, e]));

  let myKudos = new Set<string>();
  if (userId) {
    const { data: mine } = await supabase
      .from('kudos')
      .select('activity_id')
      .eq('user_id', userId)
      .in('activity_id', ids);
    myKudos = new Set((mine ?? []).map((k) => k.activity_id));
  }

  return rows.map((a) => {
    const e = engMap.get(a.id);
    return {
      ...a,
      kudos_count: e?.kudos_count ?? 0,
      comment_count: e?.comment_count ?? 0,
      has_kudos: myKudos.has(a.id),
    };
  });
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
