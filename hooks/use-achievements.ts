import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { Achievement } from '@/types';

export interface AchievementWithProgress extends Achievement {
  earned: boolean;
  earned_at: string | null;
}

/** Full achievement catalog with the signed-in user's earned status. */
export function useAchievements() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.userAchievements(userId),
    enabled: !!userId,
    queryFn: async (): Promise<AchievementWithProgress[]> => {
      const [{ data: all, error: aErr }, { data: earned, error: eErr }] = await Promise.all([
        supabase.from('achievements').select('*').order('category'),
        supabase.from('user_achievements').select('achievement_id, earned_at').eq('user_id', userId!),
      ]);
      if (aErr) throw aErr;
      if (eErr) throw eErr;

      const earnedMap = new Map((earned ?? []).map((e) => [e.achievement_id, e.earned_at]));
      return (all ?? []).map((a) => ({
        ...a,
        earned: earnedMap.has(a.id),
        earned_at: earnedMap.get(a.id) ?? null,
      }));
    },
  });
}
