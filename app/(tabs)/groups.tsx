import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { ActivityCard } from '@/components/activity-card';
import { GangOptionsDrawer } from '@/components/gang-add-menu';
import { GangGoalProgress } from '@/components/gang-goal-progress';
import { GangSelector } from '@/components/gang-selector';
import { WeeklyPlanAdminActions, WeeklyPlanWeekHeader } from '@/components/weekly-plan-admin-actions';
import { GlassSurface } from '@/components/ui/glass-surface';
import { GradientTabSelect } from '@/components/ui/gradient-tab-select';
import { LeaderboardRow } from '@/components/ui/leaderboard-row';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import { useGangFeed } from '@/hooks/use-activities';
import { useMyGangs } from '@/hooks/use-gangs';
import { useLeaderboard, type LeaderboardPeriod } from '@/hooks/use-leaderboard';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useActiveWeeklyPlan } from '@/hooks/use-weekly-plans';
import { formatGoalDate, todayISO } from '@/lib/format';
import { shareGangInvite } from '@/lib/gang-invite';
import { fontFamily, spacing, type, useTheme } from '@/lib/gaingang-theme';

type GangViewTab = 'progress' | 'activity' | 'leaderboard';

const VIEW_TABS: { key: GangViewTab; label: string }[] = [
  { key: 'progress', label: 'Progress' },
  { key: 'activity', label: 'Activity' },
  { key: 'leaderboard', label: 'Leaderboard' },
];

export default function GroupsScreen() {
  const t = useThemeTokens();
  const queryClient = useQueryClient();
  const { gangId: gangIdParam, tab: tabParam } = useLocalSearchParams<{
    gangId?: string;
    tab?: string;
  }>();
  const [selectedGangId, setSelectedGangId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [viewTab, setViewTab] = useState<GangViewTab>('progress');
  const [isSharingInvite, setIsSharingInvite] = useState(false);

  const { data: gangs, isLoading: gangsLoading, refetch: refetchGangs, isRefetching: gangsRefetching } =
    useMyGangs();

  const gangId = selectedGangId ?? gangs?.[0]?.id ?? '';
  const selectedGang = gangs?.find((g) => g.id === gangId);
  const isGangOwner = selectedGang?.role === 'owner';
  const canInvite = !!selectedGang;

  const {
    data: weeklyPlan,
    isLoading: planLoading,
    refetch: refetchPlan,
    isRefetching: planRefetching,
  } = useActiveWeeklyPlan(gangId);

  const {
    data: feed,
    isLoading: feedLoading,
    refetch: refetchFeed,
    isRefetching: feedRefetching,
  } = useGangFeed(gangId);

  useEffect(() => {
    if (!gangs?.length) {
      setSelectedGangId(null);
      return;
    }

    if (gangIdParam && gangs.some((g) => g.id === gangIdParam)) {
      setSelectedGangId(gangIdParam);
      return;
    }

    if (!selectedGangId || !gangs.some((g) => g.id === selectedGangId)) {
      setSelectedGangId(gangs[0].id);
    }
  }, [gangs, selectedGangId, gangIdParam]);

  useEffect(() => {
    if (tabParam === 'progress' || tabParam === 'activity' || tabParam === 'leaderboard') {
      setViewTab(tabParam);
    }
  }, [tabParam]);

  const onRefresh = useCallback(() => {
    refetchGangs();
    if (gangId) {
      refetchPlan();
      refetchFeed();
      queryClient.invalidateQueries({ queryKey: ['leaderboard', gangId] });
    }
  }, [refetchGangs, refetchPlan, refetchFeed, gangId, queryClient]);

  async function handleShareInvite() {
    if (!selectedGang || isSharingInvite) return;
    setIsSharingInvite(true);
    try {
      await shareGangInvite(selectedGang.name, selectedGang.invite_code);
    } finally {
      setIsSharingInvite(false);
    }
  }

  const isRefetching = gangsRefetching || planRefetching || feedRefetching;
  const hasGangs = !!gangs && gangs.length > 0;

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} />
        }
      >
        <View className="mt-4 flex-row items-center gap-3">
          <View style={{ flex: 1, minWidth: 0 }}>
            {hasGangs && selectedGang ? (
              <GangSelector
                gangs={gangs}
                selectedId={gangId}
                onSelect={setSelectedGangId}
              />
            ) : (
              <Text style={[type.heading, { color: t.heading }]}>Gangs</Text>
            )}
          </View>
          {hasGangs ? (
            <View className="flex-row items-center gap-2" style={{ flexShrink: 0 }}>
              {canInvite ? (
                <TouchableOpacity
                  onPress={handleShareInvite}
                  disabled={isSharingInvite}
                  className="h-10 flex-row items-center gap-1.5 rounded-full px-4"
                  style={{
                    backgroundColor: t.accent,
                    opacity: isSharingInvite ? 0.75 : 1,
                    shadowColor: t.accent,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  accessibilityLabel="Invite friends to this gang"
                >
                  {isSharingInvite ? (
                    <ActivityIndicator size="small" color={t.accentOnPrimary} />
                  ) : (
                    <Ionicons name="person-add" size={17} color={t.accentOnPrimary} />
                  )}
                  <Text
                    style={{
                      color: t.accentOnPrimary,
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 14,
                    }}
                  >
                    Invite
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setAddMenuOpen(true)}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: t.buttonBg,
                  borderWidth: 1,
                  borderColor: t.buttonBorder,
                }}
                accessibilityLabel="Open gang options"
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={t.accent} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {gangsLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
        ) : hasGangs ? (
          <View style={{ alignSelf: 'stretch', width: '100%', gap: spacing.md }}>
            <GradientTabSelect
              tabs={VIEW_TABS}
              selected={viewTab}
              onSelect={setViewTab}
            />

            {viewTab === 'progress' ? (
              <GangProgressTab
                gangId={gangId}
                isGangOwner={isGangOwner}
                weeklyPlan={weeklyPlan}
                isLoading={planLoading}
              />
            ) : null}
            {viewTab === 'activity' ? (
              <GangActivityTab gangId={gangId} feed={feed} isLoading={feedLoading} />
            ) : null}
            {viewTab === 'leaderboard' ? <GangLeaderboardTab gangId={gangId} /> : null}
          </View>
        ) : (
          <GlassSurface style={{ padding: 20, gap: 12 }}>
            <Text
              style={[
                type.heading,
                { color: t.heading, fontSize: 22, lineHeight: 28 },
              ]}
            >
              You&apos;re not in a Gang yet
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              Create your own crew or browse public gangs to start gaining together. Friends can
              also text you an invite link.
            </Text>

            <TouchableOpacity
              onPress={() => router.push('/gang/create')}
              className="mt-2 items-center rounded-xl py-3"
              style={{ backgroundColor: t.accent }}
            >
              <Text style={{ color: t.accentOnPrimary }} className="font-semibold">
                Create a Gang
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/gang/join')}
              className="items-center rounded-xl py-3"
              style={{
                backgroundColor: t.buttonBg,
                borderWidth: 1,
                borderColor: t.buttonBorder,
              }}
            >
              <Text style={{ color: t.accent }} className="font-semibold">
                Discover Gangs
              </Text>
            </TouchableOpacity>
          </GlassSurface>
        )}
      </ScrollView>

      {hasGangs ? (
        <GangOptionsDrawer
          visible={addMenuOpen}
          onClose={() => setAddMenuOpen(false)}
          gangId={gangId}
          showSettings={isGangOwner}
          weeklyPlanId={weeklyPlan?.id ?? null}
        />
      ) : null}
    </ScreenBackground>
  );
}

function GangProgressTab({
  gangId,
  isGangOwner,
  weeklyPlan,
  isLoading,
}: {
  gangId: string;
  isGangOwner: boolean;
  weeklyPlan: ReturnType<typeof useActiveWeeklyPlan>['data'];
  isLoading: boolean;
}) {
  const t = useThemeTokens();
  const today = todayISO();
  const [dayIndex, setDayIndex] = useState(0);

  const weekGoals = useMemo(() => {
    const goals = (weeklyPlan?.daily_goals ?? []).filter((g) => g.exercises.length > 0);
    return [...goals].sort((a, b) => a.goal_date.localeCompare(b.goal_date));
  }, [weeklyPlan?.daily_goals]);

  useEffect(() => {
    if (weekGoals.length === 0) {
      setDayIndex(0);
      return;
    }
    const todayIndex = weekGoals.findIndex((g) => g.goal_date === today);
    setDayIndex(todayIndex >= 0 ? todayIndex : 0);
  }, [weekGoals, today, gangId, weeklyPlan?.id]);

  const selectedGoal = weekGoals[dayIndex] ?? null;
  const canGoPrev = dayIndex > 0;
  const canGoNext = dayIndex < weekGoals.length - 1;

  return (
    <View className="gap-3">
      {weeklyPlan ? (
        <WeeklyPlanWeekHeader
          gangId={gangId}
          planId={weeklyPlan.id}
          startsOn={weeklyPlan.starts_on}
          endsOn={weeklyPlan.ends_on}
          isAdaptive={weeklyPlan.is_adaptive}
          canEdit={isGangOwner}
        />
      ) : isGangOwner ? (
        <WeeklyPlanAdminActions
          gangId={gangId}
          helperText="Publish a weekly plan so your crew knows what to hit each day."
        />
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />
      ) : weekGoals.length > 0 && selectedGoal ? (
        <View className="gap-3">
          <View
            className="flex-row items-center gap-2 rounded-xl px-2 py-2"
            style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}
          >
            <TouchableOpacity
              onPress={() => setDayIndex((i) => Math.max(0, i - 1))}
              disabled={!canGoPrev}
              accessibilityLabel="Previous day"
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ opacity: canGoPrev ? 1 : 0.35 }}
            >
              <Ionicons name="chevron-back" size={22} color={t.heading} />
            </TouchableOpacity>

            <View className="flex-1 items-center px-1">
              <Text
                style={{
                  color: t.heading,
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 15,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {formatGoalDate(selectedGoal.goal_date)}
              </Text>
              <Text style={[type.bodySm, { color: t.body, fontSize: 12 }]}>
                Day {dayIndex + 1} of {weekGoals.length}
                {selectedGoal.goal_date === today ? ' · Today' : ''}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setDayIndex((i) => Math.min(weekGoals.length - 1, i + 1))}
              disabled={!canGoNext}
              accessibilityLabel="Next day"
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ opacity: canGoNext ? 1 : 0.35 }}
            >
              <Ionicons name="chevron-forward" size={22} color={t.heading} />
            </TouchableOpacity>
          </View>

          <GangGoalProgress goal={selectedGoal} gangId={gangId} />
        </View>
      ) : (
        <EmptyCard
          title={weeklyPlan ? 'No workout days this week' : 'No active weekly plan'}
          body={
            isGangOwner
              ? weeklyPlan
                ? 'Your weekly plan has no exercises yet. Tap the edit icon next to the week range to add workout days.'
                : 'Create a weekly plan with daily goals for your gang.'
              : weeklyPlan
                ? 'No workout days are scheduled this week.'
                : "Your gang leader hasn't published a weekly plan yet."
          }
        />
      )}
    </View>
  );
}

function GangActivityTab({
  gangId,
  feed,
  isLoading,
}: {
  gangId: string;
  feed: ReturnType<typeof useGangFeed>['data'];
  isLoading: boolean;
}) {
  const t = useThemeTokens();

  if (isLoading) return <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />;
  if (!feed || feed.length === 0) {
    return (
      <EmptyCard
        title="No activity yet"
        body="Be the first to log a workout for the gang."
      />
    );
  }

  return (
    <View className="gap-3">
      {feed.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} gangId={gangId} />
      ))}
    </View>
  );
}

function GangLeaderboardTab({ gangId }: { gangId: string }) {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const { session } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const { data: board, isLoading } = useLeaderboard(gangId, period);
  const topTotal = board?.[0]?.total ?? 1;

  return (
    <View className="gap-3">
      <View
        className="flex-row rounded-xl p-1"
        style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}
      >
        {(['daily', 'weekly', 'all'] as LeaderboardPeriod[]).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: period === p ? t.accent : 'transparent' }}
          >
            <Text
              style={{ color: period === p ? t.accentOnPrimary : t.body }}
              className="text-xs font-semibold capitalize"
            >
              {p === 'all' ? 'All-time' : p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />
      ) : board && board.length > 0 ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          {board.map((row) => (
            <LeaderboardRow
              key={row.user_id}
              position={row.position}
              name={row.full_name}
              initials={initialsFromName(row.full_name)}
              reps={row.total}
              level={row.level}
              completion={topTotal > 0 ? row.total / topTotal : 0}
              isYou={row.user_id === session?.user.id}
            />
          ))}
        </View>
      ) : (
        <EmptyCard
          title="No leaderboard data yet"
          body="Log workouts for your gang to start climbing the ranks."
        />
      )}
    </View>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  const t = useThemeTokens();
  return (
    <GlassSurface style={{ padding: 18, gap: 6 }}>
      <Text
        style={{
          fontFamily: fontFamily.bodySemi,
          fontSize: 16,
          color: t.heading,
        }}
      >
        {title}
      </Text>
      <Text style={[type.bodySm, { color: t.body }]}>{body}</Text>
    </GlassSurface>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 3).toUpperCase();
}
