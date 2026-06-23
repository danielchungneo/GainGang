import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { isoTimestampToLocalDate, monthYearLabel, todayISO } from '@/lib/format';
import { fontFamily, status, type } from '@/lib/gaingang-theme';
import { useTheme } from '@/lib/gaingang-theme';
import type { Activity } from '@/types';

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const STREAK_COL_WIDTH = 36;
const ROW_HEIGHT = 40;
const DAY_HEADER_HEIGHT = 24;

interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

interface ProfileStreakCalendarProps {
  activities: Activity[];
  currentStreak: number;
}

function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const mondayOffset = startDow === 0 ? 6 : startDow - 1;

  const totalCells = mondayOffset + daysInMonth;
  const numWeeks = Math.ceil(totalCells / 7);
  const gridStart = new Date(year, month, 1 - mondayOffset);

  const days: CalendarDay[] = [];
  for (let i = 0; i < numWeeks * 7; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const tz = d.getTimezoneOffset() * 60000;
    const iso = new Date(d.getTime() - tz).toISOString().slice(0, 10);
    days.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return days;
}

function countActivitiesByDate(activities: Activity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const activity of activities) {
    const iso = isoTimestampToLocalDate(activity.created_at);
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }
  return counts;
}

export function ProfileStreakCalendar({
  activities,
  currentStreak,
}: ProfileStreakCalendarProps) {
  const t = useThemeTokens();
  const { theme } = useTheme();

  const today = todayISO();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const activityCounts = useMemo(
    () => countActivitiesByDate(activities),
    [activities],
  );

  const activeDates = useMemo(
    () => new Set(activityCounts.keys()),
    [activityCounts],
  );

  const monthGrid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const streakActivitiesInMonth = [...activeDates].filter((d) =>
    d.startsWith(monthPrefix),
  ).length;

  const weekRows = useMemo(() => {
    const rows: CalendarDay[][] = [];
    for (let i = 0; i < monthGrid.length; i += 7) {
      const row = monthGrid.slice(i, i + 7);
      if (row.some((d) => d.inMonth)) rows.push(row);
    }
    return rows;
  }, [monthGrid]);

  const completedWeekRows = useMemo(
    () =>
      weekRows.map((row) =>
        row.some((d) => activeDates.has(d.iso)),
      ),
    [weekRows, activeDates],
  );

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const inactiveBg = theme.colors.surface3;
  const streakBarBg = 'rgba(245,165,36,0.18)';
  const cellSize = ROW_HEIGHT - 8;

  return (
    <GlassSurface style={{ padding: 16, gap: 16 }}>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={t.heading} />
        </TouchableOpacity>

        <Text
          style={[
            {
              fontFamily: fontFamily.displaySemi,
              fontSize: 22,
              color: t.heading,
            },
          ]}
        >
          {monthYearLabel(viewYear, viewMonth)}
        </Text>

        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color={t.heading} />
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-6">
        <View style={{ gap: 2 }}>
          <Text style={[type.labelSm, { color: t.body }]}>Your streak</Text>
          <Text style={[type.data, { color: t.heading }]}>
            {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}
          </Text>
        </View>

        <View style={{ gap: 2 }}>
          <Text style={[type.labelSm, { color: t.body }]}>Streak activities</Text>
          <Text style={[type.data, { color: t.heading }]}>
            {streakActivitiesInMonth}
          </Text>
        </View>
      </View>

      <View className="flex-row">
        <View style={{ flex: 1 }}>
          <View
            className="flex-row"
            style={{ height: DAY_HEADER_HEIGHT, marginBottom: 4 }}
          >
            {DAY_HEADERS.map((label, i) => (
              <View key={`${label}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[type.dataSm, { color: t.body }]}>{label}</Text>
              </View>
            ))}
          </View>

          {weekRows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              className="flex-row"
              style={{ height: ROW_HEIGHT }}
            >
              {row.map((day) => {
                const hasActivity = activeDates.has(day.iso);
                const count = activityCounts.get(day.iso) ?? 0;
                const isSelected = selectedDate === day.iso;
                const isToday = day.iso === today;

                return (
                  <TouchableOpacity
                    key={day.iso}
                    onPress={() => setSelectedDate(day.iso)}
                    style={{
                      flex: 1,
                      height: ROW_HEIGHT,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.day}${hasActivity ? ', activity logged' : ''}`}
                  >
                    <View
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: cellSize / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: hasActivity ? '#FFFFFF' : inactiveBg,
                        borderWidth: isSelected || isToday ? 2 : 0,
                        borderColor: isSelected
                          ? t.heading
                          : isToday
                            ? 'rgba(255,255,255,0.5)'
                            : 'transparent',
                        opacity: day.inMonth ? 1 : 0.35,
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

                      {count > 1 ? (
                        <View
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#FFFFFF',
                          }}
                        />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View
          style={{
            width: STREAK_COL_WIDTH,
            marginLeft: 8,
            position: 'relative',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: DAY_HEADER_HEIGHT + 4,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: STREAK_COL_WIDTH / 2,
              backgroundColor: streakBarBg,
            }}
          />

          <View style={{ height: DAY_HEADER_HEIGHT + 4 }} />

          {weekRows.map((_, rowIndex) => {
            const completed = completedWeekRows[rowIndex];

            return (
              <View
                key={rowIndex}
                style={{
                  height: ROW_HEIGHT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: completed ? status.fire : 'transparent',
                    borderWidth: completed ? 0 : 1,
                    borderColor: 'rgba(245,165,36,0.35)',
                  }}
                >
                  {completed ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </View>
            );
          })}

          <View
            style={{
              height: ROW_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: status.fire,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamily.monoBold,
                  fontSize: 13,
                  color: '#FFFFFF',
                }}
              >
                {currentStreak > 99 ? '99+' : currentStreak}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </GlassSurface>
  );
}
