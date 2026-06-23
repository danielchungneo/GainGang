import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { Avatar } from '@/components/ui/avatar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import { useAddComment, useComments } from '@/hooks/use-social';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ActivityFeedItem } from '@/types';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = id!;
  const t = useThemeTokens();
  const { session } = useAuth();
  const [draft, setDraft] = useState('');

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', activityId],
    enabled: !!activityId,
    queryFn: async (): Promise<ActivityFeedItem | null> => {
      const { data, error } = await supabase
        .from('activities')
        .select('*, author:profiles(id, full_name, username, avatar_url, rank)')
        .eq('id', activityId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [{ count: kudosCount }, { count: commentCount }, { data: mine }] = await Promise.all([
        supabase.from('kudos').select('*', { count: 'exact', head: true }).eq('activity_id', activityId),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('activity_id', activityId),
        session?.user.id
          ? supabase.from('kudos').select('id').eq('activity_id', activityId).eq('user_id', session.user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return {
        ...(data as ActivityFeedItem),
        kudos_count: kudosCount ?? 0,
        comment_count: commentCount ?? 0,
        has_kudos: !!mine,
      };
    },
  });

  const { data: comments, isLoading: loadingComments } = useComments(activityId);
  const addComment = useAddComment(activity?.gang_id ?? undefined);

  async function handleSend() {
    if (!draft.trim()) return;
    await addComment.mutateAsync({ activityId, body: draft });
    setDraft('');
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 20 }}>
          <View className="mt-2 flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={t.body} />
            </TouchableOpacity>
            <Text style={{ color: t.heading }} className="text-2xl font-bold">
              Activity
            </Text>
          </View>

          {isLoading || !activity ? (
            <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
          ) : (
            <>
              <ActivityCard activity={activity} gangId={activity.gang_id ?? undefined} />

              <Text style={{ color: t.heading }} className="text-lg font-bold">
                Comments
              </Text>

              {loadingComments ? (
                <ActivityIndicator color={t.accent} />
              ) : comments && comments.length > 0 ? (
                <View className="gap-3">
                  {comments.map((c) => (
                    <GlassSurface key={c.id} style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
                      <Avatar name={c.author?.full_name ?? 'Member'} uri={c.author?.avatar_url} size={36} />
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text style={{ color: t.heading }} className="font-semibold">
                            {c.author?.full_name ?? 'Member'}
                          </Text>
                          <Text style={{ color: t.body }} className="text-xs">
                            {timeAgo(c.created_at)}
                          </Text>
                        </View>
                        <Text style={{ color: t.body }} className="text-sm leading-5">
                          {c.body}
                        </Text>
                      </View>
                    </GlassSurface>
                  ))}
                </View>
              ) : (
                <Text style={{ color: t.body }} className="text-sm">
                  No comments yet. Be the first to cheer them on!
                </Text>
              )}
            </>
          )}
        </ScrollView>

        {/* composer */}
        <View className="flex-row items-center gap-2 px-4 pb-6 pt-2">
          <TextInput
            style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
            placeholder="Add a comment…"
            placeholderTextColor={t.placeholder}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={addComment.isPending || !draft.trim()}
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: t.accent, opacity: draft.trim() ? 1 : 0.5 }}>
            <Ionicons name="send" size={18} color={t.accentOnPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
});
