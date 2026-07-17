import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { AmountInput } from '@/components/ui/amount-input';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { GoalCompleteOverlay } from '@/components/goal-complete-overlay';
import { LevelUpOverlay } from '@/components/level-up-overlay';
import { StreakContinueOverlay } from '@/components/streak-continue-overlay';
import { GoalProgressPreview } from '@/components/goal-progress-preview';
import { CameraRepCountButton } from '@/components/rep-counter/camera-rep-count-button';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useLogActivity, useQuestActivity, useUpdateActivity, estimateSessionXp, hasPersonalGoalAward } from '@/hooks/use-activities';
import { useExercises } from '@/hooks/use-exercises';
import { useMyGangs } from '@/hooks/use-gangs';
import { useProfile } from '@/hooks/use-profile';
import { useQuest } from '@/hooks/use-quests';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { resolveStreakContinue, type StreakContinuePayload } from '@/lib/daily-goal-celebration';
import { formatAmount } from '@/lib/format';
import {
  formatAmountInputValue,
  parseActivityAmount,
  validateAmountInput,
} from '@/lib/activity-amount';
import {
  buildRepCounterSessionKey,
  consumePendingRepCount,
} from '@/lib/rep-counting/pending-result';
import { supportsCameraTracking } from '@/lib/rep-counting/exercise-registry';
import {
  CATEGORY_LABELS,
  WEEKLY_SCHEDULE,
  todaysCategory,
  type Exercise,
  type ExerciseCategory,
  type ExerciseUnit,
  getLevelUpInfo,
} from '@/types';

interface GoalCelebration {
  questTitle: string;
  questKind: string;
  description: string;
  xpEarned: number;
  yourTarget: { from: number; target: number };
}

export default function LogActivityScreen() {
  const params = useLocalSearchParams<{
    gangId?: string;
    questId?: string;
    category?: string;
    exerciseId?: string;
    exerciseName?: string;
    unit?: string;
  }>();
  const t = useThemeTokens();
  const logActivity = useLogActivity();
  const updateActivity = useUpdateActivity();
  const { data: profile } = useProfile();
  const { data: myGangs } = useMyGangs();

  const lockedToQuest = !!params.questId;
  const { data: questActivity, isLoading: loadingQuestActivity } = useQuestActivity(
    lockedToQuest ? params.questId : undefined,
  );
  const { data: quest, isLoading: loadingQuest } = useQuest(
    lockedToQuest ? params.questId : undefined,
  );
  const isEditing = lockedToQuest && !!questActivity;

  const [gangId, setGangId] = useState<string | undefined>(params.gangId);
  const [category, setCategory] = useState<ExerciseCategory>(
    (params.category as ExerciseCategory) || todaysCategory(),
  );
  const [exerciseId, setExerciseId] = useState<string | undefined>(
    params.exerciseId || undefined,
  );
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [celebration, setCelebration] = useState<GoalCelebration | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [streakContinue, setStreakContinue] = useState<StreakContinuePayload | null>(null);
  const [streakKey, setStreakKey] = useState(0);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [pendingCelebration, setPendingCelebration] = useState<GoalCelebration | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(
    null,
  );

  const { data: exercises } = useExercises(
    lockedToQuest ? undefined : category,
    lockedToQuest ? params.gangId : gangId,
  );

  const selectedExercise = useMemo((): Exercise | undefined => {
    if (lockedToQuest && params.exerciseId) {
      const fromList = exercises?.find((e) => e.id === params.exerciseId);
      if (fromList) return fromList;

      return {
        id: params.exerciseId,
        name: params.exerciseName ?? questActivity?.exercise_name ?? 'Exercise',
        category,
        unit: (params.unit as ExerciseUnit) ?? questActivity?.unit ?? 'reps',
        description: null,
        gang_id: params.gangId ?? null,
        created_at: '',
      };
    }

    return exercises?.find((e) => e.id === exerciseId) ?? exercises?.[0];
  }, [lockedToQuest, params, exercises, exerciseId, category, questActivity]);

  const unit = selectedExercise?.unit ?? 'reps';
  const isPending = logActivity.isPending || updateActivity.isPending;
  const repCounterSessionKey = selectedExercise
    ? buildRepCounterSessionKey(
        selectedExercise.id,
        params.questId ?? params.gangId ?? 'solo',
      )
    : null;
  const requiresCameraCount =
    !!selectedExercise && supportsCameraTracking(selectedExercise.name, selectedExercise.unit);

  useFocusEffect(
    useCallback(() => {
      if (!repCounterSessionKey || !selectedExercise) return;
      const pending = consumePendingRepCount(repCounterSessionKey);
      if (pending === null) return;

      setAmount((current) => {
        const existing = parseActivityAmount(current, selectedExercise.unit) ?? 0;
        return formatAmountInputValue(existing + pending, selectedExercise.unit);
      });
    }, [repCounterSessionKey, selectedExercise]),
  );

  const goalProgress = useMemo(() => {
    if (!quest) return null;

    const inputAmt = parseActivityAmount(amount, unit);
    const hasValidInput = inputAmt !== null;
    const previousAmt = isEditing && questActivity ? questActivity.amount : 0;

    if (!hasValidInput) {
      return {
        gangTotal: quest.gang_total,
        userTotal: quest.user_total,
        isPreview: false,
      };
    }

    return {
      gangTotal: quest.gang_total - previousAmt + inputAmt!,
      userTotal: quest.user_total - previousAmt + inputAmt!,
      isPreview: inputAmt !== previousAmt,
    };
  }, [quest, amount, isEditing, questActivity, unit]);

  useEffect(() => {
    if (!questActivity || hasPrefilled) return;
    setAmount(formatAmountInputValue(questActivity.amount, questActivity.unit));
    setNotes(questActivity.notes ?? '');
    if (questActivity.exercise_id) setExerciseId(questActivity.exercise_id);
    setHasPrefilled(true);
  }, [questActivity, hasPrefilled]);

  async function handleSubmit() {
    setError(null);
    const validationError = validateAmountInput(amount, unit);
    if (validationError) return setError(validationError);
    const amt = parseActivityAmount(amount, unit)!;
    if (!selectedExercise) return setError('Pick an exercise');

    try {
      // Snapshot before saves — post-save profile refetch would skip the streak overlay.
      const profileSnapshot = {
        profileXp: profile?.xp ?? 0,
        currentStreak: profile?.current_streak ?? 0,
        lastActiveOn: profile?.last_active_on ?? null,
      };

      const previousAmt = isEditing && questActivity ? questActivity.amount : 0;
      const userTotalBefore = quest ? quest.user_total - previousAmt : 0;
      const userTotalAfter = userTotalBefore + amt;
      const gangTotalBefore = quest ? quest.gang_total - previousAmt : 0;
      const gangTotalAfter = gangTotalBefore + amt;
      const questXpContext =
        quest && params.questId
          ? {
              gangId: quest.gang_id,
              gangTarget: quest.gang_target,
              individualTarget: quest.individual_target,
              gangTotalBefore,
              gangTotalAfter,
              userTotalBefore,
              userTotalAfter,
            }
          : undefined;
      const alreadyAwarded =
        lockedToQuest && params.questId
          ? await hasPersonalGoalAward(params.questId)
          : false;
      const justCompletedPersonalGoal =
        lockedToQuest &&
        quest?.type === 'daily' &&
        quest.individual_target > 0 &&
        userTotalAfter >= quest.individual_target &&
        !alreadyAwarded;

      let xpAwarded = 0;
      if (isEditing && questActivity) {
        const result = await updateActivity.mutateAsync({
          exerciseRowId: questActivity.id,
          activityId: questActivity.activity_id,
          gangId: questActivity.gang_id,
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          category: selectedExercise.category,
          unit: selectedExercise.unit,
          amount: amt,
          notes: notes.trim() || undefined,
          previousAmount: questActivity.amount,
          previousUnit: questActivity.unit,
          questId: params.questId,
          questXpContext,
        });
        xpAwarded = result.xpAwarded;
      } else {
        const result = await logActivity.mutateAsync({
          gangId,
          questId: params.questId,
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          category: selectedExercise.category,
          unit: selectedExercise.unit,
          amount: amt,
          notes: notes.trim() || undefined,
          questXpContext,
        });
        xpAwarded = result.xpAwarded;
      }

      const levelUpInfo = getLevelUpInfo(profileSnapshot.profileXp, xpAwarded);
      const nextStreak =
        isEditing
          ? null
          : resolveStreakContinue({
              currentStreak: profileSnapshot.currentStreak,
              lastActiveOn: profileSnapshot.lastActiveOn,
            });

      const nextCelebration: GoalCelebration | null =
        justCompletedPersonalGoal && quest
          ? {
              questTitle: quest.title,
              questKind: 'Daily Goal',
              description: `${formatAmount(quest.individual_target, quest.unit)} are yours.`,
              xpEarned: xpAwarded,
              yourTarget: { from: userTotalBefore, target: quest.individual_target },
            }
          : null;

      if (nextStreak) {
        if (nextCelebration) setPendingCelebration(nextCelebration);
        if (levelUpInfo) setPendingLevelUp(levelUpInfo);
        setStreakContinue(nextStreak);
        setStreakKey((k) => k + 1);
        return;
      }

      if (nextCelebration) {
        if (levelUpInfo) setPendingLevelUp(levelUpInfo);
        setCelebration(nextCelebration);
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
      setError(e instanceof Error ? e.message : 'Could not save activity');
    }
  }

  function handleDismissStreakContinue() {
    setStreakContinue(null);
    if (pendingCelebration) {
      setCelebration(pendingCelebration);
      setPendingCelebration(null);
      setCelebrationKey((k) => k + 1);
      return;
    }
    if (pendingLevelUp) {
      setLevelUp(pendingLevelUp);
      setPendingLevelUp(null);
      setLevelUpKey((k) => k + 1);
      return;
    }
    router.back();
  }

  function handleDismissCelebration() {
    setCelebration(null);
    if (pendingLevelUp) {
      setLevelUp(pendingLevelUp);
      setPendingLevelUp(null);
      setLevelUpKey((k) => k + 1);
      return;
    }
    router.back();
  }

  function handleDismissLevelUp() {
    setLevelUp(null);
    router.back();
  }

  function handlePreviewCelebration() {
    if (!quest) return;
    const previousAmt = isEditing && questActivity ? questActivity.amount : 0;
    const userTotalBefore = quest.user_total - previousAmt;
    const previewAmt = parseActivityAmount(amount, unit) ?? 0;
    const userTotalAfter = userTotalBefore + previewAmt;
    const gangTotalBefore = quest.gang_total - previousAmt;
    const gangTotalAfter = gangTotalBefore + previewAmt;
    const from = Math.min(
      Math.max(0, userTotalBefore),
      Math.max(0, quest.individual_target - 1),
    );
    const questXpContext = {
      gangId: quest.gang_id,
      gangTarget: quest.gang_target,
      individualTarget: quest.individual_target,
      gangTotalBefore,
      gangTotalAfter,
      userTotalBefore,
      userTotalAfter,
    };
    const sessionXp = estimateSessionXp({ isNewActivity: !isEditing, questXpContext });

    setCelebration(null);
    requestAnimationFrame(() => {
      setCelebrationKey((k) => k + 1);
      setCelebration({
        questTitle: quest.title,
        questKind: 'Daily Goal',
        description: `${formatAmount(quest.individual_target, quest.unit)} are yours.`,
        xpEarned: sessionXp,
        yourTarget: { from, target: quest.individual_target },
      });
    });
  }

  if (lockedToQuest && (loadingQuestActivity || loadingQuest)) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.accent} />
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
            {isEditing ? 'Update activity' : 'Log activity'}
          </Text>
        </View>

        <GlassSurface style={{ padding: 20, gap: 16 }}>
          {lockedToQuest && quest && goalProgress ? (
            <GoalProgressPreview
              title={quest.title}
              unit={quest.unit}
              gangTotal={goalProgress.gangTotal}
              gangTarget={quest.gang_target}
              userTotal={goalProgress.userTotal}
              individualTarget={quest.individual_target}
              isPreview={goalProgress.isPreview}
            />
          ) : null}

          {/* gang attribution */}
          {!lockedToQuest && myGangs && myGangs.length > 0 ? (
            <View>
              <Label>Share with Gang</Label>
              <View className="flex-row flex-wrap gap-2">
                <Chip label="Just me" active={!gangId} onPress={() => setGangId(undefined)} />
                {myGangs.map((g) => (
                  <Chip key={g.id} label={g.name} active={gangId === g.id} onPress={() => setGangId(g.id)} />
                ))}
              </View>
            </View>
          ) : null}

          {/* category */}
          {!lockedToQuest ? (
            <View>
              <Label>Category</Label>
              <View className="flex-row flex-wrap gap-2">
                {WEEKLY_SCHEDULE.map((d) => (
                  <Chip
                    key={d.category}
                    label={CATEGORY_LABELS[d.category]}
                    active={category === d.category}
                    onPress={() => {
                      setCategory(d.category);
                      setExerciseId(undefined);
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* exercise */}
          <View>
            <Label>Exercise</Label>
            {lockedToQuest ? (
              <Text style={{ color: t.heading }} className="text-lg font-semibold">
                {selectedExercise?.name ?? '—'}
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {(exercises ?? []).map((ex) => (
                  <Chip
                    key={ex.id}
                    label={ex.name}
                    active={selectedExercise?.id === ex.id}
                    onPress={() => setExerciseId(ex.id)}
                  />
                ))}
              </View>
            )}
          </View>

          <View>
            {requiresCameraCount && selectedExercise ? (
              <>
                <CameraRepCountButton
                  exerciseId={selectedExercise.id}
                  exerciseName={selectedExercise.name}
                  unit={selectedExercise.unit}
                  contextId={params.questId ?? params.gangId ?? 'solo'}
                  sessionKey={repCounterSessionKey ?? undefined}
                  disabled={isPending}
                />
                <View className="mt-3">
                  <Label>
                    {selectedExercise.unit === 'seconds'
                      ? 'Seconds (camera verified)'
                      : 'Reps (camera verified)'}
                  </Label>
                  <View
                    className="rounded-xl border px-4 py-3"
                    style={{ backgroundColor: t.inputBg, borderColor: t.inputBorder }}
                  >
                    <Text style={{ color: amount ? t.heading : t.placeholder, fontSize: 18, fontWeight: '600' }}>
                      {amount ||
                        (selectedExercise.unit === 'seconds'
                          ? 'Use the camera to time your hold'
                          : 'Use the camera to count your reps')}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <AmountInput
                unit={unit}
                value={amount}
                onChangeValue={setAmount}
                label="Amount"
                inputBg={t.inputBg}
                inputBorder={t.inputBorder}
                textColor={t.heading}
                placeholderColor={t.placeholder}
                labelColor={t.body}
              />
            )}
          </View>

          {/* notes */}
          <View>
            <Label>Notes (optional)</Label>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading, height: 80, textAlignVertical: 'top' },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How'd it feel?"
              placeholderTextColor={t.placeholder}
              multiline
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isPending}
            className="items-center rounded-xl py-4"
            style={{ backgroundColor: t.accent }}>
            {isPending ? (
              <ActivityIndicator color={t.accentOnPrimary} />
            ) : (
              <Text style={{ color: t.accentOnPrimary }} className="text-base font-bold">
                {isEditing ? 'Save changes' : 'Log it'}
              </Text>
            )}
          </TouchableOpacity>

          {__DEV__ && lockedToQuest && quest ? (
            <TouchableOpacity
              onPress={handlePreviewCelebration}
              className="items-center rounded-xl border py-3"
              style={{ borderColor: t.buttonBorder, backgroundColor: t.buttonBg }}>
              <Text style={{ color: t.body }} className="text-sm font-semibold">
                Preview goal complete animation
              </Text>
            </TouchableOpacity>
          ) : null}
        </GlassSurface>
      </KeyboardAwareScrollView>

      {streakContinue ? (
        <StreakContinueOverlay
          key={streakKey}
          visible
          fromDays={streakContinue.fromDays}
          toDays={streakContinue.toDays}
          onDismiss={handleDismissStreakContinue}
        />
      ) : null}

      {celebration && !streakContinue ? (
        <GoalCompleteOverlay
          key={celebrationKey}
          visible
          questTitle={celebration.questTitle}
          questKind={celebration.questKind}
          description={celebration.description}
          xpEarned={celebration.xpEarned}
          yourTarget={celebration.yourTarget}
          onDismiss={handleDismissCelebration}
        />
      ) : null}

      {levelUp && !celebration && !streakContinue ? (
        <LevelUpOverlay
          key={levelUpKey}
          visible
          fromLevel={levelUp.fromLevel}
          toLevel={levelUp.toLevel}
          onDismiss={handleDismissLevelUp}
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
      }}>
      <Text style={{ color: active ? t.accentOnPrimary : t.body }} className="text-sm font-semibold">
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
  error: { color: '#ef4444', fontSize: 13 },
});
