import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type {
  ExerciseCategory,
  ExerciseUnit,
  Quest,
  QuestType,
  QuestWithProgress,
} from '@/types';

/** Active quests for a gang, enriched with collective + personal progress. */
export function useGangQuests(gangId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.gangQuests(gangId),
    enabled: !!gangId,
    queryFn: async (): Promise<QuestWithProgress[]> => {
      const { data: quests, error } = await supabase
        .from('quests')
        .select('*, exercise:exercises(name)')
        .eq('gang_id', gangId)
        .order('starts_on', { ascending: false });
      if (error) throw error;
      return hydrateQuests(quests ?? [], userId);
    },
  });
}

/** Quests across all gangs the user belongs to (for the Today screen). */
export function useMyQuests() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.myQuests(userId),
    enabled: !!userId,
    queryFn: async (): Promise<QuestWithProgress[]> => {
      const { data: memberships, error: mErr } = await supabase
        .from('gang_members')
        .select('gang_id')
        .eq('user_id', userId!);
      if (mErr) throw mErr;
      const gangIds = (memberships ?? []).map((m) => m.gang_id);
      if (gangIds.length === 0) return [];

      const { data: quests, error } = await supabase
        .from('quests')
        .select('*, exercise:exercises(name)')
        .in('gang_id', gangIds)
        .eq('status', 'active')
        .order('type', { ascending: true });
      if (error) throw error;
      return hydrateQuests(quests ?? [], userId);
    },
  });
}

export interface CreateQuestInput {
  gangId: string;
  type: QuestType;
  title: string;
  dayCategory?: ExerciseCategory;
  exerciseId?: string;
  unit: ExerciseUnit;
  gangTarget: number;
  individualTarget: number;
  startsOn?: string;
  endsOn?: string;
}

export function useCreateQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQuestInput): Promise<Quest> => {
      const { data, error } = await supabase
        .from('quests')
        .insert({
          gang_id: input.gangId,
          type: input.type,
          title: input.title,
          day_category: input.dayCategory ?? null,
          exercise_id: input.exerciseId ?? null,
          unit: input.unit,
          gang_target: input.gangTarget,
          individual_target: input.individualTarget,
          starts_on: input.startsOn,
          ends_on: input.endsOn,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (quest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gangQuests(quest.gang_id) });
      queryClient.invalidateQueries({ queryKey: ['quests', 'mine'] });
    },
  });
}

// ---- helpers ----
async function hydrateQuests(
  rows: (Quest & { exercise?: { name: string } | null })[],
  userId?: string,
): Promise<QuestWithProgress[]> {
  if (rows.length === 0) return [];
  const questIds = rows.map((q) => q.id);

  const { data: progress } = await supabase
    .from('quest_progress')
    .select('quest_id, gang_total, contributor_count')
    .in('quest_id', questIds);

  let userTotals: Record<string, number> = {};
  if (userId) {
    const { data: up } = await supabase
      .from('quest_user_progress')
      .select('quest_id, user_total')
      .eq('user_id', userId)
      .in('quest_id', questIds);
    for (const row of up ?? []) {
      if (row.quest_id) userTotals[row.quest_id] = Number(row.user_total);
    }
  }

  const progressMap = new Map(
    (progress ?? []).map((p) => [p.quest_id, p]),
  );

  return rows.map((q) => {
    const p = progressMap.get(q.id);
    return {
      ...q,
      exercise_name: q.exercise?.name ?? null,
      gang_total: p ? Number(p.gang_total) : 0,
      contributor_count: p ? p.contributor_count : 0,
      user_total: userTotals[q.id] ?? 0,
    };
  });
}
