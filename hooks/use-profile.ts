import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { todayISO } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { refreshPersonalStreak } from '@/lib/streaks';
import { supabase } from '@/lib/supabase';
import { addDaysISO, type Profile } from '@/types';
import type { UpdateRow } from '@/types/database';

function needsStreakRefresh(profile: Profile): boolean {
  if (profile.last_active_on == null) return true;

  const yesterday = addDaysISO(todayISO(), -1);
  if (profile.current_streak > 0 && profile.last_active_on < yesterday) return true;

  return false;
}

export function useProfile(userId?: string) {
  const { session } = useAuth();
  const id = userId ?? session?.user.id;
  const isOwnProfile = !!id && id === session?.user.id;

  return useQuery({
    queryKey: queryKeys.profile(id),
    enabled: !!id,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      if (isOwnProfile && needsStreakRefresh(data)) {
        const stats = await refreshPersonalStreak(id!);
        return {
          ...data,
          current_streak: stats.currentStreak,
          longest_streak: stats.longestStreak,
          last_active_on: stats.lastActiveOn,
        };
      }

      return data;
    },
  });
}

export function useUpdateProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const id = session?.user.id;

  return useMutation({
    mutationFn: async (patch: UpdateRow<'profiles'>): Promise<Profile> => {
      if (!id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(id) });
    },
  });
}
