import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { ProfileStreakCalendar } from '@/components/profile-streak-calendar';
import { ExerciseIcon, GlassSurface } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { useUserActivities } from '@/hooks/use-activities';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount, todayISO } from '@/lib/format';
import { fontFamily, status, type } from '@/lib/gaingang-theme';
import { computeWeeklyStreak } from '@/lib/streaks';
import {
  UNIT_LABELS,
  type ActivityWithExercises,
  type ExerciseUnit,
  type Profile,
} from '@/types';

type StatsSection = 'streak' | 'activities';

interface ExerciseTotal {
  key: string;
  name: string;
  amount: number;
  unit: ExerciseUnit;
}

interface ProfileStatsPanelProps {
  profile: Pick<Profile, 'current_streak' | 'longest_streak' | 'xp' | 'last_active_on'>;
  activities: ActivityWithExercises[];
  isOwnProfile: boolean;
}

function activityDateISO(activity: ActivityWithExercises): string {
  return activity.activity_date ?? activity.created_at.slice(0, 10);
}

function startOfMonthISO(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

function aggregateExerciseTotals(activities: ActivityWithExercises[]): ExerciseTotal[] {
  const totals = new Map<string, ExerciseTotal>();

  for (const activity of activities) {
    for (const exercise of activity.exercises ?? []) {
      const key = `${exercise.exercise_name}:${exercise.unit}`;
      const existing = totals.get(key);
      if (existing) {
        existing.amount += exercise.amount;
        continue;
      }
      totals.set(key, {
        key,
        name: exercise.exercise_name,
        amount: exercise.amount,
        unit: exercise.unit,
      });
    }
  }

  return [...totals.values()].sort((a, b) => b.amount - a.amount);
}

function countWorkoutsThisMonth(activities: ActivityWithExercises[], today: string): number {
  const monthStart = startOfMonthISO(today);
  return activities.filter((a) => {
    const iso = activityDateISO(a);
    return iso >= monthStart && iso <= today;
  }).length;
}

function totalRepsFromActivities(activities: ActivityWithExercises[]): number {
  let totalReps = 0;
  for (const activity of activities) {
    for (const exercise of activity.exercises ?? []) {
      if (exercise.unit === 'reps') totalReps += exercise.amount;
    }
  }
  return totalReps;
}

export function ProfileStatsPanel({
  profile,
  activities,
  isOwnProfile,
}: ProfileStatsPanelProps) {
  const t = useThemeTokens();
  const { session } = useAuth();
  const viewerId = session?.user.id;
  const [section, setSection] = useState<StatsSection>('streak');
  const today = todayISO();

  const { data: viewerActivities = [] } = useUserActivities(
    !isOwnProfile ? viewerId : undefined,
  );

  const streakStats = useMemo(() => {
    const dates = activities.map(activityDateISO);
    return {
      weeklyStreak: computeWeeklyStreak(dates),
    };
  }, [activities]);

  const activityStats = useMemo(
    () => ({
      total: activities.length,
      thisMonth: countWorkoutsThisMonth(activities, today),
      totalReps: totalRepsFromActivities(activities),
      exercises: aggregateExerciseTotals(activities),
    }),
    [activities, today],
  );

  const viewerExerciseMap = useMemo(() => {
    if (isOwnProfile) return null;
    const map = new Map<string, ExerciseTotal>();
    for (const row of aggregateExerciseTotals(viewerActivities)) {
      map.set(row.key, row);
    }
    return map;
  }, [isOwnProfile, viewerActivities]);

  const comparisonRows = useMemo(() => {
    if (!viewerExerciseMap) {
      return activityStats.exercises.map((row) => ({
        ...row,
        viewerAmount: null as number | null,
      }));
    }

    const keys = new Set([
      ...activityStats.exercises.map((e) => e.key),
      ...viewerExerciseMap.keys(),
    ]);

    return [...keys]
      .map((key) => {
        const theirs = activityStats.exercises.find((e) => e.key === key);
        const yours = viewerExerciseMap.get(key);
        const name = theirs?.name ?? yours?.name ?? 'Exercise';
        const unit = theirs?.unit ?? yours?.unit ?? 'reps';
        return {
          key,
          name,
          unit,
          amount: theirs?.amount ?? 0,
          viewerAmount: yours?.amount ?? 0,
        };
      })
      .sort((a, b) => Math.max(b.amount, b.viewerAmount) - Math.max(a.amount, a.viewerAmount));
  }, [activityStats.exercises, viewerExerciseMap]);

  const currentStreak = profile.current_streak ?? 0;
  const longestStreak = profile.longest_streak ?? 0;
  const isStreak = section === 'streak';

  return (
    <GlassSurface style={{ padding: 16, gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          padding: 4,
          borderRadius: 14,
          backgroundColor: `${t.heading}08`,
          borderWidth: 1,
          borderColor: `${t.heading}12`,
          gap: 4,
        }}
      >
        <OverviewSegment
          label="Streak"
          icon="flame"
          isActive={isStreak}
          activeColor={status.fire}
          onPress={() => setSection('streak')}
        />
        <OverviewSegment
          label="Activities"
          icon="footsteps"
          isActive={!isStreak}
          activeColor={t.accent}
          onPress={() => setSection('activities')}
        />
      </View>

      {isStreak ? (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 14 }}>
            <View className="flex-row items-end" style={{ gap: 10 }}>
              <Ionicons name="flame" size={28} color={status.fire} style={{ marginBottom: 6 }} />
              <Text
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 52,
                  lineHeight: 54,
                  color: t.heading,
                }}
              >
                {currentStreak}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 16,
                  color: status.fire,
                  marginBottom: 10,
                }}
              >
                day streak
              </Text>
            </View>

            <View className="flex-row" style={{ gap: 8 }}>
              <MetaChip label="Best" value={`${longestStreak}d`} />
              <MetaChip label="Week streak" value={`${streakStats.weeklyStreak}w`} />
            </View>
          </View>

          <View
            style={{
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: `${t.heading}12`,
            }}
          >
            <ProfileStreakCalendar activities={activities} embedded />
          </View>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 14 }}>
            <View className="flex-row items-end" style={{ gap: 10 }}>
              <Ionicons name="footsteps" size={26} color={t.accent} style={{ marginBottom: 8 }} />
              <Text
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 52,
                  lineHeight: 54,
                  color: t.heading,
                }}
              >
                {activityStats.total.toLocaleString()}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 16,
                  color: t.accent,
                  marginBottom: 10,
                }}
              >
                activities
              </Text>
            </View>

            <View className="flex-row" style={{ gap: 8 }}>
              <MetaChip label="This month" value={String(activityStats.thisMonth)} />
              <MetaChip
                label="Reps"
                value={
                  activityStats.totalReps > 0
                    ? activityStats.totalReps.toLocaleString()
                    : '—'
                }
              />
            </View>
          </View>

          <View
            style={{
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: `${t.heading}12`,
            }}
          >
            <ExerciseBreakdown
              exercises={activityStats.exercises}
              comparisonRows={comparisonRows}
              canCompare={!isOwnProfile}
            />
          </View>
        </View>
      )}
    </GlassSurface>
  );
}

function OverviewSegment({
  label,
  icon,
  isActive,
  activeColor,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  const t = useThemeTokens();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: isActive ? `${activeColor}22` : 'transparent',
      }}
    >
      <Ionicons name={icon} size={15} color={isActive ? activeColor : t.placeholder} />
      <Text
        style={{
          fontFamily: fontFamily.bodySemi,
          fontSize: 13,
          color: isActive ? t.heading : t.placeholder,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  const t = useThemeTokens();

  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: `${t.heading}07`,
        borderWidth: 1,
        borderColor: `${t.heading}10`,
        gap: 2,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 10,
          letterSpacing: 1.1,
          color: t.placeholder,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.displaySemi,
          fontSize: 18,
          color: t.heading,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ExerciseBreakdown({
  exercises,
  comparisonRows,
  canCompare,
}: {
  exercises: ExerciseTotal[];
  comparisonRows: {
    key: string;
    name: string;
    unit: ExerciseUnit;
    amount: number;
    viewerAmount: number | null;
  }[];
  canCompare: boolean;
}) {
  const t = useThemeTokens();
  const [isComparing, setIsComparing] = useState(false);

  if (exercises.length === 0) {
    return (
      <View style={{ paddingVertical: 8, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: fontFamily.displaySemi, fontSize: 18, color: t.heading }}>
          No exercises yet
        </Text>
        <Text style={[type.bodySm, { color: t.body, textAlign: 'center' }]}>
          Logged workouts will show up here with totals by movement.
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(
    1,
    ...comparisonRows.map((row) => Math.max(row.amount, row.viewerAmount ?? 0)),
  );

  return (
    <View style={{ gap: 16 }}>
      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 11,
            letterSpacing: 1.6,
            color: t.body,
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          By exercise
        </Text>

        {canCompare ? (
          <TouchableOpacity
            onPress={() => setIsComparing((prev) => !prev)}
            accessibilityRole="button"
            accessibilityState={{ selected: isComparing }}
            accessibilityLabel={isComparing ? 'Hide comparison' : 'Compare with your stats'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: isComparing ? t.accent : t.buttonBg,
              borderWidth: 1,
              borderColor: isComparing ? t.accent : t.buttonBorder,
            }}
          >
            <Ionicons
              name="git-compare-outline"
              size={14}
              color={isComparing ? t.accentOnPrimary : t.heading}
            />
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                fontSize: 12,
                color: isComparing ? t.accentOnPrimary : t.heading,
              }}
            >
              {isComparing ? 'Comparing' : 'Compare'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isComparing && canCompare ? (
        <>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <LegendDot color={t.accent} label="Them" />
            <LegendDot color={status.fire} label="You" />
          </View>

          <View style={{ gap: 16 }}>
            {comparisonRows.map((row) => {
              const theirRatio = row.amount / maxValue;
              const yourRatio = (row.viewerAmount ?? 0) / maxValue;

              return (
                <View key={row.key} style={{ gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 15,
                      color: t.heading,
                    }}
                    numberOfLines={1}
                  >
                    {row.name}
                  </Text>

                  <View style={{ gap: 6 }}>
                    <CompareBar
                      ratio={theirRatio}
                      color={t.accent}
                      label={formatAmount(row.amount, row.unit)}
                    />
                    <CompareBar
                      ratio={yourRatio}
                      color={status.fire}
                      label={formatAmount(row.viewerAmount ?? 0, row.unit)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginHorizontal: -6,
          }}
        >
          {exercises.map((exercise) => {
            const display = formatExerciseStat(exercise.amount, exercise.unit);

            return (
              <View
                key={exercise.key}
                style={{
                  width: '50%',
                  paddingHorizontal: 6,
                  paddingVertical: 6,
                }}
              >
                <View
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    backgroundColor: `${t.heading}07`,
                    borderWidth: 1,
                    borderColor: `${t.heading}10`,
                    gap: 8,
                    minHeight: 96,
                    justifyContent: 'space-between',
                  }}
                >
                  <View className="flex-row items-start gap-2">
                    <ExerciseIcon exerciseName={exercise.name} size={24} />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: fontFamily.bodySemi,
                        fontSize: 12,
                        letterSpacing: 0.2,
                        color: t.placeholder,
                        textTransform: 'uppercase',
                      }}
                      numberOfLines={2}
                    >
                      {exercise.name}
                    </Text>
                  </View>
                  <View className="flex-row items-baseline" style={{ gap: 5, flexWrap: 'wrap' }}>
                    <Text
                      style={{
                        fontFamily: fontFamily.displaySemi,
                        fontSize: 26,
                        lineHeight: 30,
                        color: t.heading,
                      }}
                    >
                      {display.value}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fontFamily.bodySemi,
                        fontSize: 12,
                        color: t.accent,
                        paddingBottom: 2,
                      }}
                    >
                      {display.unit}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function formatExerciseStat(
  amount: number,
  unit: ExerciseUnit,
): { value: string; unit: string } {
  if (unit === 'seconds') {
    if (amount >= 60) {
      const m = Math.floor(amount / 60);
      const s = amount % 60;
      return {
        value: s ? `${m}:${String(s).padStart(2, '0')}` : `${m}:00`,
        unit: s || m > 0 ? 'min' : 'sec',
      };
    }
    return { value: String(amount), unit: 'sec' };
  }

  if (unit === 'miles') {
    const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
    return { value: formatted, unit: UNIT_LABELS.miles.short };
  }

  return {
    value: amount.toLocaleString(),
    unit: UNIT_LABELS[unit].short,
  };
}

function CompareBar({
  ratio,
  color,
  label,
}: {
  ratio: number;
  color: string;
  label: string;
}) {
  const t = useThemeTokens();
  const widthPct = `${Math.max(ratio > 0 ? 6 : 0, Math.round(ratio * 100))}%` as const;

  return (
    <View className="flex-row items-center" style={{ gap: 10 }}>
      <View
        style={{
          flex: 1,
          height: 10,
          borderRadius: 999,
          backgroundColor: `${t.heading}12`,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: widthPct,
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      </View>
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 12,
          color: t.body,
          minWidth: 72,
          textAlign: 'right',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const t = useThemeTokens();

  return (
    <View className="flex-row items-center" style={{ gap: 5 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={[type.dataSm, { color: t.body }]}>{label}</Text>
    </View>
  );
}
