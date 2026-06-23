import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import { useState } from "react";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ProfileActivitiesFeed } from "@/components/profile-activities-feed";
import { ProfileStreakCalendar } from "@/components/profile-streak-calendar";
import {
  Avatar,
  GlassSurface,
  LevelBadge,
  ProgressBar,
  ScreenBackground,
  StreakPill,
} from "@/components/ui";

import { LevelUpOverlay } from "@/components/level-up-overlay";

import { useAchievements, type AchievementWithProgress } from "@/hooks/use-achievements";

import { useMyActivities } from "@/hooks/use-activities";

import { useProfile } from "@/hooks/use-profile";

import { useThemeTokens } from "@/hooks/use-theme-tokens";

import { fontFamily, spacing, type } from "@/lib/gaingang-theme";

import { levelProgress } from "@/types";

type ProfileView = "streak" | "activities" | "badges";

export default function ProfileScreen() {
  const t = useThemeTokens();

  const { data: profile, isLoading, refetch, isRefetching } = useProfile();

  const [showLevelUpPreview, setShowLevelUpPreview] = useState(false);
  const [levelUpPreviewKey, setLevelUpPreviewKey] = useState(0);
  const [activeView, setActiveView] = useState<ProfileView>("streak");

  const { data: activities } = useMyActivities();

  const { data: achievements } = useAchievements();

  const progress = levelProgress(profile?.xp ?? 0);

  const earned = (achievements ?? []).filter((a) => a.earned);
  const totalActivities = activities?.length ?? 0;

  function handlePreviewLevelUp() {
    setShowLevelUpPreview(false);
    requestAnimationFrame(() => {
      setLevelUpPreviewKey((k) => k + 1);
      setShowLevelUpPreview(true);
    });
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
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={t.accent}
          />
        }
      >
        <View className="mt-4 flex-row items-center justify-between">
          <Text style={[type.heading, { color: t.heading }]}>Profile</Text>

          <TouchableOpacity
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={24} color={t.heading} />
          </TouchableOpacity>
        </View>

        {isLoading || !profile ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            <GlassSurface style={{ padding: 20, gap: 14 }}>
              <View className="flex-row items-center gap-4">
                <Avatar
                  name={profile.full_name || "You"}
                  uri={profile.avatar_url}
                  size={64}
                />

                <View className="flex-1">
                  <Text
                    style={[
                      {
                        fontFamily: fontFamily.displaySemi,
                        fontSize: 20,
                        color: t.heading,
                      },
                    ]}
                  >
                    {profile.full_name || "Unnamed Hunter"}
                  </Text>

                  {profile.username ? (
                    <Text style={[type.bodySm, { color: t.body }]}>
                      @{profile.username}
                    </Text>
                  ) : null}
                </View>

                <LevelBadge level={progress.level} size={52} />
              </View>

              <View style={{ gap: 6 }}>
                <ProgressBar value={progress.ratio} height={8} />

                <View className="flex-row items-center justify-between">
                  <Text style={[type.dataSm, { color: t.body }]}>
                    {progress.currentXp.toLocaleString()} /{" "}
                    {progress.targetXp.toLocaleString()} XP
                  </Text>

                  <Text style={[type.dataSm, { color: t.body }]}>
                    {progress.toNext.toLocaleString()} XP Needed
                  </Text>
                </View>
              </View>

              {profile.bio ? (
                <Text style={[type.bodySm, { color: t.body }]}>
                  {profile.bio}
                </Text>
              ) : null}
            </GlassSurface>

            {(profile.current_streak ?? 0) > 0 ? (
              <StreakPill days={profile.current_streak} />
            ) : null}

            {__DEV__ ? (
              <TouchableOpacity
                onPress={handlePreviewLevelUp}
                className="items-center rounded-xl border py-3"
                style={{
                  borderColor: t.buttonBorder,
                  backgroundColor: t.buttonBg,
                }}
              >
                <Text
                  style={{ color: t.body }}
                  className="text-sm font-semibold"
                >
                  Preview level up animation
                </Text>
              </TouchableOpacity>
            ) : null}

            <View className="flex-row gap-3">
              <StatTile
                icon="flame"
                label="Streak"
                value={`${profile.current_streak}`}
                isActive={activeView === "streak"}
                onPress={() => setActiveView("streak")}
              />

              <StatTile
                icon="footsteps"
                label="Activities"
                value={totalActivities.toLocaleString()}
                isActive={activeView === "activities"}
                onPress={() => setActiveView("activities")}
              />

              <StatTile
                icon="trophy"
                label="Badges"
                value={`${earned.length}`}
                isActive={activeView === "badges"}
                onPress={() => setActiveView("badges")}
              />
            </View>

            {activeView === "streak" ? (
              <ProfileStreakCalendar
                activities={activities ?? []}
                currentStreak={profile.current_streak ?? 0}
              />
            ) : null}

            {activeView === "activities" ? (
              <ProfileActivitiesFeed activities={activities ?? []} />
            ) : null}

            {activeView === "badges" ? (
              <ProfileBadgesGrid achievements={achievements ?? []} />
            ) : null}
          </>
        )}
      </ScrollView>

      {showLevelUpPreview ? (
        <LevelUpOverlay
          key={levelUpPreviewKey}
          visible
          fromLevel={progress.level}
          toLevel={progress.level + 1}
          onDismiss={() => setShowLevelUpPreview(false)}
        />
      ) : null}
    </ScreenBackground>
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
          alignItems: "center",
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive ? t.accent : undefined,
        }}
      >
        <Ionicons name={icon} size={22} color={t.accent} />

        <Text style={[type.data, { color: t.heading }]}>{value}</Text>

        <Text style={[type.dataSm, { color: isActive ? t.heading : t.body }]}>
          {label}
        </Text>
      </GlassSurface>
    </TouchableOpacity>
  );
}

function ProfileBadgesGrid({
  achievements,
}: {
  achievements: AchievementWithProgress[];
}) {
  const t = useThemeTokens();
  const list = achievements ?? [];

  return (
    <View style={{ gap: 12 }}>
      <Text style={[type.label, { color: t.heading }]}>Achievements</Text>

      <View className="flex-row flex-wrap gap-3">
        {list.map((a) => (
          <GlassSurface
            key={a.id}
            style={{
              padding: 14,
              width: "47%",
              gap: 6,
              opacity: a.earned ? 1 : 0.45,
            }}
          >
            <Ionicons
              name={a.earned ? "trophy" : "lock-closed"}
              size={22}
              color={a.earned ? "#f59e0b" : t.body}
            />

            <Text
              style={[
                {
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 14,
                  color: t.heading,
                },
              ]}
              numberOfLines={1}
            >
              {a.is_secret && !a.earned ? "???" : a.title}
            </Text>

            <Text
              style={[type.bodySm, { color: t.body }]}
              numberOfLines={2}
            >
              {a.is_secret && !a.earned
                ? "Hidden achievement"
                : a.description}
            </Text>
          </GlassSurface>
        ))}
      </View>
    </View>
  );
}
