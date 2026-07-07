import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { GangAddMenu } from '@/components/gang-add-menu';
import { GangGoalProgress } from '@/components/gang-goal-progress';
import { GangSelector } from '@/components/gang-selector';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useGangFeed } from '@/hooks/use-activities';
import { useMyGangs } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useGangTodaysDailyGoal } from '@/hooks/use-weekly-plans';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

export default function GroupsScreen() {
  const t = useThemeTokens();
  const [selectedGangId, setSelectedGangId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const { data: gangs, isLoading: gangsLoading, refetch: refetchGangs, isRefetching: gangsRefetching } =
    useMyGangs();

  const gangId = selectedGangId ?? gangs?.[0]?.id ?? '';

  const {
    data: dailyGoal,
    isLoading: goalLoading,
    refetch: refetchGoal,
    isRefetching: goalRefetching,
  } = useGangTodaysDailyGoal(gangId);

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
      refetchGoal();
      refetchFeed();
    }
  }, [refetchGangs, refetchGoal, refetchFeed, gangId]);

  const isRefetching = gangsRefetching || goalRefetching || feedRefetching;
  const hasGangs = !!gangs && gangs.length > 0;

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={t.accent} />
        }
      >
        <View className="mt-4 flex-row items-center justify-between">
          <Text style={[type.heading, { color: t.heading }]}>Gangs</Text>
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
          <>
            <GangSelector
              gangs={gangs}
              selectedId={gangId}
              onSelect={setSelectedGangId}
            />

            {goalLoading ? (
              <ActivityIndicator color={t.accent} style={{ marginTop: 12 }} />
            ) : dailyGoal ? (
              <GangGoalProgress goal={dailyGoal} />
            ) : (
              <GlassSurface style={{ padding: 18, gap: 6 }}>
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemi,
                    fontSize: 16,
                    color: t.heading,
                  }}
                >
                  No gang goal today
                </Text>
                <Text style={[type.bodySm, { color: t.body }]}>
                  Your gang leader hasn&apos;t published a weekly plan yet, or today is a rest day.
                </Text>
              </GlassSurface>
            )}

            <View className="gap-3">
              <Text style={[type.label, { color: t.body }]}>Activity</Text>

              {feedLoading ? (
                <ActivityIndicator color={t.accent} />
              ) : feed && feed.length > 0 ? (
                feed.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} gangId={gangId} />
                ))
              ) : (
                <GlassSurface style={{ padding: 18, gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 16,
                      color: t.heading,
                    }}
                  >
                    No activity yet
                  </Text>
                  <Text style={[type.bodySm, { color: t.body }]}>
                    Be the first to log a workout for the gang.
                  </Text>
                </GlassSurface>
              )}
            </View>
          </>
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
