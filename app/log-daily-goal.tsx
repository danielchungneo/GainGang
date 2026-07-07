import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface, KeyboardAwareScrollView, ScreenBackground } from '@/components/ui';
import { AmountInput } from '@/components/ui/amount-input';
import {
  GoalCompleteOverlay,
  type GoalCompleteExerciseTarget,
} from '@/components/goal-complete-overlay';
import { LevelUpOverlay } from '@/components/level-up-overlay';
import { useDailyGoalActivities, useLogActivity, useUpdateActivity, fetchPersonalGoalAwardedExerciseIds } from '@/hooks/use-activities';
import { useDailyGoal } from '@/hooks/use-weekly-plans';
import { useProfile } from '@/hooks/use-profile';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  formatAmountInputValue,
  parseActivityAmount,
  sanitizeAmountInput,
  validateAmountInput,
} from '@/lib/activity-amount';
import { formatAmount, formatGoalActivityList, formatGoalDate } from '@/lib/format';
import { getLevelUpInfo, type DailyGoalExerciseWithProgress, type ExerciseUnit } from '@/types';
import type { Activity } from '@/types';

interface ExerciseFormState {
  amount: string;
  notes: string;
}

function resolveExistingForExercise(
  ex: DailyGoalExerciseWithProgress,
  byExercise: Record<string, Activity>,
): Pick<Activity, 'id' | 'amount' | 'notes'> | undefined {
  const fromQuery = byExercise[ex.id];
  if (fromQuery) return fromQuery;
  if (ex.activity_id) {
    return { id: ex.activity_id, amount: ex.user_total, notes: null };
  }
  return undefined;
}

export default function LogDailyGoalScreen() {
  const { dailyGoalId, gangId } = useLocalSearchParams<{
    dailyGoalId: string;
    gangId: string;
  }>();
  const t = useThemeTokens();
  const logActivity = useLogActivity();
  const updateActivity = useUpdateActivity();
  const { data: profile } = useProfile();

  const { data: dailyGoal, isLoading: loadingGoal } = useDailyGoal(dailyGoalId);
  const { data: existingActivities, isLoading: loadingActivities } =
    useDailyGoalActivities(dailyGoalId);

  const [formState, setFormState] = useState<Record<string, ExerciseFormState>>({});
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    title: string;
    xpEarned: number;
    exercises: GoalCompleteExerciseTarget[];
  } | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [pendingLevelUp, setPendingLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(
    null,
  );

  const activityByExercise = useMemo(() => {
    const map: Record<string, (typeof existingActivities extends (infer U)[] | undefined ? U : never)> = {};
    for (const a of existingActivities ?? []) {
      if (a.daily_goal_exercise_id) map[a.daily_goal_exercise_id] = a;
    }
    return map;
  }, [existingActivities]);

  useEffect(() => {
    if (!dailyGoal || loadingActivities || hasPrefilled) return;
    const next: Record<string, ExerciseFormState> = {};
    for (const ex of dailyGoal.exercises) {
      const existing = activityByExercise[ex.id];
      const amount = existing?.amount ?? (ex.activity_id ? ex.user_total : 0);
      next[ex.id] = {
        amount: amount > 0 ? formatAmountInputValue(amount, ex.unit) : '',
        notes: existing?.notes ?? '',
      };
    }
    setFormState(next);
    setHasPrefilled(true);
  }, [dailyGoal, loadingActivities, activityByExercise, hasPrefilled]);

  const isPending = logActivity.isPending || updateActivity.isPending;
  const isLoading = loadingGoal || loadingActivities;

  function updateExerciseField(
    exerciseGoalId: string,
    unit: ExerciseUnit,
    field: keyof ExerciseFormState,
    value: string,
  ) {
    const sanitized = field === 'amount' ? sanitizeAmountInput(value, unit) : value;
    setFormState((prev) => ({
      ...prev,
      [exerciseGoalId]: { ...prev[exerciseGoalId], [field]: sanitized },
    }));
  }

  async function handleSubmit() {
    if (!dailyGoal) return;
    setError(null);

    const toSave = dailyGoal.exercises.filter((ex) => {
      const raw = formState[ex.id]?.amount ?? '';
      return parseActivityAmount(raw, ex.unit) !== null;
    });

    if (toSave.length === 0) {
      setError('Enter an amount for at least one exercise');
      return;
    }

    for (const ex of toSave) {
      const raw = formState[ex.id]?.amount ?? '';
      const validationError = validateAmountInput(raw, ex.unit);
      if (validationError) {
        setError(`${ex.exercise_name}: ${validationError}`);
        return;
      }
    }

    try {
      let totalXp = 0;

      const totalsBefore = dailyGoal.exercises.map((ex) => {
        const existing = resolveExistingForExercise(ex, activityByExercise);
        const previousAmt = existing?.amount ?? 0;
        return ex.user_total - previousAmt;
      });

      const awardedExerciseIds = await fetchPersonalGoalAwardedExerciseIds(
        dailyGoal.exercises.map((ex) => ex.id),
      );

      for (const ex of toSave) {
        const amt = parseActivityAmount(formState[ex.id].amount, ex.unit)!;
        const existing = resolveExistingForExercise(ex, activityByExercise);
        const previousAmt = existing?.amount ?? 0;
        const userTotalBefore = ex.user_total - previousAmt;
        const userTotalAfter = userTotalBefore + amt;
        const gangTotalBefore = ex.gang_total - previousAmt;
        const gangTotalAfter = gangTotalBefore + amt;

        const questXpContext = {
          gangId: dailyGoal.gang_id,
          gangTarget: ex.gang_target,
          individualTarget: ex.individual_target,
          gangTotalBefore,
          gangTotalAfter,
          userTotalBefore,
          userTotalAfter,
        };

        let xpAwarded = 0;
        if (existing) {
          const result = await updateActivity.mutateAsync({
            id: existing.id,
            gangId: gangId ?? dailyGoal.gang_id,
            exerciseId: ex.exercise_id,
            exerciseName: ex.exercise_name,
            category: dailyGoal.day_category ?? undefined,
            unit: ex.unit,
            amount: amt,
            notes: formState[ex.id].notes.trim() || undefined,
            previousAmount: previousAmt,
            previousUnit: ex.unit,
            questXpContext,
          });
          xpAwarded = result.xpAwarded;
        } else {
          const result = await logActivity.mutateAsync({
            gangId: gangId ?? dailyGoal.gang_id,
            dailyGoalExerciseId: ex.id,
            exerciseId: ex.exercise_id,
            exerciseName: ex.exercise_name,
            category: dailyGoal.day_category ?? undefined,
            unit: ex.unit,
            amount: amt,
            notes: formState[ex.id].notes.trim() || undefined,
            questXpContext,
          });
          xpAwarded = result.xpAwarded;
        }

        totalXp += xpAwarded;
      }

      const totalsAfter = dailyGoal.exercises.map((ex, index) => {
        const saved = toSave.some((s) => s.id === ex.id);
        if (!saved) return totalsBefore[index];
        const amt = parseActivityAmount(formState[ex.id].amount, ex.unit)!;
        return totalsBefore[index] + amt;
      });

      const isExerciseMet = (ex: (typeof dailyGoal.exercises)[0], total: number) =>
        ex.individual_target > 0 && total >= ex.individual_target;

      const wasExerciseCompleteBefore = (ex: (typeof dailyGoal.exercises)[0], index: number) =>
        awardedExerciseIds.has(ex.id) || isExerciseMet(ex, totalsBefore[index]);

      const allCompleteBefore = dailyGoal.exercises.every((ex, i) =>
        wasExerciseCompleteBefore(ex, i),
      );
      const allCompleteAfter = dailyGoal.exercises.every((ex, i) =>
        isExerciseMet(ex, totalsAfter[i]),
      );

      const levelUpInfo = getLevelUpInfo(profile?.xp ?? 0, totalXp);

      if (allCompleteAfter && !allCompleteBefore) {
        const exercises: GoalCompleteExerciseTarget[] = dailyGoal.exercises.map((ex, i) => ({
          name: ex.exercise_name,
          unit: ex.unit,
          from: totalsBefore[i],
          target: ex.individual_target,
        }));

        if (levelUpInfo) setPendingLevelUp(levelUpInfo);
        setCelebration({
          title: formatGoalDate(dailyGoal.goal_date),
          xpEarned: totalXp,
          exercises,
        });
        setCelebrationKey((k) => k + 1);
        return;
      }

      if (levelUpInfo) {
        setLevelUp(levelUpInfo);
        setLevelUpKey((k) => k + 1);
        return;
      }

      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save activities');
    }
  }

  if (isLoading) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  if (!dailyGoal) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center p-6">
          <Text style={{ color: t.body }}>Daily goal not found</Text>
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
            Log daily goal
          </Text>
        </View>

        <GlassSurface style={{ padding: 20, gap: 16 }}>
          <View>
            <Text style={{ color: t.body }} className="text-xs uppercase tracking-wide">
              {dailyGoal.gang_name}
            </Text>
            <Text style={{ color: t.heading }} className="text-xl font-bold">
              {formatGoalDate(dailyGoal.goal_date)}
            </Text>
            <Text style={{ color: t.body }} className="mt-1 text-sm">
              {formatGoalActivityList(dailyGoal.exercises)}
            </Text>
          </View>

          {dailyGoal.exercises.map((ex) => {
            const state = formState[ex.id] ?? { amount: '', notes: '' };
            const hasLogged = !!resolveExistingForExercise(ex, activityByExercise);

            return (
              <View
                key={ex.id}
                style={[
                  styles.exerciseSection,
                  { borderColor: t.buttonBorder },
                ]}
              >
                <View className="mb-2 flex-row items-center justify-between">
                  <Text style={{ color: t.heading }} className="text-lg font-semibold">
                    {ex.exercise_name}
                  </Text>
                  {hasLogged ? (
                    <Text style={{ color: t.accent }} className="text-xs font-semibold">
                      Logged
                    </Text>
                  ) : null}
                </View>

                <Text style={{ color: t.body }} className="mb-3 text-sm">
                  Your target: {formatAmount(ex.individual_target, ex.unit)} · Gang:{' '}
                  {formatAmount(ex.gang_target, ex.unit)}
                </Text>

                <AmountInput
                  unit={ex.unit}
                  value={state.amount}
                  onChangeValue={(v) => updateExerciseField(ex.id, ex.unit, 'amount', v)}
                  label="Amount"
                  inputBg={t.inputBg}
                  inputBorder={t.inputBorder}
                  textColor={t.heading}
                  placeholderColor={t.placeholder}
                  labelColor={t.body}
                />

                <View className="mt-2">
                  <Label>Notes (optional)</Label>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: t.inputBorder,
                        color: t.heading,
                        height: 60,
                        textAlignVertical: 'top',
                      },
                    ]}
                    value={state.notes}
                    onChangeText={(v) => updateExerciseField(ex.id, ex.unit, 'notes', v)}
                    placeholder="How'd it feel?"
                    placeholderTextColor={t.placeholder}
                    multiline
                  />
                </View>
              </View>
            );
          })}

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
                Save all
              </Text>
            )}
          </TouchableOpacity>
        </GlassSurface>
      </KeyboardAwareScrollView>

      {celebration ? (
        <GoalCompleteOverlay
          key={celebrationKey}
          visible
          questTitle={celebration.title}
          questKind="Daily Goal"
          xpEarned={celebration.xpEarned}
          exercises={celebration.exercises}
          onDismiss={() => {
            setCelebration(null);
            if (pendingLevelUp) {
              setLevelUp(pendingLevelUp);
              setPendingLevelUp(null);
              setLevelUpKey((k) => k + 1);
              return;
            }
            router.back();
          }}
        />
      ) : null}

      {levelUp && !celebration ? (
        <LevelUpOverlay
          key={levelUpKey}
          visible
          fromLevel={levelUp.fromLevel}
          toLevel={levelUp.toLevel}
          onDismiss={() => {
            setLevelUp(null);
            router.back();
          }}
        />
      ) : null}
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

const styles = StyleSheet.create({
  exerciseSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: '#ef4444', fontSize: 13 },
});
