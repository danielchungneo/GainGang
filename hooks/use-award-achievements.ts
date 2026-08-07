import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { enqueueAchievementUnlocks } from '@/lib/achievements';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { Achievement } from '@/types';

/**
 * Calls the award RPC, enqueues unlock overlays for newly earned badges,
 * and refreshes the achievements query. Errors are logged — never thrown —
 * so primary UX (saves, social actions) is never blocked.
 */
export function useAwardAchievements() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useCallback(async (): Promise<Achievement[]> => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase.rpc('check_and_award_achievements');
      if (error) throw error;

      const earned = (data ?? []) as Achievement[];
      if (earned.length > 0) {
        enqueueAchievementUnlocks(earned);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.userAchievements(userId),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.achievements() });
      }
      return earned;
    } catch (err) {
      console.warn('[achievements] check_and_award_achievements failed', err);
      return [];
    }
  }, [queryClient, userId]);
}
