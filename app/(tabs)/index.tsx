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

import { GoalCard } from "@/components/goal-card";

import {
  Button,
  GlassSurface,
  ScreenBackground,
  StreakPill
} from "@/components/ui";

import { useAuth } from "@/context/auth-context";

import { useMyGangs } from "@/hooks/use-gangs";

import { useProfile } from "@/hooks/use-profile";

import { useMyQuests } from "@/hooks/use-quests";

import { useThemeTokens } from "@/hooks/use-theme-tokens";

import { fontFamily, spacing, type, useTheme } from "@/lib/gaingang-theme";

import {
  CATEGORY_LABELS,
  RANK_THRESHOLDS,
  rankProgress,
  todaysCategory,
  WEEKLY_SCHEDULE
} from "@/types";

export default function TodayScreen() {
  const t = useThemeTokens();

  const { theme } = useTheme();

  const { session } = useAuth();

  const { data: profile } = useProfile();

  const { data: gangs } = useMyGangs();

  const { data: goals, isLoading, refetch, isRefetching } = useMyQuests();

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    (session?.user.user_metadata?.full_name as string | undefined)?.split(
      " ",
    )[0];

  const category = todaysCategory();

  const daySchedule = WEEKLY_SCHEDULE.find((d) => d.category === category);

  const progress = rankProgress(profile?.xp ?? 0);

  const floor = RANK_THRESHOLDS[progress.current];

  const ceil = progress.next ? RANK_THRESHOLDS[progress.next] : floor;

  const dailyGoals = (goals ?? []).filter((g) => g.type === "daily");

  const weeklyGoals = (goals ?? []).filter((g) => g.type === "weekly");

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
        <View className="mt-4 gap-2">
          <Text style={[type.labelSm, { color: t.body }]}>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Text>

          <Text style={[type.heading, { color: t.heading }]}>
            {firstName ? `Let's gain, ${firstName}` : "Let's gain"}
          </Text>
        </View>

        {(profile?.current_streak ?? 0) > 0 ? (
          <StreakPill days={profile?.current_streak ?? 0} />
        ) : null}

        {/* {profile ? (
          <XPBar
            level={RANK_ORDER.indexOf(progress.current) + 1}
            fromTier={progress.current}
            toTier={progress.next ?? progress.current}
            currentXp={(profile.xp ?? 0) - floor}
            targetXp={progress.next ? ceil - floor : 1}
          />
        ) : (
          <GlassSurface style={{ padding: 18, alignItems: "center" }}>
            <ActivityIndicator color={t.accent} />
          </GlassSurface>
        )} */}

        <GlassSurface style={{ padding: 18, gap: 6 }}>
          <Text style={[type.labelSm, { color: t.body }]}>
            Today&apos;s focus
          </Text>

          <View className="flex-row items-center gap-2">
            <Ionicons name="barbell" size={20} color={t.accent} />

            <Text
              style={[
                type.goalTitle,
                { color: t.heading, fontSize: 22, lineHeight: 26 },
              ]}
            >
              {CATEGORY_LABELS[category]} day
            </Text>
          </View>

          <Text style={[type.bodySm, { color: t.body }]}>
            {daySchedule?.focus}
          </Text>
        </GlassSurface>

        {isLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />
        ) : !gangs || gangs.length === 0 ? (
          <GlassSurface style={{ padding: 20, gap: 12 }}>
            <Text
              style={[
                type.heading,
                { color: t.heading, fontSize: 22, lineHeight: 28 },
              ]}
            >
              Join a Gang to get Goals
            </Text>

            <Text style={[type.bodySm, { color: t.body }]}>
              Daily and weekly Goals are issued at the Gang level. Join or
              create one to start your grind.
            </Text>

            <Button
              label="FIND A GANG"
              onPress={() => router.push("/(tabs)/groups")}
            />
          </GlassSurface>
        ) : (goals?.length ?? 0) === 0 ? (
          <GlassSurface style={{ padding: 20, gap: 6 }}>
            <Text
              style={[
                {
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 18,
                  color: t.heading,
                },
              ]}
            >
              No active Goals
            </Text>

            <Text style={[type.bodySm, { color: t.body }]}>
              Your Gang leaders haven&apos;t issued a Goal yet. Log a freestyle
              workout to keep your streak alive.
            </Text>
          </GlassSurface>
        ) : (
          <>
            {dailyGoals.length > 0 && (
              <View className="gap-3">
                <Text style={[type.label, { color: theme.colors.textMuted }]}>
                  Daily Goals
                </Text>

                {dailyGoals.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </View>
            )}

            {weeklyGoals.length > 0 && (
              <View className="gap-3">
                <Text style={[type.label, { color: theme.colors.textMuted }]}>
                  Weekly Goals
                </Text>

                {weeklyGoals.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={() => router.push("/log-activity")}
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: t.accent,

          shadowColor: theme.colors.primary,

          shadowOpacity: 0.5,

          shadowRadius: 12,

          shadowOffset: { width: 0, height: 4 },

          elevation: 8,
        }}
      >
        <Ionicons name="add" size={32} color={t.accentOnPrimary} />
      </TouchableOpacity>
    </ScreenBackground>
  );
}
