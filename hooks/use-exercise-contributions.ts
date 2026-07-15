import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { AppNotification, ExerciseUnit, GangMemberWithProfile } from '@/types';

export interface ExerciseContributor {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  user_total: number;
  individual_target: number;
  unit: ExerciseUnit;
  is_complete: boolean;
  is_self: boolean;
}

interface UseExerciseContributionsArgs {
  gangId: string;
  exerciseId: string | null;
  individualTarget: number;
  unit: ExerciseUnit;
  enabled?: boolean;
}

export function useExerciseContributions({
  gangId,
  exerciseId,
  individualTarget,
  unit,
  enabled = true,
}: UseExerciseContributionsArgs) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.exerciseContributions(gangId, exerciseId ?? undefined),
    enabled: enabled && !!gangId && !!exerciseId,
    queryFn: async (): Promise<ExerciseContributor[]> => {
      const [{ data: members, error: membersError }, { data: progress, error: progressError }] =
        await Promise.all([
          supabase
            .from('gang_members')
            .select(
              'gang_id, user_id, role, joined_at, profile:profiles(id, full_name, username, avatar_url, rank, xp)',
            )
            .eq('gang_id', gangId),
          supabase
            .from('daily_goal_exercise_user_progress')
            .select('user_id, user_total')
            .eq('daily_goal_exercise_id', exerciseId!),
        ]);

      if (membersError) throw membersError;
      if (progressError) throw progressError;

      const totals = new Map<string, number>();
      for (const row of progress ?? []) {
        if (!row.user_id) continue;
        totals.set(row.user_id, Number(row.user_total) || 0);
      }

      const contributors: ExerciseContributor[] = (members ?? []).map((row) => {
        const profile = row.profile as unknown as GangMemberWithProfile['profile'] | null;
        const total = totals.get(row.user_id) ?? 0;
        return {
          user_id: row.user_id,
          full_name: profile?.full_name ?? 'Member',
          avatar_url: profile?.avatar_url ?? null,
          user_total: total,
          individual_target: individualTarget,
          unit,
          is_complete: individualTarget > 0 ? total >= individualTarget : total > 0,
          is_self: row.user_id === userId,
        };
      });

      return contributors.sort((a, b) => {
        if (a.is_complete !== b.is_complete) return a.is_complete ? -1 : 1;
        if (b.user_total !== a.user_total) return b.user_total - a.user_total;
        return a.full_name.localeCompare(b.full_name);
      });
    },
  });
}

export function useSendGangPoke(gangId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      targetUserId: string;
      dailyGoalExerciseId: string;
    }): Promise<AppNotification> => {
      const { data, error } = await supabase.rpc('send_gang_poke', {
        p_gang_id: gangId,
        p_target_user_id: input.targetUserId,
        p_daily_goal_exercise_id: input.dailyGoalExerciseId,
      });
      if (error) throw error;
      return data as AppNotification;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseContributions(gangId, variables.dailyGoalExerciseId),
      });
    },
  });
}
