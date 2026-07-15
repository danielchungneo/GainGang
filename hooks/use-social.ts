import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { CommentWithAuthor } from '@/types';

/** Toggle kudos on an activity. Optimistic update against the gang feed cache. */
export function useToggleKudos(gangId?: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const feedKey = gangId ? queryKeys.feed(gangId) : undefined;

  return useMutation({
    mutationFn: async ({ activityId, hasKudos }: { activityId: string; hasKudos: boolean }) => {
      if (!userId) throw new Error('Not authenticated');
      if (hasKudos) {
        const { error } = await supabase
          .from('kudos')
          .delete()
          .eq('activity_id', activityId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kudos').insert({ activity_id: activityId, user_id: userId });
        if (error) throw error;
      }
    },
    onMutate: async ({ activityId, hasKudos }) => {
      if (!feedKey) return;
      await queryClient.cancelQueries({ queryKey: feedKey });
      const previous = queryClient.getQueryData(feedKey);
      queryClient.setQueryData(feedKey, (old: any) =>
        Array.isArray(old)
          ? old.map((a) =>
              a.id === activityId
                ? { ...a, has_kudos: !hasKudos, kudos_count: a.kudos_count + (hasKudos ? -1 : 1) }
                : a,
            )
          : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (feedKey && ctx?.previous) queryClient.setQueryData(feedKey, ctx.previous);
    },
    onSettled: (_data, _error, variables) => {
      if (feedKey) queryClient.invalidateQueries({ queryKey: feedKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
      if (variables?.activityId) {
        queryClient.invalidateQueries({ queryKey: ['activity', variables.activityId] });
      }
    },
  });
}

export function useComments(activityId: string) {
  return useQuery({
    queryKey: queryKeys.comments(activityId),
    enabled: !!activityId,
    queryFn: async (): Promise<CommentWithAuthor[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles(id, full_name, username, avatar_url)')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        author: row.author as unknown as CommentWithAuthor['author'],
      })) as CommentWithAuthor[];
    },
  });
}

export function useAddComment(gangId?: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ activityId, body }: { activityId: string; body: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('comments')
        .insert({ activity_id: activityId, user_id: userId, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: (_d, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments(activityId) });
      queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
      if (gangId) queryClient.invalidateQueries({ queryKey: queryKeys.feed(gangId) });
    },
  });
}
