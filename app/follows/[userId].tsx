import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar, GlassSurface, ScreenBackground } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { useFollowList, useToggleFollow } from '@/hooks/use-follows';
import { useProfile } from '@/hooks/use-profile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import { pushUserProfile } from '@/lib/navigate-profile';
import { levelFromXp, type FollowListEntry, type FollowListKind } from '@/types';

function parseList(value: string | string[] | undefined): FollowListKind {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'following' ? 'following' : 'followers';
}

export default function FollowsScreen() {
  const { userId, list: listParam } = useLocalSearchParams<{
    userId: string;
    list?: string;
  }>();
  const t = useThemeTokens();
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const activeList = parseList(listParam);

  const { data: profile } = useProfile(userId);
  const { data: entries, isLoading, refetch, isError, error } = useFollowList(
    userId,
    activeList,
  );
  const { isRefreshing, onRefresh } = usePullToRefresh(refetch);

  const title = useMemo(() => {
    if (userId && userId === viewerId) {
      return activeList === 'followers' ? 'Followers' : 'Following';
    }
    const name = profile?.full_name || profile?.username || 'Hunter';
    return activeList === 'followers' ? `${name}'s followers` : `${name}'s following`;
  }, [activeList, profile?.full_name, profile?.username, userId, viewerId]);

  function setList(next: FollowListKind) {
    if (!userId || next === activeList) return;
    router.setParams({ list: next });
  }

  if (!userId) {
    return (
      <ScreenBackground>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={t.heading} />
          </TouchableOpacity>
          <Text style={[type.body, { color: t.body }]}>Profile not found.</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
          />
        }
      >
        <View className="mt-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={26} color={t.heading} />
          </Pressable>
          <Text style={[type.heading, { color: t.heading, flex: 1 }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            padding: 4,
            borderRadius: 14,
            backgroundColor: `${t.heading}08`,
            borderWidth: 1,
            borderColor: t.buttonBorder,
          }}
        >
          <ListTab
            label="Followers"
            isActive={activeList === 'followers'}
            onPress={() => setList('followers')}
          />
          <ListTab
            label="Following"
            isActive={activeList === 'following'}
            onPress={() => setList('following')}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 28 }} />
        ) : isError ? (
          <GlassSurface style={{ padding: 20, gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.displaySemi, fontSize: 18, color: t.heading }}>
              Couldn’t load list
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              {error instanceof Error ? error.message : 'Something went wrong. Pull to retry.'}
            </Text>
          </GlassSurface>
        ) : !entries || entries.length === 0 ? (
          <GlassSurface style={{ padding: 24, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.displaySemi, fontSize: 18, color: t.heading }}>
              {activeList === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </Text>
            <Text style={[type.bodySm, { color: t.body, textAlign: 'center' }]}>
              {activeList === 'followers'
                ? 'When people follow this hunter, they’ll show up here.'
                : 'Accounts this hunter follows will show up here.'}
            </Text>
          </GlassSurface>
        ) : (
          <View style={{ gap: 10 }}>
            {entries.map((entry) => (
              <FollowListRow
                key={entry.user_id}
                entry={entry}
                isSelf={entry.user_id === viewerId}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

function ListTab({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const t = useThemeTokens();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: isActive ? t.accent : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: fontFamily.bodySemi,
          fontSize: 14,
          color: isActive ? t.accentOnPrimary : t.body,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FollowListRow({
  entry,
  isSelf,
}: {
  entry: FollowListEntry;
  isSelf: boolean;
}) {
  const t = useThemeTokens();
  const toggleFollow = useToggleFollow(isSelf ? undefined : entry.user_id);
  const name = entry.full_name || 'Hunter';
  const level = levelFromXp(entry.xp ?? 0);
  const isFollowing = entry.viewer_is_following;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: t.buttonBorder,
        backgroundColor: `${t.heading}08`,
      }}
    >
      <TouchableOpacity
        onPress={() => pushUserProfile(entry.user_id, { isSelf })}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Avatar name={name} uri={entry.avatar_url} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fontFamily.bodySemi,
              fontSize: 15,
              color: t.heading,
            }}
            numberOfLines={1}
          >
            {name}
            {isSelf ? ' (you)' : ''}
          </Text>
          <Text style={[type.bodySm, { color: t.body }]} numberOfLines={1}>
            {entry.username ? `@${entry.username} · ` : ''}
            {`Lvl ${level}`}
          </Text>
        </View>
      </TouchableOpacity>

      {!isSelf ? (
        <TouchableOpacity
          onPress={() => toggleFollow.mutate({ isFollowing })}
          disabled={toggleFollow.isPending}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: isFollowing ? t.buttonBg : t.accent,
            borderWidth: isFollowing ? 1 : 0,
            borderColor: t.buttonBorder,
            opacity: toggleFollow.isPending ? 0.7 : 1,
            minWidth: 92,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.bodySemi,
              fontSize: 13,
              color: isFollowing ? t.heading : t.accentOnPrimary,
            }}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
