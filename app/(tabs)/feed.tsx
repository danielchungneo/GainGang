import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { FeedStreakHeader } from '@/components/feed-streak-header';
import { GlassSurface, ScreenBackground } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { useFollowingFeed, useUserActivities } from '@/hooks/use-activities';
import { useFollowCounts } from '@/hooks/use-follows';
import { useProfile } from '@/hooks/use-profile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import type { ActivityFeedItem } from '@/types';

export default function FeedScreen() {
  const t = useThemeTokens();
  const { session } = useAuth();
  const userId = session?.user.id;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useFollowingFeed();

  const { data: profile, refetch: refetchProfile } = useProfile();
  const { data: myActivities = [], refetch: refetchMyActivities } =
    useUserActivities(userId);
  const { data: followCounts } = useFollowCounts(userId);

  const { isRefreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetch(), refetchMyActivities(), refetchProfile()]);
  });

  const activities = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  );

  const followingCount = followCounts?.following ?? 0;
  const showEmpty = !isLoading && activities.length === 0;

  const onEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ActivityFeedItem }) => (
      <ActivityCard activity={item} gangId={item.gang_id ?? undefined} />
    ),
    [],
  );

  const listHeader = (
    <FeedStreakHeader
      activities={myActivities}
      streakDays={profile?.current_streak ?? 0}
    />
  );

  const listEmpty = showEmpty ? (
    <GlassSurface style={{ padding: spacing.lg, gap: 6, marginTop: spacing.sm }}>
      <Text
        style={{
          fontFamily: fontFamily.bodySemi,
          fontSize: 16,
          color: t.heading,
        }}
      >
        No activity yet
      </Text>
      <Text style={[type.bodySm, { color: t.body, lineHeight: 20 }]}>
        {followingCount === 0
          ? 'Log a workout or follow friends to see activity here.'
          : 'Nothing from you or the people you follow yet. Check back soon.'}
      </Text>
    </GlassSurface>
  ) : null;

  const listFooter =
    isFetchingNextPage ? (
      <ActivityIndicator color={t.accent} style={{ marginVertical: spacing.md }} />
    ) : (
      <View style={{ height: spacing.lg }} />
    );

  return (
    <ScreenBackground>
      {isLoading && activities.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          {listHeader}
          <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 40,
            flexGrow: 1,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
            />
          }
        />
      )}
    </ScreenBackground>
  );
}
