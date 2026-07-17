import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { FollowCounts, FollowStatus } from '@/types';

export function useFollowStatus(targetUserId?: string) {
  const { session } = useAuth();
  const viewerId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.followStatus(viewerId, targetUserId),
    enabled: !!viewerId && !!targetUserId && viewerId !== targetUserId,
    queryFn: async (): Promise<FollowStatus> => {
      const [outgoing, incoming] = await Promise.all([
        supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewerId!)
          .eq('following_id', targetUserId!)
          .maybeSingle(),
        supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', targetUserId!)
          .eq('following_id', viewerId!)
          .maybeSingle(),
      ]);

      if (outgoing.error) throw outgoing.error;
      if (incoming.error) throw incoming.error;

      const isFollowing = !!outgoing.data;
      const isFollowedBy = !!incoming.data;

      return {
        isFollowing,
        isFollowedBy,
        isFriend: isFollowing && isFollowedBy,
      };
    },
  });
}

export function useFollowCounts(userId?: string) {
  return useQuery({
    queryKey: queryKeys.followCounts(userId),
    enabled: !!userId,
    queryFn: async (): Promise<FollowCounts> => {
      const [followers, following] = await Promise.all([
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId!),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId!),
      ]);

      if (followers.error) throw followers.error;
      if (following.error) throw following.error;

      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
      };
    },
  });
}

export function useToggleFollow(targetUserId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const viewerId = session?.user.id;
  const statusKey = queryKeys.followStatus(viewerId, targetUserId);

  return useMutation({
    mutationFn: async ({ isFollowing }: { isFollowing: boolean }) => {
      if (!viewerId || !targetUserId) throw new Error('Not authenticated');
      if (viewerId === targetUserId) throw new Error('Cannot follow yourself');

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', viewerId)
          .eq('following_id', targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: viewerId,
          following_id: targetUserId,
        });
        if (error) throw error;
      }
    },
    onMutate: async ({ isFollowing }) => {
      await queryClient.cancelQueries({ queryKey: statusKey });
      const previousStatus = queryClient.getQueryData<FollowStatus>(statusKey);
      const previousViewerCounts = queryClient.getQueryData<FollowCounts>(
        queryKeys.followCounts(viewerId),
      );
      const previousTargetCounts = queryClient.getQueryData<FollowCounts>(
        queryKeys.followCounts(targetUserId),
      );

      queryClient.setQueryData<FollowStatus>(statusKey, (old) => {
        const nextFollowing = !isFollowing;
        const isFollowedBy = old?.isFollowedBy ?? false;
        return {
          isFollowing: nextFollowing,
          isFollowedBy,
          isFriend: nextFollowing && isFollowedBy,
        };
      });

      const delta = isFollowing ? -1 : 1;
      queryClient.setQueryData<FollowCounts>(queryKeys.followCounts(viewerId), (old) =>
        old
          ? { ...old, following: Math.max(0, old.following + delta) }
          : { followers: 0, following: Math.max(0, delta) },
      );
      queryClient.setQueryData<FollowCounts>(queryKeys.followCounts(targetUserId), (old) =>
        old
          ? { ...old, followers: Math.max(0, old.followers + delta) }
          : { followers: Math.max(0, delta), following: 0 },
      );

      return { previousStatus, previousViewerCounts, previousTargetCounts };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previousStatus) queryClient.setQueryData(statusKey, ctx.previousStatus);
      if (ctx?.previousViewerCounts) {
        queryClient.setQueryData(queryKeys.followCounts(viewerId), ctx.previousViewerCounts);
      }
      if (ctx?.previousTargetCounts) {
        queryClient.setQueryData(queryKeys.followCounts(targetUserId), ctx.previousTargetCounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: statusKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.followCounts(viewerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.followCounts(targetUserId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(targetUserId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(targetUserId) });
    },
  });
}
