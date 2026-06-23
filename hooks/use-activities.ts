import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { rankForXp } from '@/types';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { Activity, ActivityFeedItem, ExerciseCategory, ExerciseUnit } from '@/types';

/** XP awarded per logged unit, by measurement type. */
const XP_PER_UNIT: Record<ExerciseUnit, number> = {
  reps: 1,
  seconds: 0.2,
  meters: 0.02,
};

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
        .select('*, author:profiles(id, full_name, username, avatar_url, rank)')
        .eq('gang_id', gangId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return hydrateFeed((data ?? []) as ActivityWithAuthor[], userId);
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
  exerciseId?: string;
  exerciseName: string;
  category?: ExerciseCategory;
  unit: ExerciseUnit;
  amount: number;
  sets?: number;
  notes?: string;
  photoUrl?: string;
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
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (input: UpdateActivityInput): Promise<Activity> => {
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

      const oldXp = Math.round(input.previousAmount * XP_PER_UNIT[input.previousUnit]);
      const newXp = Math.round(input.amount * XP_PER_UNIT[input.unit]);
      await adjustXp(userId, newXp - oldXp);
      return data;
    },
    onSuccess: (activity) => {
      if (activity.gang_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.feed(activity.gang_id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.gangQuests(activity.gang_id) });
      }
      if (activity.quest_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.questActivity(activity.quest_id, userId),
        });
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
    mutationFn: async (input: LogActivityInput): Promise<Activity> => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('activities')
        .insert({
          user_id: userId,
          gang_id: input.gangId ?? null,
          quest_id: input.questId ?? null,
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

      await adjustXp(userId, Math.round(input.amount * XP_PER_UNIT[input.unit]));
      return data;
    },
    onSuccess: (activity) => {
      if (activity.gang_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.feed(activity.gang_id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.gangQuests(activity.gang_id) });
      }
      if (activity.quest_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.questActivity(activity.quest_id, userId),
        });
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
