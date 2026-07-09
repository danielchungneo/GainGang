import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { ActivityCard } from '@/components/activity-card';
import { GangAddMenu } from '@/components/gang-add-menu';
import { GangGoalProgress } from '@/components/gang-goal-progress';
import { GangSelector } from '@/components/gang-selector';
import { WeeklyPlanAdminActions } from '@/components/weekly-plan-admin-actions';
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
import { todayISO } from '@/lib/format';
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
  const [selectedGangId, setSelectedGangId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [viewTab, setViewTab] = useState<GangViewTab>('progress');

  const { data: gangs, isLoading: gangsLoading, refetch: refetchGangs, isRefetching: gangsRefetching } =
    useMyGangs();

  const gangId = selectedGangId ?? gangs?.[0]?.id ?? '';
  const selectedGang = gangs?.find((g) => g.id === gangId);
  const isGangOwner = selectedGang?.role === 'owner';

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
    if (!selectedGangId || !gangs.some((g) => g.id === selectedGangId)) {
      setSelectedGangId(gangs[0].id);
    }
  }, [gangs, selectedGangId]);

  const onRefresh = useCallback(() => {
    refetchGangs();
    if (gangId) {
      refetchPlan();
      refetchFeed();
      queryClient.invalidateQueries({ queryKey: ['leaderboard', gangId] });
    }
  }, [refetchGangs, refetchPlan, refetchFeed, gangId, queryClient]);

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
        <View className="mt-4 flex-row items-center justify-between gap-3">
          {hasGangs && selectedGang ? (
            <GangSelector
              gangs={gangs}
              selectedId={gangId}
              onSelect={setSelectedGangId}
            />
          ) : (
            <Text style={[type.heading, { color: t.heading }]}>Gangs</Text>
          )}
          {hasGangs ? (
            <TouchableOpacity
              onPress={() => setAddMenuOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: t.accent }}
              accessibilityLabel="Add gang"
            >
              <Ionicons name="add" size={24} color={t.accentOnPrimary} />
            </TouchableOpacity>
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
              Create your own crew or join one with an invite code to start gaining together.
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
                Join a Gang
              </Text>
            </TouchableOpacity>
          </GlassSurface>
        )}
      </ScrollView>

      {hasGangs ? (
        <GangAddMenu visible={addMenuOpen} onClose={() => setAddMenuOpen(false)} />
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
  const { width: screenWidth } = useWindowDimensions();
  const carouselRef = useRef<ScrollView>(null);
  const today = todayISO();
  const cardGap = spacing.md;
  const cardWidth = screenWidth - spacing.lg * 2;

  const weekGoals = useMemo(() => {
    const goals = (weeklyPlan?.daily_goals ?? []).filter((g) => g.exercises.length > 0);
    return [...goals].sort((a, b) => a.goal_date.localeCompare(b.goal_date));
  }, [weeklyPlan?.daily_goals]);

  useEffect(() => {
    if (weekGoals.length === 0) return;
    const todayIndex = weekGoals.findIndex((g) => g.goal_date === today);
    if (todayIndex < 0) return;
    carouselRef.current?.scrollTo({ x: todayIndex * (cardWidth + cardGap), animated: false });
  }, [weekGoals, today, cardWidth, cardGap]);

  return (
    <View className="gap-3">
      {isGangOwner ? (
        <WeeklyPlanAdminActions
          gangId={gangId}
          planId={weeklyPlan?.id}
          hasActivePlan={!!weeklyPlan}
          helperText={
            weekGoals.length > 0
              ? undefined
              : weeklyPlan
                ? 'Today is a rest day, or this day has no exercises in your weekly plan.'
                : 'Publish a weekly plan so your crew knows what to hit each day.'
          }
        />
      ) : null}

      {weeklyPlan ? (
        <Text style={[type.bodySm, { color: t.body }]}>
          Week of{' '}
          {new Date(weeklyPlan.starts_on + 'T12:00:00').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
          {' – '}
          {new Date(weeklyPlan.ends_on + 'T12:00:00').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />
      ) : weekGoals.length > 0 ? (
        <ScrollView
          ref={carouselRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + cardGap}
          snapToAlignment="start"
          contentContainerStyle={{ gap: cardGap }}
        >
          {weekGoals.map((goal) => (
            <View key={goal.id} style={{ width: cardWidth }}>
              <GangGoalProgress goal={goal} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <EmptyCard
          title={weeklyPlan ? 'No workout days this week' : 'No active weekly plan'}
          body={
            isGangOwner
              ? weeklyPlan
                ? 'Your weekly plan has no exercises yet. Use Edit weekly plan above to add workout days.'
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
