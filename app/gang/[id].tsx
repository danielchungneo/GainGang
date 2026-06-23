import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { DailyGoalCard } from '@/components/daily-goal-card';
import { Avatar, GlassSurface, LeaderboardRow, LevelBadge, ScreenBackground, StreakPill } from '@/components/ui';
import { levelFromXp } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/lib/gaingang-theme';
import { useGangFeed } from '@/hooks/use-activities';
import { useGang, useGangMembers } from '@/hooks/use-gangs';
import { useLeaderboard, type LeaderboardPeriod } from '@/hooks/use-leaderboard';
import { useActiveWeeklyPlan } from '@/hooks/use-weekly-plans';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { todayISO } from '@/lib/format';

type Tab = 'goals' | 'feed' | 'board' | 'members';
const TABS: { key: Tab; label: string }[] = [
  { key: 'goals', label: 'Goals' },
  { key: 'feed', label: 'Feed' },
  { key: 'board', label: 'Board' },
  { key: 'members', label: 'Crew' },
];

export default function GangDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gangId = id!;
  const t = useThemeTokens();
  const [tab, setTab] = useState<Tab>('goals');

  const { data: gang, isLoading, refetch, isRefetching } = useGang(gangId);
  const isAdmin = gang?.role === 'owner' || gang?.role === 'admin';
  const isOwner = gang?.role === 'owner';

  return (
    <ScreenView refreshing={isRefetching} onRefresh={refetch} accent={t.accent}>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={t.body} />
        </TouchableOpacity>
        <Text style={{ color: t.heading }} className="flex-1 text-2xl font-bold" numberOfLines={1}>
          {gang?.name ?? 'Gang'}
        </Text>
        {isOwner ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/gang/edit', params: { gangId } })}
            accessibilityLabel="Edit gang"
            hitSlop={8}>
            <Ionicons name="settings-outline" size={24} color={t.body} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading || !gang ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          <GlassSurface style={{ padding: 18, gap: 12 }}>
            <View className="flex-row items-center gap-3">
              <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: t.accent }}>
                <Text style={{ fontSize: 26 }}>{gang.icon ?? '⚔️'}</Text>
              </View>
              <View className="flex-1">
                <Text style={{ color: t.heading }} className="text-xl font-bold">
                  {gang.name}
                </Text>
                <Text style={{ color: t.body }} className="text-sm">
                  {gang.member_count} members
                </Text>
              </View>
            </View>
            {(gang.current_streak ?? 0) > 0 ? <StreakPill days={gang.current_streak} /> : null}
            {gang.description ? (
              <Text style={{ color: t.body }} className="text-sm leading-5">
                {gang.description}
              </Text>
            ) : null}
            <View
              className="flex-row items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}>
              <View>
                <Text style={{ color: t.body }} className="text-xs uppercase tracking-wide">
                  Invite code
                </Text>
                <Text style={{ color: t.heading }} className="text-lg font-bold tracking-widest">
                  {gang.invite_code}
                </Text>
              </View>
              <Ionicons name="key" size={22} color={t.accent} />
            </View>
          </GlassSurface>

          {/* segmented control */}
          <View
            className="flex-row rounded-xl p-1"
            style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}>
            {TABS.map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setTab(item.key)}
                className="flex-1 items-center rounded-lg py-2"
                style={{ backgroundColor: tab === item.key ? t.accent : 'transparent' }}>
                <Text
                  style={{ color: tab === item.key ? t.accentOnPrimary : t.body }}
                  className="text-sm font-semibold">
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'goals' && <GoalsTab gangId={gangId} isAdmin={isAdmin} />}
          {tab === 'feed' && <FeedTab gangId={gangId} />}
          {tab === 'board' && <BoardTab gangId={gangId} />}
          {tab === 'members' && <MembersTab gangId={gangId} />}
        </>
      )}
    </ScreenView>
  );
}

function GoalsTab({ gangId, isAdmin }: { gangId: string; isAdmin: boolean }) {
  const t = useThemeTokens();
  const { width: screenWidth } = useWindowDimensions();
  const carouselRef = useRef<ScrollView>(null);
  const { data: plan, isLoading } = useActiveWeeklyPlan(gangId);
  const today = todayISO();
  const weekGoals = useMemo(() => {
    const goals = (plan?.daily_goals ?? []).filter((g) => g.exercises.length > 0);
    return [...goals].sort((a, b) => a.goal_date.localeCompare(b.goal_date));
  }, [plan?.daily_goals]);
  const cardGap = 12;
  const cardWidth = screenWidth - 40 - 16;

  useEffect(() => {
    if (weekGoals.length === 0) return;
    const todayIndex = weekGoals.findIndex((g) => g.goal_date === today);
    if (todayIndex < 0) return;
    carouselRef.current?.scrollTo({ x: todayIndex * (cardWidth + cardGap), animated: false });
  }, [weekGoals, today, cardWidth, cardGap]);

  return (
    <View className="gap-3">
      {isAdmin ? (
        <View className="gap-2">
          {plan ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/gang/new-goal',
                  params: { gangId, planId: plan.id },
                })
              }
              className="flex-row items-center justify-center gap-2 rounded-xl py-3"
              style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}>
              <Ionicons name="create-outline" size={18} color={t.accent} />
              <Text style={{ color: t.accent }} className="font-semibold">
                Edit weekly plan
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/gang/new-goal', params: { gangId } })}
            className="flex-row items-center justify-center gap-2 rounded-xl py-3"
            style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}>
            <Ionicons name="add-circle-outline" size={18} color={t.accent} />
            <Text style={{ color: t.accent }} className="font-semibold">
              {plan ? 'Replace with new plan' : 'Create weekly plan'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {plan ? (
        <Text style={{ color: t.body }} className="text-sm">
          Week of{' '}
          {new Date(plan.starts_on + 'T12:00:00').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
          {' – '}
          {new Date(plan.ends_on + 'T12:00:00').toLocaleDateString(undefined, {
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
          contentContainerStyle={{ gap: cardGap }}>
          {weekGoals.map((g) => (
            <View key={g.id} style={{ width: cardWidth }}>
              <DailyGoalCard goal={g} loggable={g.goal_date === today} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <EmptyCard
          title="No active weekly plan"
          body={
            isAdmin
              ? 'Create a weekly plan with daily goals for your Gang.'
              : 'Your Gang leader hasn’t published a weekly plan yet.'
          }
        />
      )}
    </View>
  );
}

function FeedTab({ gangId }: { gangId: string }) {
  const t = useThemeTokens();
  const { data: feed, isLoading } = useGangFeed(gangId);

  if (isLoading) return <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />;
  if (!feed || feed.length === 0)
    return <EmptyCard title="No activity yet" body="Be the first to log a workout for the Gang." />;

  return (
    <View className="gap-3">
      {feed.map((a) => (
        <ActivityCard key={a.id} activity={a} gangId={gangId} />
      ))}
    </View>
  );
}

function BoardTab({ gangId }: { gangId: string }) {
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
        style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}>
        {(['daily', 'weekly', 'all'] as LeaderboardPeriod[]).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: period === p ? t.accent : 'transparent' }}>
            <Text style={{ color: period === p ? t.accentOnPrimary : t.body }} className="text-xs font-semibold capitalize">
              {p === 'all' ? 'All-time' : p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />
      ) : (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
          {(board ?? []).map((row) => (
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
      )}
    </View>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

function MembersTab({ gangId }: { gangId: string }) {
  const t = useThemeTokens();
  const { data: members, isLoading } = useGangMembers(gangId);

  if (isLoading) return <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />;

  return (
    <View className="gap-3">
      <GlassSurface style={{ padding: 8 }}>
        {(members ?? []).map((m) => (
          <View key={m.user_id} className="flex-row items-center gap-3 px-2 py-2.5">
            <Avatar name={m.profile?.full_name ?? 'Member'} uri={m.profile?.avatar_url} size={38} />
            <View className="flex-1">
              <Text style={{ color: t.heading }} className="font-semibold" numberOfLines={1}>
                {m.profile?.full_name ?? 'Member'}
              </Text>
              <Text style={{ color: t.body }} className="text-xs capitalize">
                {m.role}
              </Text>
            </View>
            {m.profile?.xp != null ? (
              <LevelBadge level={levelFromXp(m.profile.xp)} size={22} />
            ) : null}
          </View>
        ))}
      </GlassSurface>
    </View>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  const t = useThemeTokens();
  return (
    <GlassSurface style={{ padding: 20, gap: 6 }}>
      <Text style={{ color: t.heading }} className="text-base font-bold">
        {title}
      </Text>
      <Text style={{ color: t.body }} className="text-sm leading-5">
        {body}
      </Text>
    </GlassSurface>
  );
}

function ScreenView({
  children,
  refreshing,
  onRefresh,
  accent,
}: {
  children: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  accent: string;
}) {
  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}>
        {children}
      </ScrollView>
    </ScreenBackground>
  );
}
