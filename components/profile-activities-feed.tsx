import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { activityDateLabel, formatAmount } from '@/lib/format';
import { fontFamily, type, useTheme } from '@/lib/gaingang-theme';
import type { ActivityWithExercises } from '@/types';

interface ProfileActivitiesFeedProps {
  activities: ActivityWithExercises[];
}

function groupByDate(activities: ActivityWithExercises[]): [string, ActivityWithExercises[]][] {
  const groups = new Map<string, ActivityWithExercises[]>();
  for (const activity of activities) {
    const iso = activity.activity_date ?? activity.created_at.slice(0, 10);
    const list = groups.get(iso);
    if (list) list.push(activity);
    else groups.set(iso, [activity]);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function accessibilityLabel(activity: ActivityWithExercises): string {
  const exercises = activity.exercises ?? [];
  if (exercises.length === 0) return 'Activity logged';
  return exercises
    .map((e) => `${formatAmount(e.amount, e.unit)} ${e.exercise_name}`)
    .join(', ');
}

export function ProfileActivitiesFeed({ activities }: ProfileActivitiesFeedProps) {
  const t = useThemeTokens();
  const grouped = useMemo(() => groupByDate(activities), [activities]);

  if (activities.length === 0) {
    return (
      <Text style={[type.bodySm, { color: t.body }]}>
        No activities logged yet. Tap the + on the Today tab to start.
      </Text>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      {grouped.map(([date, items]) => (
        <View key={date} style={{ gap: 10 }}>
          <Text style={[type.label, { color: t.heading }]}>
            {activityDateLabel(date)}
          </Text>

          <View style={{ gap: 10 }}>
            {items.map((activity) => (
              <ActivityLogCard key={activity.id} activity={activity} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function ActivityLogCard({ activity }: { activity: ActivityWithExercises }) {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const exercises = activity.exercises ?? [];
  const kudosCount = activity.kudos_count ?? 0;
  const commentCount = activity.comment_count ?? 0;
  const timeLabel = new Date(
    activity.updated_at ?? activity.created_at,
  ).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/activity/[id]',
          params: { id: activity.id },
        })
      }
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel(activity)}
    >
      <GlassSurface style={{ padding: 14, gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.isLight
                ? 'rgba(47,109,255,0.10)'
                : 'rgba(77,140,255,0.16)',
              borderWidth: 1,
              borderColor: t.isLight
                ? 'rgba(47,109,255,0.18)'
                : 'rgba(77,140,255,0.28)',
            }}
          >
            <Ionicons name="footsteps" size={20} color={t.accent} />
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                fontSize: 15,
                color: t.heading,
              }}
              numberOfLines={1}
            >
              Workout
            </Text>
            <Text style={[type.dataSm, { color: t.body }]}>
              {timeLabel}
              {exercises.length > 1 ? ` · ${exercises.length} exercises` : ''}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={t.placeholder} />
        </View>

        {exercises.length > 0 ? (
          <View
            style={{
              gap: 8,
              paddingLeft: 4,
              borderLeftWidth: 2,
              borderLeftColor: theme.colors.borderGlow,
              paddingVertical: 2,
            }}
          >
            {exercises.map((exercise) => (
              <View
                key={exercise.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 8,
                  paddingLeft: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.monoBold,
                    fontSize: 18,
                    color: t.accent,
                    minWidth: 64,
                  }}
                >
                  {formatAmount(exercise.amount, exercise.unit)}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fontFamily.bodySemi,
                    fontSize: 15,
                    color: t.heading,
                  }}
                  numberOfLines={1}
                >
                  {exercise.exercise_name}
                </Text>
                {exercise.sets ? (
                  <Text style={[type.dataSm, { color: t.body }]}>
                    {exercise.sets} sets
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={[type.bodySm, { color: t.body, paddingLeft: 4 }]}>
            Activity logged
          </Text>
        )}

        {activity.notes ? (
          <Text
            style={[type.bodySm, { color: t.body, lineHeight: 18 }]}
            numberOfLines={2}
          >
            {activity.notes}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            paddingTop: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flame-outline" size={18} color={t.body} />
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                fontSize: 13,
                color: t.body,
              }}
            >
              {kudosCount}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-outline" size={17} color={t.body} />
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                fontSize: 13,
                color: t.body,
              }}
            >
              {commentCount}
            </Text>
          </View>
        </View>
      </GlassSurface>
    </TouchableOpacity>
  );
}
