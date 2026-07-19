import { router } from "expo-router";

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DailyGoalCard } from "@/components/daily-goal-card";
import { DailyRewardClaimBanner } from "@/components/daily-reward-claim-banner";
import { GoalCompleteOverlay } from "@/components/goal-complete-overlay";
import { LevelUpOverlay } from "@/components/level-up-overlay";
import { StreakContinueOverlay } from "@/components/streak-continue-overlay";

import {
  Button,
  GlassSurface,
  LevelBadge,
  ScreenBackground,
  StreakPill
} from "@/components/ui";

import { useAuth } from "@/context/auth-context";

import { useDailyGoalSaveCelebrations } from "@/hooks/use-daily-goal-save-celebrations";

import { useMyGangs } from "@/hooks/use-gangs";

import { useProfile } from "@/hooks/use-profile";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

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

  const { data: dailyGoals, isLoading, refetch } = useMyTodaysDailyGoals();

  const { isRefreshing, onRefresh } = usePullToRefresh(refetch);

  const {
    streakContinue,
    streakKey,
    celebration,
    celebrationKey,
    levelUp,
    levelUpKey,
    handleActivitySaved,
    dismissStreakContinue,
    dismissCelebration,
    dismissLevelUp,
  } = useDailyGoalSaveCelebrations();

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    (session?.user.user_metadata?.full_name as string | undefined)?.split(
      " ",
    )[0];

  const dailyGoalsList = dailyGoals ?? [];

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
        <View className="mt-4 flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <Text style={[type.labelSm, { color: t.body }]}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              {(profile?.current_streak ?? 0) > 0 ? (
                <>
                  <Text style={[type.labelSm, { color: t.placeholder }]}>·</Text>
                  <StreakPill days={profile?.current_streak ?? 0} />
                </>
              ) : null}
            </View>

            <Text style={[type.heading, { color: t.heading }]}>
              {firstName ? `Let's gain, ${firstName}` : "Let's gain"}
            </Text>
          </View>

          {profile ? (
            <LevelBadge level={levelFromXp(profile.xp ?? 0)} size={52} />
          ) : null}
        </View>

        {dailyGoalsList.length > 0 ? (
          <DailyRewardClaimBanner goals={dailyGoalsList} />
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
              No goals for today
            </Text>

            <Text style={[type.bodySm, { color: t.body }]}>
              Your Gang leader hasn&apos;t published a weekly plan yet, or today is a rest day.
            </Text>
          </GlassSurface>
        ) : (
          <View className="gap-3">
            <Text style={[type.label, { color: theme.colors.textMuted }]}>
              Today&apos;s goals
            </Text>

            {dailyGoalsList.map((g) => (
              <DailyGoalCard
                key={g.id}
                goal={g}
                cameraActions
                onActivitySaved={handleActivitySaved}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {streakContinue ? (
        <StreakContinueOverlay
          key={streakKey}
          visible
          fromDays={streakContinue.fromDays}
          toDays={streakContinue.toDays}
          onDismiss={dismissStreakContinue}
        />
      ) : null}

      {celebration && !streakContinue ? (
        <GoalCompleteOverlay
          key={celebrationKey}
          visible
          questTitle={celebration.title}
          questKind="Daily Goal"
          xpEarned={celebration.xpEarned}
          exercises={celebration.exercises}
          onDismiss={dismissCelebration}
        />
      ) : null}

      {levelUp && !celebration && !streakContinue ? (
        <LevelUpOverlay
          key={levelUpKey}
          visible
          fromLevel={levelUp.fromLevel}
          toLevel={levelUp.toLevel}
          onDismiss={dismissLevelUp}
        />
      ) : null}
    </ScreenBackground>
  );
}
