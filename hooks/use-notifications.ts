import type { ComponentProps } from 'react';
import { useEffect } from 'react';

import { Ionicons } from '@expo/vector-icons';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { AppNotification, NotificationType, Profile } from '@/types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface NotificationWithActor extends AppNotification {
  actor: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'> | null;
}

/** One shared realtime channel per user — calling `.on()` after subscribe() throws. */
let sharedUserId: string | null = null;
let sharedChannel: RealtimeChannel | null = null;
let sharedSubscribers = 0;

function retainNotificationsChannel(userId: string, queryClient: QueryClient) {
  if (sharedChannel && sharedUserId === userId) {
    sharedSubscribers += 1;
    return;
  }

  if (sharedChannel) {
    void supabase.removeChannel(sharedChannel);
    sharedChannel = null;
    sharedUserId = null;
    sharedSubscribers = 0;
  }

  sharedUserId = userId;
  sharedSubscribers = 1;
  sharedChannel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      },
    )
    .subscribe();
}

function releaseNotificationsChannel() {
  if (!sharedChannel) return;
  sharedSubscribers = Math.max(0, sharedSubscribers - 1);
  if (sharedSubscribers > 0) return;

  void supabase.removeChannel(sharedChannel);
  sharedChannel = null;
  sharedUserId = null;
}

export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    retainNotificationsChannel(userId, queryClient);
    return () => {
      releaseNotificationsChannel();
    };
  }, [userId, queryClient]);

  return useQuery({
    queryKey: queryKeys.notifications(userId),
    enabled: !!userId,
    queryFn: async (): Promise<NotificationWithActor[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const rows = (data ?? []) as AppNotification[];
      const actorIds = [
        ...new Set(rows.map((row) => row.actor_id).filter((id): id is string => !!id)),
      ];

      let actorsById = new Map<string, NotificationWithActor['actor']>();
      if (actorIds.length > 0) {
        const { data: actors, error: actorsError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', actorIds);
        if (actorsError) throw actorsError;
        actorsById = new Map(
          (actors ?? []).map((actor) => [
            actor.id,
            actor as NotificationWithActor['actor'],
          ]),
        );
      }

      return rows.map((row) => ({
        ...row,
        actor: row.actor_id ? (actorsById.get(row.actor_id) ?? null) : null,
      }));
    },
  });
}

export function useUnreadNotificationCount() {
  const { data: notifications } = useNotifications();
  return (notifications ?? []).filter((n) => !n.is_read).length;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('is_read', false);
      if (error) throw error;
    },
    onMutate: async (notificationId) => {
      const key = queryKeys.notifications(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationWithActor[]>(key);
      queryClient.setQueryData<NotificationWithActor[]>(key, (old) =>
        (old ?? []).map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.notifications(userId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) throw error;
    },
    onMutate: async () => {
      const key = queryKeys.notifications(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationWithActor[]>(key);
      queryClient.setQueryData<NotificationWithActor[]>(key, (old) =>
        (old ?? []).map((n) => ({ ...n, is_read: true })),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.notifications(userId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
    },
  });
}

/** Icon + accent hint for a notification type. */
export function notificationVisual(type: NotificationType): {
  icon: IoniconName;
  label: string;
} {
  switch (type) {
    case 'kudos':
      return { icon: 'flame', label: 'Kudos' };
    case 'comment':
      return { icon: 'chatbubble', label: 'Comment' };
    case 'poke':
      return { icon: 'hand-left', label: 'Poke' };
    case 'daily_goal':
      return { icon: 'trophy', label: 'Daily goal' };
    case 'mention':
      return { icon: 'at', label: 'Mention' };
    case 'achievement':
      return { icon: 'ribbon', label: 'Achievement' };
    case 'rank_up':
      return { icon: 'trending-up', label: 'Rank up' };
    case 'quest':
      return { icon: 'flag', label: 'Quest' };
    case 'gang':
    default:
      return { icon: 'people', label: 'Gang' };
  }
}
