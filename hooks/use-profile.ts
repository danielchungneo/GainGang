import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import type { UpdateRow } from '@/types/database';

export function useProfile(userId?: string) {
  const { session } = useAuth();
  const id = userId ?? session?.user.id;

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
