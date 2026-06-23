import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  Avatar,
  GlassSurface,
  RankBadge,
  ScreenBackground,
  StreakPill,
  XPBar,
} from "@/components/ui";

import { useAchievements } from "@/hooks/use-achievements";

import { useMyActivities } from "@/hooks/use-activities";

import { useProfile } from "@/hooks/use-profile";

import { useThemeTokens } from "@/hooks/use-theme-tokens";

import { formatAmount, timeAgo } from "@/lib/format";

import { fontFamily, spacing, type } from "@/lib/gaingang-theme";

import { RANK_ORDER, RANK_THRESHOLDS, rankProgress } from "@/types";

export default function ProfileScreen() {
  const t = useThemeTokens();

  const { data: profile, isLoading, refetch, isRefetching } = useProfile();

  const { data: activities } = useMyActivities();

  const { data: achievements } = useAchievements();

  const progress = rankProgress(profile?.xp ?? 0);

  const floor = RANK_THRESHOLDS[progress.current];

  const ceil = progress.next ? RANK_THRESHOLDS[progress.next] : floor;

  const earned = (achievements ?? []).filter((a) => a.earned);

  const totalReps = (activities ?? [])

    .filter((a) => a.unit === "reps")

    .reduce((sum, a) => sum + a.amount, 0);

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

                <RankBadge rank={profile.rank} size={52} />
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

            <XPBar
              level={RANK_ORDER.indexOf(progress.current) + 1}
              fromTier={progress.current}
              toTier={progress.next ?? progress.current}
              currentXp={profile.xp - floor}
              targetXp={progress.next ? ceil - floor : 1}
            />

            <View className="flex-row gap-3">
              <StatTile
                icon="flame"
                label="Streak"
                value={`${profile.current_streak}`}
              />

              <StatTile
                icon="barbell"
                label="Total reps"
                value={totalReps.toLocaleString()}
              />

              <StatTile
                icon="trophy"
                label="Badges"
                value={`${earned.length}`}
              />
            </View>

            <Text style={[type.label, { color: t.heading }]}>Achievements</Text>

            <View className="flex-row flex-wrap gap-3">
              {(achievements ?? []).map((a) => (
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

            <Text style={[type.label, { color: t.heading }]} className="mt-2">
              Recent activity
            </Text>

            {activities && activities.length > 0 ? (
              <GlassSurface style={{ padding: 8 }}>
                {activities.slice(0, 12).map((a) => (
                  <View
                    key={a.id}
                    className="flex-row items-center justify-between px-2 py-2.5"
                  >
                    <View className="flex-1">
                      <Text
                        style={[
                          {
                            fontFamily: fontFamily.bodySemi,
                            fontSize: 15,
                            color: t.heading,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {a.exercise_name}
                      </Text>

                      <Text style={[type.dataSm, { color: t.body }]}>
                        {timeAgo(a.created_at)}
                      </Text>
                    </View>

                    <Text style={[type.data, { color: t.accent }]}>
                      {formatAmount(a.amount, a.unit)}
                    </Text>
                  </View>
                ))}
              </GlassSurface>
            ) : (
              <Text style={[type.bodySm, { color: t.body }]}>
                No workouts logged yet. Tap the + on the Today tab to start.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const t = useThemeTokens();

  return (
    <GlassSurface
      style={{ padding: 14, flex: 1, gap: 4, alignItems: "center" }}
    >
      <Ionicons name={icon} size={22} color={t.accent} />

      <Text style={[type.data, { color: t.heading }]}>{value}</Text>

      <Text style={[type.dataSm, { color: t.body }]}>{label}</Text>
    </GlassSurface>
  );
}
