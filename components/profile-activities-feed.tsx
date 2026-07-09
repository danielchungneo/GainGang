import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { activityDateLabel, formatAmount } from '@/lib/format';
import { fontFamily, type } from '@/lib/gaingang-theme';
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

function formatExerciseSummary(activity: ActivityWithExercises): string {
  const exercises = activity.exercises ?? [];
  if (exercises.length === 0) return 'Activity logged';
  return exercises
    .map((e) => `${formatAmount(e.amount, e.unit)} ${e.exercise_name}`)
    .join(' · ');
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
    <View style={{ gap: 16 }}>
      {grouped.map(([date, items]) => (
        <View key={date} style={{ gap: 8 }}>
          <Text style={[type.label, { color: t.heading }]}>
            {activityDateLabel(date)}
          </Text>

          <GlassSurface style={{ padding: 8 }}>
            {items.map((activity, index) => (
              <TouchableOpacity
                key={activity.id}
                onPress={() =>
                  router.push({
                    pathname: '/activity/[id]',
                    params: { id: activity.id },
                  })
                }
                className="px-2 py-2.5"
                style={
                  index < items.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: t.buttonBorder }
                    : undefined
                }
                accessibilityRole="button"
                accessibilityLabel={formatExerciseSummary(activity)}
              >
                <Text
                  style={[
                    {
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 15,
                      color: t.heading,
                    },
                  ]}
                >
                  {formatExerciseSummary(activity)}
                </Text>

                <Text style={[type.dataSm, { color: t.body, marginTop: 4 }]}>
                  {new Date(activity.updated_at ?? activity.created_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {(activity.exercises?.length ?? 0) > 1
                    ? ` · ${activity.exercises.length} exercises`
                    : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </GlassSurface>
        </View>
      ))}
    </View>
  );
}
