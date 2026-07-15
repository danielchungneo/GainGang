import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { todayISO } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { DailyGoalWithProgress, UserRewardCrate } from '@/types';

/** True when every exercise across today's goals is personally cleared. */
export function areDailyGoalsComplete(goals: DailyGoalWithProgress[]): boolean {
  if (goals.length === 0) return false;
  return goals.every(
    (goal) =>
      goal.exercises.length > 0 &&
      goal.exercises.every(
        (ex) => ex.individual_target <= 0 || ex.user_total >= ex.individual_target,
      ),
  );
}

/** Inventory of reward crates for the signed-in user. */
export function useRewardCrates() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.rewardCrates(userId),
    enabled: !!userId,
    queryFn: async (): Promise<UserRewardCrate[]> => {
      const { data, error } = await supabase
        .from('user_reward_crates')
        .select('*')
        .eq('user_id', userId!)
        .order('claimed_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Today's daily-completion crate, if already claimed. */
export function useTodaysRewardCrate(rewardDate = todayISO()) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.todaysRewardCrate(userId, rewardDate),
    enabled: !!userId,
    queryFn: async (): Promise<UserRewardCrate | null> => {
      const { data, error } = await supabase
        .from('user_reward_crates')
        .select('*')
        .eq('user_id', userId!)
        .eq('source', 'daily_completion')
        .eq('source_date', rewardDate)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useClaimDailyReward() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (rewardDate?: string): Promise<UserRewardCrate> => {
      const { data, error } = await supabase.rpc('claim_daily_reward', {
        p_reward_date: rewardDate ?? todayISO(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (crate) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewardCrates(userId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.todaysRewardCrate(userId, crate.source_date),
      });
    },
  });
}

export function useOpenRewardCrate() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (crateId: string): Promise<UserRewardCrate> => {
      const { data, error } = await supabase.rpc('open_reward_crate', {
        p_crate_id: crateId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (crate) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewardCrates(userId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.todaysRewardCrate(userId, crate.source_date),
      });
      // XP from loot lands on the profile.
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}
