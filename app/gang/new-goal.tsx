import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface, KeyboardAwareScrollView, ScreenBackground } from '@/components/ui';
import { useExercises } from '@/hooks/use-exercises';
import { useGang } from '@/hooks/use-gangs';
import {
  buildDaysPayload,
  useCreateWeeklyPlan,
  useUpdateWeeklyPlan,
  useWeeklyPlan,
} from '@/hooks/use-weekly-plans';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmountInputValue, parseActivityAmount, sanitizeAmountInput } from '@/lib/activity-amount';
import { formatAmount, formatGoalDate, goalDateForWeekDay } from '@/lib/format';
import {
  CATEGORY_LABELS,
  WEEK_DAYS,
  WEEKLY_SCHEDULE,
  mondayOfWeek,
  type ExerciseCategory,
  type ExerciseUnit,
  type WeeklyPlanWithGoals,
} from '@/types';

interface DayExerciseDraft {
  exerciseId: string;
  name: string;
  unit: ExerciseUnit;
  individualTarget: string;
}

interface DayDraft {
  category: ExerciseCategory;
  exercises: DayExerciseDraft[];
}

function buildInitialDays(): Record<number, DayDraft> {
  const days: Record<number, DayDraft> = {};
  for (const wd of WEEK_DAYS) {
    days[wd.dayOfWeek] = {
      category: wd.defaultCategory,
      exercises: [],
    };
  }
  return days;
}

function buildDaysFromPlan(plan: WeeklyPlanWithGoals): Record<number, DayDraft> {
  const days = buildInitialDays();
  for (const goal of plan.daily_goals) {
    days[goal.day_of_week] = {
      category: goal.day_category ?? days[goal.day_of_week].category,
      exercises: goal.exercises.map((e) => ({
        exerciseId: e.exercise_id,
        name: e.exercise_name,
        unit: e.unit,
        individualTarget: formatAmountInputValue(e.individual_target, e.unit),
      })),
    };
  }
  return days;
}

export default function NewGoalScreen() {
  const { gangId, planId } = useLocalSearchParams<{ gangId: string; planId?: string }>();
  const isEditing = !!planId;
  const t = useThemeTokens();
  const createPlan = useCreateWeeklyPlan();
  const updatePlan = useUpdateWeeklyPlan();
  const { data: gang } = useGang(gangId ?? '');
  const { data: existingPlan, isLoading: loadingPlan } = useWeeklyPlan(
    isEditing ? planId : undefined,
  );

  const [selectedDay, setSelectedDay] = useState(1);
  const [days, setDays] = useState(() => buildInitialDays());
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || !existingPlan || hasPrefilled) return;
    setDays(buildDaysFromPlan(existingPlan));
    setIsAdaptive(existingPlan.is_adaptive);
    setHasPrefilled(true);
  }, [isEditing, existingPlan, hasPrefilled]);

  const weekStarts = isEditing && existingPlan ? existingPlan.starts_on : mondayOfWeek();
  const memberCount = gang?.member_count ?? 1;
  const isPending = createPlan.isPending || updatePlan.isPending;
  const currentDay = days[selectedDay];
  const { data: exercises } = useExercises(currentDay.category, gangId);

  const availableExercises = useMemo(() => {
    const used = new Set(currentDay.exercises.map((e) => e.exerciseId));
    return (exercises ?? []).filter((e) => !used.has(e.id));
  }, [exercises, currentDay.exercises]);

  function addExercise(exerciseId: string) {
    const ex = exercises?.find((e) => e.id === exerciseId);
    if (!ex) return;
    const dayOfWeek = selectedDay;

    setDays((prev) => {
      const day = prev[dayOfWeek];
      return {
        ...prev,
        [dayOfWeek]: {
          ...day,
          exercises: [
            ...day.exercises,
            {
              exerciseId: ex.id,
              name: ex.name,
              unit: ex.unit,
              individualTarget: ex.unit === 'miles' ? '2' : ex.unit === 'seconds' ? '60' : '20',
            },
          ],
        },
      };
    });
  }

  function removeExercise(exerciseId: string) {
    const dayOfWeek = selectedDay;
    setDays((prev) => {
      const day = prev[dayOfWeek];
      return {
        ...prev,
        [dayOfWeek]: {
          ...day,
          exercises: day.exercises.filter((e) => e.exerciseId !== exerciseId),
        },
      };
    });
  }

  function updateExerciseTarget(exerciseId: string, unit: ExerciseUnit, individualTarget: string) {
    const dayOfWeek = selectedDay;
    const sanitized = sanitizeAmountInput(individualTarget, unit);
    setDays((prev) => {
      const day = prev[dayOfWeek];
      return {
        ...prev,
        [dayOfWeek]: {
          ...day,
          exercises: day.exercises.map((e) =>
            e.exerciseId === exerciseId ? { ...e, individualTarget: sanitized } : e,
          ),
        },
      };
    });
  }

  function setDayCategory(dayOfWeek: number, category: ExerciseCategory) {
    setDays((prev) => {
      const day = prev[dayOfWeek];
      if (day.category === category) return prev;
      return {
        ...prev,
        [dayOfWeek]: { ...day, category },
      };
    });
  }

  async function handleSubmit() {
    setError(null);

    const payload = buildDaysPayload(days);

    const hasAnyExercise = payload.some((d) => d.exercises.length > 0);
    if (!hasAnyExercise) {
      setError('Add at least one exercise to your weekly plan');
      return;
    }

    try {
      if (isEditing && planId) {
        await updatePlan.mutateAsync({ planId, days: payload, isAdaptive });
      } else {
        await createPlan.mutateAsync({
          gangId: gangId!,
          startsOn: weekStarts,
          days: payload,
          isAdaptive,
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save weekly plan');
    }
  }

  const dayExerciseCount = (dow: number) => days[dow]?.exercises.length ?? 0;

  if (isEditing && loadingPlan) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  if (isEditing && !loadingPlan && !existingPlan) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center p-6">
          <Text style={{ color: t.body }}>Weekly plan not found</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={{ color: t.heading }} className="text-2xl font-bold">
            {isEditing ? 'Edit weekly plan' : 'Weekly plan'}
          </Text>
        </View>

        <GlassSurface style={{ padding: 16, gap: 8 }}>
          <Text style={{ color: t.body }} className="text-xs uppercase tracking-wide">
            Week of
          </Text>
          <Text style={{ color: t.heading }} className="text-lg font-semibold">
            {new Date(weekStarts + 'T12:00:00').toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Text style={{ color: t.body }} className="text-sm">
            Gang targets = per-member target × {memberCount} member
            {memberCount === 1 ? '' : 's'}
          </Text>
        </GlassSurface>

        <GlassSurface style={{ padding: 16, gap: 10 }}>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text style={{ color: t.heading }} className="text-base font-semibold">
                Adaptive plan
              </Text>
              <Text style={{ color: t.body }} className="text-sm">
                If the gang completes every exercise every day, next week’s targets go up (+5 reps,
                +30 sec, or +0.5 mi). Miss a week and the same plan repeats.
              </Text>
            </View>
            <Switch
              value={isAdaptive}
              onValueChange={setIsAdaptive}
              trackColor={{ false: t.buttonBorder, true: t.accent }}
              thumbColor={t.accentOnPrimary}
              accessibilityLabel="Adaptive plan"
              accessibilityHint="Increases difficulty next week when the gang completes all goals"
            />
          </View>
        </GlassSurface>

        <View>
          <Label>Select day</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {WEEK_DAYS.map((wd) => (
                <Chip
                  key={wd.dayOfWeek}
                  label={`${wd.shortLabel}${dayExerciseCount(wd.dayOfWeek) > 0 ? ` (${dayExerciseCount(wd.dayOfWeek)})` : ''}`}
                  active={selectedDay === wd.dayOfWeek}
                  onPress={() => setSelectedDay(wd.dayOfWeek)}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        <GlassSurface style={{ padding: 20, gap: 16 }}>
          <View>
            <Label>Date</Label>
            <Text style={{ color: t.heading }} className="text-lg font-semibold">
              {formatGoalDate(goalDateForWeekDay(weekStarts, selectedDay))}
            </Text>
          </View>

          <View>
            <Label>Category</Label>
            <View className="flex-row flex-wrap gap-2">
              {WEEKLY_SCHEDULE.map((d) => (
                <Chip
                  key={d.category}
                  label={CATEGORY_LABELS[d.category]}
                  active={currentDay.category === d.category}
                  onPress={() => setDayCategory(selectedDay, d.category)}
                />
              ))}
            </View>
            {availableExercises.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {availableExercises.map((ex) => (
                  <Chip
                    key={ex.id}
                    label={`+ ${ex.name}`}
                    active={false}
                    onPress={() => addExercise(ex.id)}
                  />
                ))}
              </View>
            ) : currentDay.exercises.length === 0 ? (
              <Text style={{ color: t.body }} className="mt-2 text-sm">
                No exercises in this category yet.
              </Text>
            ) : null}
          </View>

          <View>
            <Label>Activities (optional — leave empty for rest day)</Label>
            {[...currentDay.exercises].reverse().map((ex) => {
              const parsedTarget = parseActivityAmount(ex.individualTarget, ex.unit);
              const gangTarget =
                parsedTarget !== null ? parsedTarget * memberCount : 0;
              return (
                <View
                  key={ex.exerciseId}
                  style={[styles.exerciseRow, { borderColor: t.buttonBorder }]}
                >
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text style={{ color: t.heading }} className="font-semibold">
                      {ex.name}
                    </Text>
                    <TouchableOpacity onPress={() => removeExercise(ex.exerciseId)}>
                      <Ionicons name="trash-outline" size={18} color={t.body} />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-end gap-3">
                    <View className="flex-1">
                      <Label>Per member ({ex.unit})</Label>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: t.inputBg,
                            borderColor: t.inputBorder,
                            color: t.heading,
                          },
                        ]}
                        value={ex.individualTarget}
                        onChangeText={(v) => updateExerciseTarget(ex.exerciseId, ex.unit, v)}
                        keyboardType={ex.unit === 'miles' ? 'decimal-pad' : 'number-pad'}
                        placeholder={ex.unit === 'miles' ? '2.5' : '20'}
                      />
                    </View>
                    <View className="flex-1 pb-3">
                      <Text style={{ color: t.body }} className="text-xs uppercase">
                        Gang target
                      </Text>
                      <Text style={{ color: t.accent }} className="text-lg font-bold">
                        {parsedTarget !== null ? formatAmount(gangTarget, ex.unit) : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </GlassSurface>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isPending}
          className="items-center rounded-xl py-4"
          style={{ backgroundColor: t.accent }}
        >
          {isPending ? (
            <ActivityIndicator color={t.accentOnPrimary} />
          ) : (
            <Text style={{ color: t.accentOnPrimary }} className="text-base font-bold">
              {isEditing ? 'Save changes' : 'Publish weekly plan'}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </ScreenBackground>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const t = useThemeTokens();
  return (
    <Text style={{ color: t.body }} className="mb-2 text-xs uppercase tracking-wide">
      {children}
    </Text>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useThemeTokens();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-lg px-3 py-2"
      style={{
        backgroundColor: active ? t.accent : t.buttonBg,
        borderWidth: 1,
        borderColor: active ? t.accent : t.buttonBorder,
      }}
    >
      <Text
        style={{ color: active ? t.accentOnPrimary : t.body }}
        className="text-sm font-semibold"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  exerciseRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  error: { color: '#ef4444', fontSize: 13 },
});
