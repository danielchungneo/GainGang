import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
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
import { formatAmount } from '@/lib/format';
import {
  CATEGORY_LABELS,
  WEEK_DAYS,
  WEEKLY_SCHEDULE,
  mondayOfWeek,
  type ExerciseCategory,
  type ExerciseUnit,
  type WeeklyPlanWithGoals,
} from '@/types';

const DAY_TITLE_SUGGESTIONS: Record<number, string[]> = {
  1: ['Chest Crusher', 'Push Day', 'The Iron Oath'],
  2: ['Leg Day', 'Lower Body Grind', 'Squat Protocol'],
  3: ['Cardio Rush', 'Distance Trial', 'Endurance Run'],
  4: ['Back Attack', 'Pull Day', 'Row Reckoning'],
  5: ['Core Command', 'Trunk Trial', 'Abs Ascension'],
  6: ['Active Recovery', 'Weekend Grind'],
  7: ['Rest & Recharge', 'Sunday Stretch'],
};

interface DayExerciseDraft {
  exerciseId: string;
  name: string;
  unit: ExerciseUnit;
  individualTarget: string;
}

interface DayDraft {
  title: string;
  category: ExerciseCategory;
  exercises: DayExerciseDraft[];
}

function buildInitialDays(): Record<number, DayDraft> {
  const days: Record<number, DayDraft> = {};
  for (const wd of WEEK_DAYS) {
    days[wd.dayOfWeek] = {
      title: `${CATEGORY_LABELS[wd.defaultCategory]} day`,
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
      title: goal.title || days[goal.day_of_week].title,
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
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || !existingPlan || hasPrefilled) return;
    setDays(buildDaysFromPlan(existingPlan));
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

  function patchDay(dayOfWeek: number, patch: Partial<DayDraft>) {
    setDays((prev) => ({
      ...prev,
      [dayOfWeek]: { ...prev[dayOfWeek], ...patch },
    }));
  }

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
        await updatePlan.mutateAsync({ planId, days: payload });
      } else {
        await createPlan.mutateAsync({
          gangId: gangId!,
          startsOn: weekStarts,
          days: payload,
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
          </View>

          <View>
            <Label>Daily goal title</Label>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading },
              ]}
              value={currentDay.title}
              onChangeText={(title) => patchDay(selectedDay, { title })}
              placeholder="Chest day"
              placeholderTextColor={t.placeholder}
            />
            <View className="mt-2 flex-row flex-wrap gap-2">
              {(DAY_TITLE_SUGGESTIONS[selectedDay] ?? []).map((n) => (
                <Chip
                  key={n}
                  label={n}
                  active={currentDay.title === n}
                  onPress={() => patchDay(selectedDay, { title: n })}
                />
              ))}
            </View>
          </View>

          <View>
            <Label>Exercises (optional — leave empty for rest day)</Label>
            {currentDay.exercises.map((ex) => {
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

            {availableExercises.length > 0 ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
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
              <Text style={{ color: t.body }} className="text-sm">
                No exercises in this category yet.
              </Text>
            ) : null}
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
