import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AchievementDetailModal } from '@/components/achievement-detail-modal';
import { ProfileActivitiesFeed } from '@/components/profile-activities-feed';
import { ProfileStreakCalendar } from '@/components/profile-streak-calendar';
import {
  AchievementBadge,
  Avatar,
  GlassSurface,
  ImageViewerModal,
  LevelBadge,
  ProgressBar,
  StreakPill,
} from '@/components/ui';
import { useUserActivities } from '@/hooks/use-activities';
import {
  useAchievements,
  type AchievementWithProgress,
} from '@/hooks/use-achievements';
import { useEquippedCosmetics } from '@/hooks/use-cosmetics';
import { useFollowCounts, useFollowStatus, useToggleFollow } from '@/hooks/use-follows';
import { useProfile } from '@/hooks/use-profile';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { resolveAchievementTier, collapseAchievementLines, sortAchievementsByRarity } from '@/lib/achievements';
import { fontFamily, type } from '@/lib/gaingang-theme';
import { rarityDef } from '@/lib/rewards';
import { levelProgress } from '@/types';

type ProfileView = 'streak' | 'activities' | 'badges';

interface UserProfileViewProps {
  userId: string;
  isOwnProfile: boolean;
}

export function UserProfileView({ userId, isOwnProfile }: UserProfileViewProps) {
  const t = useThemeTokens();
  const [activeView, setActiveView] = useState<ProfileView>('streak');
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [godModeBadgeCount, setGodModeBadgeCount] = useState<number | null>(null);

  const { data: profile, isLoading } = useProfile(userId);
  const { data: activities } = useUserActivities(userId);
  const { data: achievements, isLoading: loadingAchievements } = useAchievements(userId);
  const equipped = useEquippedCosmetics(profile);
  const { data: followCounts } = useFollowCounts(userId);
  const { data: followStatus } = useFollowStatus(isOwnProfile ? undefined : userId);
  const toggleFollow = useToggleFollow(userId);

  const earnedBadgeCount = useMemo(
    () => (achievements ?? []).filter((a) => a.earned).length,
    [achievements],
  );

  const progress = levelProgress(profile?.xp ?? 0);
  const totalActivities = activities?.length ?? 0;
  const isFollowing = followStatus?.isFollowing ?? false;
  const isFriend = followStatus?.isFriend ?? false;

  if (isLoading || !profile) {
    return <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />;
  }

  const displayName = profile.full_name || (isOwnProfile ? 'Unnamed Hunter' : 'Hunter');
  const avatarUri = profile.avatar_url;
  const titleName = equipped.title?.name ?? null;
  const titleColor = equipped.title
    ? rarityDef(equipped.title.rarity).color
    : t.accent;

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
              <Avatar
                name={displayName}
                uri={avatarUri}
                size={64}
                borderStyle={equipped.avatarBorder?.style}
              />
            </TouchableOpacity>
          ) : avatarUri ? (
            <TouchableOpacity
              onPress={() => setIsAvatarViewerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="View profile photo"
            >
              <Avatar
                name={displayName}
                uri={avatarUri}
                size={64}
                borderStyle={equipped.avatarBorder?.style}
              />
            </TouchableOpacity>
          ) : (
            <Avatar
              name={displayName}
              uri={avatarUri}
              size={64}
              borderStyle={equipped.avatarBorder?.style}
            />
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
              ) : null}
              {titleName ? (
                <>
                  {profile.username ? (
                    <Text style={[type.bodySm, { color: t.placeholder }]}>·</Text>
                  ) : null}
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 12,
                      color: titleColor,
                    }}
                  >
                    {titleName}
                  </Text>
                </>
              ) : null}
              {(profile.current_streak ?? 0) > 0 ? (
                <>
                  {profile.username || titleName ? (
                    <Text style={[type.bodySm, { color: t.placeholder }]}>·</Text>
                  ) : null}
                  <StreakPill days={profile.current_streak} />
                </>
              ) : null}
            </View>
          </View>

          <LevelBadge
            level={progress.level}
            size={52}
            borderStyle={equipped.levelBorder?.style}
          />
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

        {isOwnProfile ? (
          <TouchableOpacity
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={{
              marginTop: 2,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: t.buttonBg,
              borderWidth: 1,
              borderColor: t.buttonBorder,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                fontSize: 15,
                color: t.heading,
              }}
            >
              Edit profile
            </Text>
          </TouchableOpacity>
        ) : (
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
        )}
      </GlassSurface>

      <View className="flex-row gap-3">
        <StatTile
          icon="flame"
          label="Streak"
          value={`${profile.current_streak}`}
          isActive={activeView === 'streak'}
          onPress={() => {
            if (activeView === 'badges') setGodModeBadgeCount(null);
            setActiveView('streak');
          }}
        />
        <StatTile
          icon="footsteps"
          label="Activities"
          value={totalActivities.toLocaleString()}
          isActive={activeView === 'activities'}
          onPress={() => {
            if (activeView === 'badges') setGodModeBadgeCount(null);
            setActiveView('activities');
          }}
        />
        <StatTile
          icon="trophy"
          label="Badges"
          value={
            loadingAchievements
              ? '—'
              : String(godModeBadgeCount ?? earnedBadgeCount)
          }
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

      {activeView === 'badges' ? (
        <ProfileAchievementsGrid
          achievements={achievements ?? []}
          isLoading={loadingAchievements}
          onGodModeEarnedCountChange={isOwnProfile ? setGodModeBadgeCount : undefined}
        />
      ) : null}

      {!isOwnProfile ? (
        <ImageViewerModal
          uri={avatarUri}
          visible={isAvatarViewerOpen}
          onClose={() => setIsAvatarViewerOpen(false)}
          accessibilityLabel={`${displayName}'s profile photo`}
        />
      ) : null}
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

function ProfileAchievementsGrid({
  achievements,
  isLoading,
  onGodModeEarnedCountChange,
}: {
  achievements: AchievementWithProgress[];
  isLoading: boolean;
  onGodModeEarnedCountChange?: (count: number | null) => void;
}) {
  const t = useThemeTokens();
  const [selected, setSelected] = useState<AchievementWithProgress | null>(null);
  const [godMode, setGodMode] = useState(false);

  const displayAchievements = useMemo(() => {
    const source = godMode
      ? achievements.map((a) => ({
          ...a,
          earned: true,
          earned_at: a.earned_at ?? new Date().toISOString(),
        }))
      : achievements;
    return sortAchievementsByRarity(collapseAchievementLines(source));
  }, [achievements, godMode]);

  if (isLoading) {
    return <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />;
  }

  if (achievements.length === 0) {
    return (
      <GlassSurface style={{ padding: 24, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: fontFamily.displaySemi, fontSize: 18, color: t.heading }}>
          No badges yet
        </Text>
        <Text style={[type.bodySm, { color: t.body, textAlign: 'center' }]}>
          Hit goals, keep streaks, and hype your gang to start forging badges.
        </Text>
      </GlassSurface>
    );
  }

  function toggleGodMode() {
    setGodMode((prev) => {
      const next = !prev;
      if (!next) {
        onGodModeEarnedCountChange?.(null);
        return false;
      }
      const preview = sortAchievementsByRarity(
        collapseAchievementLines(achievements.map((a) => ({ ...a, earned: true }))),
      );
      onGodModeEarnedCountChange?.(preview.length);
      return true;
    });
  }

  return (
    <>
      <GlassSurface style={{ padding: 16, gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 11,
              letterSpacing: 1.6,
              color: t.body,
              textTransform: 'uppercase',
              flex: 1,
            }}
          >
            Trophy case
          </Text>
          {__DEV__ && onGodModeEarnedCountChange ? (
            <TouchableOpacity
              onPress={toggleGodMode}
              accessibilityRole="switch"
              accessibilityState={{ checked: godMode }}
              accessibilityLabel="Toggle god mode — show all achievements unlocked"
              hitSlop={8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: godMode ? '#F5A524' : `${t.heading}22`,
                backgroundColor: godMode ? 'rgba(245,165,36,0.18)' : `${t.heading}08`,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  color: godMode ? '#F5A524' : t.body,
                }}
              >
                GOD MODE
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {godMode ? (
          <Text style={[type.bodySm, { color: '#F5A524' }]}>
            God mode on — highest tier of each line unlocked (preview only).
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
          }}
        >
          {displayAchievements.map((achievement) => {
            const tier = resolveAchievementTier({
              key: achievement.key,
              tier: achievement.tier,
              threshold: achievement.threshold,
            });
            return (
              <View
                key={achievement.id}
                style={{
                  width: '33.333%',
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingHorizontal: 4,
                }}
              >
                <AchievementBadge
                  icon={achievement.icon}
                  tier={tier}
                  earned={achievement.earned}
                  size={64}
                  showLabel
                  title={achievement.title}
                  onPress={() => setSelected(achievement)}
                />
              </View>
            );
          })}
        </View>
      </GlassSurface>

      <AchievementDetailModal
        visible={!!selected}
        achievement={selected}
        earned={selected?.earned ?? false}
        earnedAt={selected?.earned_at}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
