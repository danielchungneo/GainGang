import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { todayISO } from '@/lib/format';
import { fontFamily, spacing, status, type, useTheme } from '@/lib/gaingang-theme';
import { addDaysISO, mondayOfWeek, type ActivityWithExercises } from '@/types';

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_SIZE = 34;

interface FeedStreakHeaderProps {
  activities: ActivityWithExercises[];
  streakDays: number;
}

function activityDateISO(activity: ActivityWithExercises): string {
  return activity.activity_date ?? activity.created_at.slice(0, 10);
}

export function FeedStreakHeader({ activities, streakDays }: FeedStreakHeaderProps) {
  const t = useThemeTokens();
  const { theme } = useTheme();

  const today = todayISO();
  const weekStart = mondayOfWeek();
  const weekDays = useMemo(
    () =>
      DAY_HEADERS.map((label, index) => {
        const iso = addDaysISO(weekStart, index);
        return {
          label,
          iso,
          day: Number(iso.slice(8, 10)),
        };
      }),
    [weekStart],
  );

  const activeDates = useMemo(() => {
    const dates = new Set<string>();
    for (const activity of activities) {
      dates.add(activityDateISO(activity));
    }
    return dates;
  }, [activities]);

  const inactiveBg = theme.colors.surface3;

  return (
    <View style={{ marginTop: spacing.md, marginBottom: spacing.md, gap: spacing.md }}>
      <Text
        style={{
          fontFamily: fontFamily.displaySemi,
          fontSize: 22,
          color: t.heading,
        }}
      >
        Your streak
      </Text>

      <View className="flex-row items-center" style={{ gap: spacing.md }}>
        <View
          className="flex-row items-center"
          style={{ gap: 8 }}
          accessibilityRole="text"
          accessibilityLabel={`${streakDays} day streak`}
        >
          <Ionicons name="flame" size={40} color={status.fire} />
          <View>
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: 32,
                lineHeight: 34,
                color: t.heading,
              }}
            >
              {streakDays}
            </Text>
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                fontSize: 13,
                color: status.fire,
                marginTop: -2,
              }}
            >
              Days
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View className="flex-row" style={{ marginBottom: 6 }}>
            {weekDays.map((day, index) => (
              <View
                key={`${day.label}-${index}`}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <Text style={[type.dataSm, { color: t.body }]}>{day.label}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row items-center">
            {weekDays.map((day) => {
              const hasActivity = activeDates.has(day.iso);
              const isToday = day.iso === today;

              return (
                <View
                  key={day.iso}
                  style={{ flex: 1, alignItems: 'center' }}
                  accessibilityLabel={`${day.label}${hasActivity ? ', activity logged' : ''}`}
                >
                  <View
                    style={{
                      width: DAY_SIZE,
                      height: DAY_SIZE,
                      borderRadius: DAY_SIZE / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: hasActivity ? '#FFFFFF' : inactiveBg,
                      borderWidth: isToday && !hasActivity ? 1.5 : 0,
                      borderColor: 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {hasActivity ? (
                      <Ionicons name="footsteps" size={16} color="#05070F" />
                    ) : (
                      <Text
                        style={{
                          fontFamily: fontFamily.mono,
                          fontSize: 13,
                          color: t.heading,
                        }}
                      >
                        {day.day}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
