import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { activityDateLabel, formatAmount, monthYearLabel, todayISO } from '@/lib/format';
import { fontFamily, status, type } from '@/lib/gaingang-theme';
import { useTheme } from '@/lib/gaingang-theme';
import { normalizeExerciseName } from '@/lib/rep-counting/exercise-registry';
import { computeWeeklyStreak } from '@/lib/streaks';
import type { ActivityWithExercises, ExerciseUnit } from '@/types';

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const STREAK_COL_WIDTH = 42;
const ROW_HEIGHT = 40;
const DAY_HEADER_HEIGHT = 24;

interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

interface DayExerciseRow {
  id: string;
  exercise_name: string;
  amount: number;
  unit: ExerciseUnit;
}

interface ProfileStreakCalendarProps {
  activities: ActivityWithExercises[];
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

function activityDateISO(activity: ActivityWithExercises): string {
  return activity.activity_date ?? activity.created_at.slice(0, 10);
}

function groupActivitiesByDate(
  activities: ActivityWithExercises[],
): Map<string, ActivityWithExercises[]> {
  const groups = new Map<string, ActivityWithExercises[]>();
  for (const activity of activities) {
    const iso = activityDateISO(activity);
    const list = groups.get(iso);
    if (list) list.push(activity);
    else groups.set(iso, [activity]);
  }
  return groups;
}

function consolidatedExercisesForDay(
  activities: ActivityWithExercises[],
): DayExerciseRow[] {
  const exercisesByMovement = new Map<string, DayExerciseRow>();

  for (const activity of activities) {
    for (const exercise of activity.exercises ?? []) {
      const movement = exercise.exercise_id ?? normalizeExerciseName(exercise.exercise_name);
      const key = `${movement}:${exercise.unit}`;
      const existing = exercisesByMovement.get(key);
      if (existing) {
        existing.amount = Math.max(existing.amount, exercise.amount);
        continue;
      }

      exercisesByMovement.set(key, {
        id: exercise.id,
        exercise_name: exercise.exercise_name,
        amount: exercise.amount,
        unit: exercise.unit,
      });
    }
  }

  return Array.from(exercisesByMovement.values());
}

export function ProfileStreakCalendar({
  activities,
}: ProfileStreakCalendarProps) {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = Math.round(windowHeight * 0.72);

  const today = todayISO();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const activitiesByDate = useMemo(
    () => groupActivitiesByDate(activities),
    [activities],
  );

  const activeDates = useMemo(
    () => new Set(activitiesByDate.keys()),
    [activitiesByDate],
  );

  const weeklyStreak = useMemo(
    () => computeWeeklyStreak(activities.map(activityDateISO)),
    [activities],
  );

  const monthGrid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

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

  const detailActivities = detailDate
    ? (activitiesByDate.get(detailDate) ?? [])
    : [];
  const detailExercises = consolidatedExercisesForDay(detailActivities);

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function handleDayPress(day: CalendarDay) {
    setSelectedDate(day.iso);
    if (activeDates.has(day.iso)) setDetailDate(day.iso);
  }

  function closeDayDetail() {
    setDetailDate(null);
  }

  const inactiveBg = theme.colors.surface3;
  const streakBarBg = 'rgba(245,165,36,0.18)';
  const cellSize = ROW_HEIGHT - 8;

  return (
    <>
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
            style={{
              fontFamily: fontFamily.displaySemi,
              fontSize: 22,
              color: t.heading,
            }}
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
                  const isSelected = selectedDate === day.iso;
                  const isToday = day.iso === today;

                  return (
                    <TouchableOpacity
                      key={day.iso}
                      onPress={() => handleDayPress(day)}
                      style={{
                        flex: 1,
                        height: ROW_HEIGHT,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${day.day}${hasActivity ? ', activity logged, tap to view' : ''}`}
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
                flexDirection: 'row',
                gap: 2,
              }}
              accessibilityLabel={`Weekly streak: ${weeklyStreak} ${weeklyStreak === 1 ? 'week' : 'weeks'}`}
            >
              <Ionicons name="flame" size={14} color={status.fire} />
              <Text
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 13,
                  lineHeight: 15,
                  color: status.fire,
                }}
              >
                {weeklyStreak > 99 ? '99+' : weeklyStreak}
              </Text>
            </View>
          </View>
        </View>
      </GlassSurface>

      <Modal
        visible={detailDate != null}
        transparent
        animationType="fade"
        onRequestClose={closeDayDetail}
      >
        <Pressable
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
          onPress={closeDayDetail}
        >
          <View
            onStartShouldSetResponder={() => true}
            style={{
              backgroundColor: t.buttonBg,
              borderTopWidth: 1,
              borderColor: t.buttonBorder,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            }}
          >
            <ScrollView
              bounces
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              style={{
                maxHeight:
                  sheetMaxHeight - (Math.max(insets.bottom, 12) + 28),
              }}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <Text
                style={{
                  color: t.heading,
                  fontFamily: fontFamily.displaySemi,
                  fontSize: 18,
                  marginBottom: 4,
                }}
              >
                {detailDate ? activityDateLabel(detailDate) : ''}
              </Text>
              <Text style={[type.bodySm, { color: t.body, marginBottom: 12 }]}>
                {detailExercises.length === 1
                  ? '1 exercise'
                  : `${detailExercises.length} exercises`}
              </Text>

              {detailExercises.length === 0 ? (
                <Text style={[type.bodySm, { color: t.body }]}>
                  No exercises logged for this day.
                </Text>
              ) : (
                detailExercises.map((exercise, index) => (
                  <View
                    key={exercise.id}
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                      },
                      index < detailExercises.length - 1
                        ? {
                            borderBottomWidth: 1,
                            borderBottomColor: t.buttonBorder,
                          }
                        : null,
                    ]}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: fontFamily.bodySemi,
                        fontSize: 15,
                        color: t.heading,
                        marginRight: 12,
                      }}
                      numberOfLines={2}
                    >
                      {exercise.exercise_name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fontFamily.monoBold,
                        fontSize: 15,
                        color: t.heading,
                      }}
                    >
                      {formatAmount(exercise.amount, exercise.unit)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
