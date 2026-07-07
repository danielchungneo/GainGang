import { router } from "expo-router";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DailyGoalCard } from "@/components/daily-goal-card";

import {
  Button,
  GlassSurface,
  LevelBadge,
  ScreenBackground,
  StreakPill
} from "@/components/ui";

import { useAuth } from "@/context/auth-context";

import { useMyGangs } from "@/hooks/use-gangs";

import { useProfile } from "@/hooks/use-profile";

import { useMyTodaysDailyGoals } from "@/hooks/use-weekly-plans";

import { useThemeTokens } from "@/hooks/use-theme-tokens";

import { fontFamily, spacing, type, useTheme } from "@/lib/gaingang-theme";

import { levelFromXp } from "@/types";

export default function TodayScreen() {
  const t = useThemeTokens();

  const { theme } = useTheme();

  const { session } = useAuth();

  const { data: profile } = useProfile();

  const { data: gangs } = useMyGangs();

  const { data: dailyGoals, isLoading, refetch, isRefetching } =
    useMyTodaysDailyGoals();

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    (session?.user.user_metadata?.full_name as string | undefined)?.split(
      " ",
    )[0];

  const dailyGoalsList = dailyGoals ?? [];
  const adminGangs =
    gangs?.filter((g) => g.role === 'owner' || g.role === 'admin') ?? [];

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
        <View className="mt-4 flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-2">
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

          {profile ? (
            <LevelBadge level={levelFromXp(profile.xp ?? 0)} size={52} />
          ) : null}
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
              Weekly plans with daily goals are issued at the Gang level. Join
              or create one to start your grind.
            </Text>

            <Button
              label="FIND A GANG"
              onPress={() => router.push("/(tabs)/groups")}
            />
          </GlassSurface>
        ) : dailyGoalsList.length === 0 ? (
          <GlassSurface style={{ padding: 20, gap: adminGangs.length > 0 ? 12 : 6 }}>
            <Text
              style={[
                {
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 18,
                  color: t.heading,
                },
              ]}
            >
              No goals for today
            </Text>

            <Text style={[type.bodySm, { color: t.body }]}>
              {adminGangs.length > 0
                ? 'Today is a rest day in your plan, or this day has no exercises yet.'
                : 'Your Gang leader hasn\u2019t published a weekly plan yet, or today is a rest day.'}
            </Text>

            {adminGangs.length > 0 ? (
              <Button
                label="MANAGE WEEKLY PLAN"
                onPress={() =>
                  router.push({
                    pathname: '/gang/[id]',
                    params: { id: adminGangs[0].id },
                  })
                }
              />
            ) : null}
          </GlassSurface>
        ) : (
          <View className="gap-3">
            <Text style={[type.label, { color: theme.colors.textMuted }]}>
              Today&apos;s goals
            </Text>

            {dailyGoalsList.map((g) => (
              <DailyGoalCard key={g.id} goal={g} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
