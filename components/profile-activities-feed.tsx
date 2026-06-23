import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { activityDateLabel, formatAmount, isoTimestampToLocalDate } from '@/lib/format';
import { fontFamily, type } from '@/lib/gaingang-theme';
import type { Activity } from '@/types';

interface ProfileActivitiesFeedProps {
  activities: Activity[];
}

function groupByDate(activities: Activity[]): [string, Activity[]][] {
  const groups = new Map<string, Activity[]>();
  for (const activity of activities) {
    const iso = isoTimestampToLocalDate(activity.created_at);
    const list = groups.get(iso);
    if (list) list.push(activity);
    else groups.set(iso, [activity]);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
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
                className="flex-row items-center justify-between px-2 py-2.5"
                style={
                  index < items.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: t.buttonBorder }
                    : undefined
                }
                accessibilityRole="button"
                accessibilityLabel={`${activity.exercise_name}, ${formatAmount(activity.amount, activity.unit)}`}
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
                    {activity.exercise_name}
                  </Text>

                  <Text style={[type.dataSm, { color: t.body }]}>
                    {new Date(activity.created_at).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <Text style={[type.data, { color: t.accent }]}>
                  {formatAmount(activity.amount, activity.unit)}
                </Text>
              </TouchableOpacity>
            ))}
          </GlassSurface>
        </View>
      ))}
    </View>
  );
}
