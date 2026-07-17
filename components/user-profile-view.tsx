import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ProfileActivitiesFeed } from '@/components/profile-activities-feed';
import { ProfileStreakCalendar } from '@/components/profile-streak-calendar';
import {
  Avatar,
  GlassSurface,
  LevelBadge,
  ProgressBar,
  StreakPill,
} from '@/components/ui';
import { useUserActivities } from '@/hooks/use-activities';
import { useFollowCounts, useFollowStatus, useToggleFollow } from '@/hooks/use-follows';
import { useProfile } from '@/hooks/use-profile';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, type } from '@/lib/gaingang-theme';
import { levelProgress } from '@/types';

type ProfileView = 'streak' | 'activities' | 'badges';

interface UserProfileViewProps {
  userId: string;
  isOwnProfile: boolean;
}

export function UserProfileView({ userId, isOwnProfile }: UserProfileViewProps) {
  const t = useThemeTokens();
  const [activeView, setActiveView] = useState<ProfileView>('streak');

  const { data: profile, isLoading } = useProfile(userId);
  const { data: activities } = useUserActivities(userId);
  const { data: followCounts } = useFollowCounts(userId);
  const { data: followStatus } = useFollowStatus(isOwnProfile ? undefined : userId);
  const toggleFollow = useToggleFollow(userId);

  const progress = levelProgress(profile?.xp ?? 0);
  const totalActivities = activities?.length ?? 0;
  const isFollowing = followStatus?.isFollowing ?? false;
  const isFriend = followStatus?.isFriend ?? false;

  if (isLoading || !profile) {
    return <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />;
  }

  const displayName = profile.full_name || (isOwnProfile ? 'Unnamed Hunter' : 'Hunter');

  return (
    <>
      <GlassSurface style={{ padding: 20, gap: 14 }}>
        <View className="flex-row items-center gap-4">
          {isOwnProfile ? (
            <TouchableOpacity
              onPress={() => router.push('/edit-profile')}
              accessibilityRole="button"
              accessibilityLabel="Edit profile photo"
            >
              <Avatar name={displayName} uri={profile.avatar_url} size={64} />
            </TouchableOpacity>
          ) : (
            <Avatar name={displayName} uri={profile.avatar_url} size={64} />
          )}

          <View style={{ flex: 1, gap: 2 }}>
            {isOwnProfile ? (
              <TouchableOpacity
                onPress={() => router.push('/edit-profile')}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Text
                  style={{
                    fontFamily: fontFamily.displaySemi,
                    fontSize: 20,
                    color: t.heading,
                  }}
                >
                  {displayName}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={{
                  fontFamily: fontFamily.displaySemi,
                  fontSize: 20,
                  color: t.heading,
                }}
              >
                {displayName}
              </Text>
            )}

            <View className="flex-row items-center gap-2 flex-wrap">
              {profile.username ? (
                <Text style={[type.bodySm, { color: t.body }]}>@{profile.username}</Text>
              ) : isOwnProfile ? (
                <Text style={[type.bodySm, { color: t.accent }]}>Edit profile</Text>
              ) : null}
              {(profile.current_streak ?? 0) > 0 ? (
                <>
                  {profile.username || isOwnProfile ? (
                    <Text style={[type.bodySm, { color: t.placeholder }]}>·</Text>
                  ) : null}
                  <StreakPill days={profile.current_streak} />
                </>
              ) : null}
            </View>
          </View>

          <LevelBadge level={progress.level} size={52} />
        </View>

        <View style={{ gap: 6 }}>
          <ProgressBar value={progress.ratio} height={8} />
          <View className="flex-row items-center justify-between">
            <Text style={[type.dataSm, { color: t.body }]}>
              {progress.currentXp.toLocaleString()} / {progress.targetXp.toLocaleString()} XP
            </Text>
            <Text style={[type.dataSm, { color: t.body }]}>
              {progress.toNext.toLocaleString()} XP Needed
            </Text>
          </View>
        </View>

        {profile.bio ? (
          <Text style={[type.bodySm, { color: t.body }]}>{profile.bio}</Text>
        ) : null}

        <View className="flex-row items-center gap-4">
          <Text style={[type.bodySm, { color: t.body }]}>
            <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading }}>
              {(followCounts?.followers ?? 0).toLocaleString()}
            </Text>{' '}
            followers
          </Text>
          <Text style={[type.bodySm, { color: t.body }]}>
            <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading }}>
              {(followCounts?.following ?? 0).toLocaleString()}
            </Text>{' '}
            following
          </Text>
          {isFriend ? (
            <Text style={[type.bodySm, { color: t.accent }]}>Friends</Text>
          ) : null}
        </View>

        {!isOwnProfile ? (
          <TouchableOpacity
            onPress={() => toggleFollow.mutate({ isFollowing })}
            disabled={toggleFollow.isPending}
            accessibilityRole="button"
            accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
            style={{
              marginTop: 2,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: isFollowing ? t.buttonBg : t.accent,
              borderWidth: isFollowing ? 1 : 0,
              borderColor: t.buttonBorder,
              opacity: toggleFollow.isPending ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                fontSize: 15,
                color: isFollowing ? t.heading : t.accentOnPrimary,
              }}
            >
              {isFollowing ? 'Following' : followStatus?.isFollowedBy ? 'Follow back' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </GlassSurface>

      <View className="flex-row gap-3">
        <StatTile
          icon="flame"
          label="Streak"
          value={`${profile.current_streak}`}
          isActive={activeView === 'streak'}
          onPress={() => setActiveView('streak')}
        />
        <StatTile
          icon="footsteps"
          label="Activities"
          value={totalActivities.toLocaleString()}
          isActive={activeView === 'activities'}
          onPress={() => setActiveView('activities')}
        />
        <StatTile
          icon="trophy"
          label="Badges"
          value="—"
          isActive={activeView === 'badges'}
          onPress={() => setActiveView('badges')}
        />
      </View>

      {activeView === 'streak' ? (
        <ProfileStreakCalendar activities={activities ?? []} />
      ) : null}

      {activeView === 'activities' ? (
        <ProfileActivitiesFeed
          activities={activities ?? []}
          emptyMessage={
            isOwnProfile
              ? undefined
              : 'No activities to show yet.'
          }
        />
      ) : null}

      {activeView === 'badges' ? <BadgesComingSoon /> : null}
    </>
  );
}

function StatTile({
  icon,
  label,
  value,
  isActive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const t = useThemeTokens();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${label}, ${value}`}
      style={{ flex: 1 }}
    >
      <GlassSurface
        style={{
          padding: 14,
          flex: 1,
          gap: 4,
          alignItems: 'center',
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive ? t.accent : undefined,
        }}
      >
        <Ionicons name={icon} size={22} color={t.accent} />
        <Text style={[type.data, { color: t.heading }]}>{value}</Text>
        <Text style={[type.dataSm, { color: isActive ? t.heading : t.body }]}>{label}</Text>
      </GlassSurface>
    </TouchableOpacity>
  );
}

function BadgesComingSoon() {
  const t = useThemeTokens();
  const float = useSharedValue(0);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [float, glow]);

  const medalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <GlassSurface
      style={{
        padding: 28,
        gap: 18,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={[`${t.accent}33`, 'transparent', `${t.accent}18`]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      />

      <View style={{ height: 88, width: 88, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 78,
              height: 78,
              borderRadius: 39,
              backgroundColor: t.accent,
            },
            glowStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.buttonBg,
              borderWidth: 1,
              borderColor: `${t.accent}66`,
            },
            medalStyle,
          ]}
        >
          <Ionicons name="trophy" size={34} color="#f59e0b" />
        </Animated.View>
      </View>

      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: `${t.accent}22`,
          borderWidth: 1,
          borderColor: `${t.accent}55`,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamily.bodySemi,
            fontSize: 11,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: t.accent,
          }}
        >
          Coming soon
        </Text>
      </View>

      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: fontFamily.displaySemi,
            fontSize: 22,
            color: t.heading,
            textAlign: 'center',
          }}
        >
          Badges are forging
        </Text>
        <Text
          style={[
            type.bodySm,
            { color: t.body, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
          ]}
        >
          Streaks, social flexes, and rare unlocks are on the way. Keep logging — your trophy case
          is almost ready.
        </Text>
      </View>

      <View className="w-full flex-row gap-2" style={{ marginTop: 4 }}>
        {(['Streaks', 'Social', 'Rare'] as const).map((label) => (
          <View
            key={label}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: `${t.heading}08`,
              borderWidth: 1,
              borderColor: `${t.heading}14`,
              gap: 4,
            }}
          >
            <Ionicons
              name={
                label === 'Streaks'
                  ? 'flame-outline'
                  : label === 'Social'
                    ? 'people-outline'
                    : 'diamond-outline'
              }
              size={16}
              color={t.body}
            />
            <Text style={[type.dataSm, { color: t.body }]}>{label}</Text>
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}
