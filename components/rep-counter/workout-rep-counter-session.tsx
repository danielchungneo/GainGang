import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoalCompleteOverlay } from '@/components/goal-complete-overlay';
import { LevelUpOverlay } from '@/components/level-up-overlay';
import { ExerciseSetupGuide } from '@/components/rep-counter/exercise-setup-guide';
import { StreakContinueOverlay } from '@/components/streak-continue-overlay';
import { useAuth } from '@/context/auth-context';
import { useLogActivity } from '@/hooks/use-activities';
import { useProfile } from '@/hooks/use-profile';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useDailyGoal } from '@/hooks/use-weekly-plans';
import {
  buildDailyGoalTotalsAfter,
  resolvePostSaveCelebration,
  type DailyGoalCelebrationPayload,
  type StreakContinuePayload,
} from '@/lib/daily-goal-celebration';
import { saveDailyGoalExerciseDelta } from '@/lib/daily-goal-save';
import {
  getCameraExerciseType,
  getCameraTrackingMode,
  SETUP_GUIDES,
} from '@/lib/rep-counting/exercise-registry';
import {
  nextCameraUiRotation,
  type CameraUiRotation,
} from '@/lib/rep-counting/landmark-orientation';
import { isRepCounterNativeSupported, repCounterUnsupportedMessage } from '@/lib/rep-counting/platform';
import {
  isCameraSetupSkipped,
  setCameraSetupSkipped,
} from '@/lib/rep-counting/setup-preference';
import {
  buildWorkoutQueue,
  formatWorkoutProgressLabel,
} from '@/lib/rep-counting/workout-mode';
import type { CameraExerciseType, CameraTrackingMode } from '@/lib/rep-counting/types';
import type { DailyGoalExerciseWithProgress, DailyGoalWithProgress } from '@/types';

const RepCounterCamera = lazy(() =>
  import('@/components/rep-counter/rep-counter-camera').then((mod) => ({
    default: mod.RepCounterCamera,
  })),
);

const HoldCounterCamera = lazy(() =>
  import('@/components/rep-counter/hold-counter-camera').then((mod) => ({
    default: mod.HoldCounterCamera,
  })),
);

type SessionStep =
  | 'setup'
  | 'transition'
  | 'active'
  | 'review'
  | 'saving'
  | 'error'
  | 'done';

const NEXT_EXERCISE_FLASH_MS = 1800;

interface WorkoutRepCounterSessionProps {
  dailyGoalId: string;
  cycles: number;
  excludeCompletedExercises: boolean;
}

function formatHoldReview(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function clampAmount(amount: number, cap: number): number {
  return Math.min(Math.max(0, Math.round(amount)), Math.max(0, Math.round(cap)));
}

export function WorkoutRepCounterSession({
  dailyGoalId,
  cycles,
  excludeCompletedExercises,
}: WorkoutRepCounterSessionProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const logActivity = useLogActivity();
  const { data: profile } = useProfile();
  const { data: goal, isLoading, isError, refetch } = useDailyGoal(dailyGoalId);
  const nativeSupported = isRepCounterNativeSupported();

  const [segmentIndex, setSegmentIndex] = useState(0);
  const [step, setStep] = useState<SessionStep>('setup');
  const [trackedAmount, setTrackedAmount] = useState(0);
  const [dontShowSetupAgain, setDontShowSetupAgain] = useState(false);
  const [isSetupPreferenceReady, setIsSetupPreferenceReady] = useState(false);
  const [isHintModalVisible, setIsHintModalVisible] = useState(false);
  const [uiRotation, setUiRotation] = useState<CameraUiRotation>(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cameraRemountKey, setCameraRemountKey] = useState(0);

  const [celebration, setCelebration] = useState<DailyGoalCelebrationPayload | null>(null);
  const [streakContinue, setStreakContinue] = useState<StreakContinuePayload | null>(null);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [pendingCelebration, setPendingCelebration] =
    useState<DailyGoalCelebrationPayload | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<{
    fromLevel: number;
    toLevel: number;
  } | null>(null);

  const goalSnapshotRef = useRef<DailyGoalWithProgress | null>(null);
  const runningUserTotalsRef = useRef<Record<string, number>>({});
  const runningGangTotalsRef = useRef<Record<string, number>>({});
  const totalsBeforeRef = useRef<number[]>([]);
  const totalXpRef = useRef(0);
  const savedAnyRef = useRef(false);
  const profileSnapshotRef = useRef({
    profileXp: 0,
    currentStreak: 0,
    lastActiveOn: null as string | null,
  });
  const autoFinishRef = useRef(false);
  const savingRef = useRef(false);
  const sessionBootstrappedRef = useRef(false);

  // Keep the launch-time queue stable while activity saves refetch this goal.
  const queue = useMemo(
    () =>
      goal
        ? buildWorkoutQueue(goal.exercises, cycles, {
            excludeCompletedExercises,
          })
        : null,
    // The goal ID changes when a new workout loads; progress-only refetches must
    // not rebuild the queue because later-cycle skips use the session totals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goal?.id, cycles, excludeCompletedExercises],
  );

  const bootstrapSession = useCallback(() => {
    if (sessionBootstrappedRef.current || !goal) return;
    sessionBootstrappedRef.current = true;
    goalSnapshotRef.current = goal;
    totalsBeforeRef.current = goal.exercises.map((ex) => ex.user_total);
    runningUserTotalsRef.current = Object.fromEntries(
      goal.exercises.map((ex) => [ex.id, ex.user_total]),
    );
    runningGangTotalsRef.current = Object.fromEntries(
      goal.exercises.map((ex) => [ex.id, ex.gang_total]),
    );
    profileSnapshotRef.current = {
      profileXp: profile?.xp ?? 0,
      currentStreak: profile?.current_streak ?? 0,
      lastActiveOn: profile?.last_active_on ?? null,
    };
  }, [goal, profile?.xp, profile?.current_streak, profile?.last_active_on]);

  const segment = queue?.[segmentIndex] ?? null;

  const exerciseType = useMemo(
    () => (segment ? getCameraExerciseType(segment.exerciseName) : null),
    [segment],
  );
  const trackingMode: CameraTrackingMode | null = exerciseType
    ? getCameraTrackingMode(exerciseType)
    : null;
  const isHold = trackingMode === 'hold';
  const guide = exerciseType ? SETUP_GUIDES[exerciseType] : null;
  const targetAmount = segment?.targetAmount;

  useEffect(() => {
    let cancelled = false;

    async function resolveInitialStep() {
      setTrackedAmount(0);
      setDontShowSetupAgain(false);
      setIsSetupPreferenceReady(false);
      setUiRotation(0);
      setSaveError(null);
      autoFinishRef.current = false;
      savingRef.current = false;

      if (!exerciseType) {
        if (!cancelled) {
          setStep('setup');
          setIsSetupPreferenceReady(true);
        }
        return;
      }

      if (segmentIndex > 0) {
        if (!cancelled) {
          setStep('transition');
          setIsSetupPreferenceReady(true);
        }
        return;
      }

      const skipped = await isCameraSetupSkipped(exerciseType);
      if (cancelled) return;
      setStep(skipped ? 'active' : 'setup');
      setIsSetupPreferenceReady(true);
    }

    if (!segment) return;
    void resolveInitialStep();
    return () => {
      cancelled = true;
    };
  }, [segment, segmentIndex, exerciseType, cameraRemountKey]);

  useEffect(() => {
    if (step !== 'transition') return;

    const timer = setTimeout(() => {
      setStep('active');
    }, NEXT_EXERCISE_FLASH_MS);

    return () => clearTimeout(timer);
  }, [step, segmentIndex]);

  const finishWorkoutWithCelebrations = useCallback(() => {
    bootstrapSession();
    const currentGoal = goalSnapshotRef.current;
    if (!currentGoal || !savedAnyRef.current) {
      router.back();
      return;
    }

    const totalsAfter = buildDailyGoalTotalsAfter(currentGoal, runningUserTotalsRef.current);
    const resolved = resolvePostSaveCelebration({
      goal: currentGoal,
      totalsBefore: totalsBeforeRef.current,
      totalsAfter,
      xpAwarded: totalXpRef.current,
      ...profileSnapshotRef.current,
    });

    setStep('done');

    if (resolved.streakContinue) {
      if (resolved.celebration) setPendingCelebration(resolved.celebration);
      if (resolved.levelUp) setPendingLevelUp(resolved.levelUp);
      setStreakContinue(resolved.streakContinue);
      return;
    }
    if (resolved.celebration) {
      if (resolved.levelUp) setPendingLevelUp(resolved.levelUp);
      setCelebration(resolved.celebration);
      return;
    }
    if (resolved.levelUp) {
      setLevelUp(resolved.levelUp);
      return;
    }

    router.back();
  }, [bootstrapSession]);

  const persistSegment = useCallback(
    async (amount: number) => {
      bootstrapSession();
      if (!segment || !userId || !goalSnapshotRef.current) {
        throw new Error('Workout session is not ready');
      }

      if (!savedAnyRef.current && profile) {
        profileSnapshotRef.current = {
          profileXp: profile.xp ?? 0,
          currentStreak: profile.current_streak ?? 0,
          lastActiveOn: profile.last_active_on ?? null,
        };
      }

      const currentGoal = goalSnapshotRef.current;
      const baseExercise = currentGoal.exercises.find(
        (ex) => ex.id === segment.dailyGoalExerciseId,
      );
      if (!baseExercise) throw new Error('Exercise not found on daily goal');

      const delta = clampAmount(amount, segment.targetAmount);
      if (delta <= 0) throw new Error('Nothing to save for this set');

      const exerciseForSave: DailyGoalExerciseWithProgress = {
        ...baseExercise,
        user_total: runningUserTotalsRef.current[baseExercise.id] ?? baseExercise.user_total,
        gang_total: runningGangTotalsRef.current[baseExercise.id] ?? baseExercise.gang_total,
      };

      const result = await saveDailyGoalExerciseDelta({
        exercise: exerciseForSave,
        goal: currentGoal,
        delta,
        logActivity,
        userId,
      });

      runningUserTotalsRef.current[baseExercise.id] = exerciseForSave.user_total + delta;
      runningGangTotalsRef.current[baseExercise.id] = exerciseForSave.gang_total + delta;
      totalXpRef.current += result.xpAwarded;
      savedAnyRef.current = true;
    },
    [bootstrapSession, logActivity, profile, segment, userId],
  );

  const advanceAfterSave = useCallback(() => {
    bootstrapSession();
    let nextIndex = segmentIndex + 1;

    if (excludeCompletedExercises && queue) {
      const currentGoal = goalSnapshotRef.current;
      while (currentGoal && nextIndex < queue.length) {
        const nextSegment = queue[nextIndex];
        const nextExercise = currentGoal.exercises.find(
          (exercise) => exercise.id === nextSegment?.dailyGoalExerciseId,
        );
        if (!nextExercise) break;

        const userTotal =
          runningUserTotalsRef.current[nextExercise.id] ?? nextExercise.user_total;
        if (userTotal < nextExercise.individual_target) break;
        nextIndex += 1;
      }
    }

    if (!queue || nextIndex >= queue.length) {
      finishWorkoutWithCelebrations();
      return;
    }

    setSegmentIndex(nextIndex);
    setCameraRemountKey((key) => key + 1);
  }, [
    bootstrapSession,
    excludeCompletedExercises,
    finishWorkoutWithCelebrations,
    queue,
    segmentIndex,
  ]);

  const completeSegment = useCallback(
    async (rawAmount: number) => {
      if (!segment || savingRef.current) return;

      const amount = clampAmount(rawAmount, segment.targetAmount);
      if (amount <= 0) return;

      savingRef.current = true;
      setStep('saving');
      setSaveError(null);

      try {
        await persistSegment(amount);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        advanceAfterSave();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Could not save this set');
        setStep('error');
        autoFinishRef.current = false;
      } finally {
        savingRef.current = false;
      }
    },
    [advanceAfterSave, persistSegment, segment],
  );

  useEffect(() => {
    if (!segment || !targetAmount || step !== 'active') return;
    if (trackedAmount < targetAmount || autoFinishRef.current) return;

    autoFinishRef.current = true;
    void completeSegment(trackedAmount);
  }, [completeSegment, segment, step, targetAmount, trackedAmount]);

  async function handleStartCounting() {
    if (dontShowSetupAgain && exerciseType) {
      await setCameraSetupSkipped(exerciseType, true);
    }
    setStep('active');
  }

  function handleClose() {
    if (step === 'saving') return;
    if (savedAnyRef.current) {
      finishWorkoutWithCelebrations();
      return;
    }
    router.back();
  }

  function handleRetrySave() {
    void completeSegment(trackedAmount);
  }

  function handleSkipFailedSegment() {
    setSaveError(null);
    advanceAfterSave();
  }

  function handleSkipSegment() {
    if (savingRef.current) return;
    autoFinishRef.current = true;
    void Haptics.selectionAsync();
    advanceAfterSave();
  }

  if (isLoading || (!goal && !isError) || queue === null) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#22d3ee" size="large" />
          <Text style={{ color: '#94A3B8' }}>Loading workout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !goal) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>
            Could not load workout
          </Text>
          <TouchableOpacity
            onPress={() => void refetch()}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (queue.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>
            No camera exercises to work out
          </Text>
          <Text style={{ color: '#94A3B8', textAlign: 'center' }}>
            {excludeCompletedExercises
              ? 'Every camera-supported exercise with a target is already complete.'
              : 'Workout mode needs at least one camera-supported exercise with a target.'}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!nativeSupported) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <Header title="Workout mode" onClose={() => router.back()} insetsTop={insets.top} />
        <View style={styles.centered}>
          <Ionicons name="phone-portrait-outline" size={48} color={t.accent} />
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginTop: 16 }}>
            Dev client required
          </Text>
          <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            {repCounterUnsupportedMessage()}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!segment || !exerciseType || !guide || !trackingMode) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>
            Exercise not supported
          </Text>
          <TouchableOpacity onPress={handleClose} style={[styles.primaryBtn, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSetupPreferenceReady && step !== 'done' && step !== 'error' && step !== 'saving') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#22d3ee" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const progressLabel = formatWorkoutProgressLabel(segment);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#000' }]} edges={['bottom']}>
      <Header
        title={guide.title}
        subtitle={`Cycle ${segment.cycleIndex}/${segment.cycleCount}`}
        onClose={handleClose}
        insetsTop={insets.top}
        rightAction={
          step === 'active' ? (
            <View style={styles.activeHeaderActions}>
              <TouchableOpacity
                onPress={() => setIsHintModalVisible(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Show camera setup hints"
              >
                <Ionicons name="help-circle-outline" size={26} color="#F8FAFC" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setUiRotation((current) => nextCameraUiRotation(current));
                  void Haptics.selectionAsync();
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={
                  uiRotation === 0
                    ? 'Rotate UI sideways for floor exercises'
                    : 'Rotate UI upright'
                }
              >
                <Ionicons
                  name={
                    uiRotation === 0 ? 'phone-landscape-outline' : 'phone-portrait-outline'
                  }
                  size={24}
                  color={uiRotation === 0 ? '#F8FAFC' : '#22d3ee'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSkipSegment}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Skip this exercise"
              >
                <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 16 }}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep('review')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={isHold ? 'Finish hold early' : 'Finish set early'}
              >
                <Text style={{ color: '#22d3ee', fontWeight: '700', fontSize: 16 }}>Finish</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'setup' || step === 'transition' ? (
            <TouchableOpacity
              onPress={handleSkipSegment}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip this exercise"
            >
              <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 16 }}>Skip</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {step === 'setup' ? (
        <View style={styles.setupBody}>
          <ExerciseSetupGuide
            exerciseType={exerciseType}
            guide={guide}
            dontShowAgain={dontShowSetupAgain}
            onDontShowAgainChange={setDontShowSetupAgain}
          />
          <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
            {progressLabel}
          </Text>
          <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
            {isHold
              ? `Hold for ${formatHoldReview(segment.targetAmount)}${segment.targetAmount >= 60 ? '' : ' seconds'}`
              : `Count ${segment.targetAmount} ${guide.title.toLowerCase()}`}
          </Text>
          <TouchableOpacity
            onPress={() => {
              void handleStartCounting();
            }}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Ionicons name="play" size={18} color={t.accentOnPrimary} />
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700', fontSize: 16 }}>
              {isHold ? 'Start hold' : 'Start counting'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSkipSegment}
            style={styles.skipTextBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip this exercise"
          >
            <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 15 }}>
              Skip this exercise
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {step === 'transition' ? (
        <View style={styles.transitionBody}>
          <Text style={styles.transitionEyebrow}>
            {segment.cycleIndex > 1 &&
            queue[segmentIndex - 1]?.cycleIndex !== segment.cycleIndex
              ? `CYCLE ${segment.cycleIndex} OF ${segment.cycleCount}`
              : 'UP NEXT'}
          </Text>
          <Ionicons
            name={isHold ? 'timer-outline' : 'fitness-outline'}
            size={52}
            color="#22d3ee"
          />
          <Text style={styles.transitionTitle}>{segment.exerciseName}</Text>
          <Text style={styles.transitionTarget}>
            {isHold
              ? `Hold for ${formatHoldReview(segment.targetAmount)}${
                  segment.targetAmount >= 60 ? '' : ' seconds'
                }`
              : `${segment.targetAmount} reps`}
          </Text>
          <Text style={styles.transitionHint}>Camera starts automatically</Text>
        </View>
      ) : null}

      {step === 'active' ? (
        <View style={styles.cameraBody}>
          <Suspense
            fallback={
              <View style={styles.centered}>
                <ActivityIndicator color="#22d3ee" size="large" />
              </View>
            }
          >
            {isHold ? (
              <HoldCounterCamera
                key={`hold-${cameraRemountKey}`}
                targetSeconds={segment.targetAmount}
                initialElapsedSeconds={0}
                onElapsedChange={setTrackedAmount}
                uiRotation={uiRotation}
              />
            ) : (
              <RepCounterCamera
                key={`reps-${cameraRemountKey}`}
                exerciseType={exerciseType as CameraExerciseType}
                onRepCountChange={setTrackedAmount}
                targetReps={segment.targetAmount}
                requirePermission
                uiRotation={uiRotation}
              />
            )}
          </Suspense>
        </View>
      ) : null}

      {step === 'review' ? (
        <View style={styles.reviewBody}>
          <Text style={styles.reviewCount}>
            {isHold ? formatHoldReview(trackedAmount) : trackedAmount}
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '600' }}>
            {isHold ? 'seconds held' : 'reps counted'}
          </Text>
          <Text style={{ color: '#CBD5E1', textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
            Save this set and continue the workout? Target was{' '}
            {isHold
              ? `${formatHoldReview(segment.targetAmount)}s`
              : `${segment.targetAmount} reps`}
            .
          </Text>
          <View style={styles.reviewActions}>
            <TouchableOpacity
              onPress={() => setStep('active')}
              style={[styles.secondaryBtn, { borderColor: t.buttonBorder, flex: 1 }]}
            >
              <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Keep going</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void completeSegment(trackedAmount)}
              disabled={trackedAmount <= 0}
              style={[
                styles.primaryBtn,
                { backgroundColor: trackedAmount > 0 ? t.accent : '#334155', flex: 1 },
              ]}
            >
              <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>
                Save & continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {step === 'saving' ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#22d3ee" size="large" />
          <Text style={{ color: '#94A3B8' }}>Saving set…</Text>
        </View>
      ) : null}

      {step === 'error' ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color="#F87171" />
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontWeight: '700' }}>
            Save failed
          </Text>
          <Text style={{ color: '#94A3B8', textAlign: 'center', lineHeight: 22 }}>
            {saveError ?? 'Could not save this set. Retry to keep your progress.'}
          </Text>
          <TouchableOpacity
            onPress={handleRetrySave}
            style={[styles.primaryBtn, { backgroundColor: t.accent, alignSelf: 'stretch' }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Retry save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSkipFailedSegment}
            style={[styles.secondaryBtn, { borderColor: t.buttonBorder, alignSelf: 'stretch' }]}
          >
            <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>Skip this set</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={{ padding: 12 }}>
            <Text style={{ color: '#94A3B8', fontWeight: '600' }}>End workout</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={isHintModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsHintModalVisible(false)}
      >
        <SafeAreaView style={styles.hintModalSafe} edges={['top', 'bottom']}>
          <View style={styles.hintModalHeader}>
            <Text style={styles.hintModalTitle}>Camera hints</Text>
            <TouchableOpacity
              onPress={() => setIsHintModalVisible(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close camera hints"
            >
              <Ionicons name="close" size={28} color="#F8FAFC" />
            </TouchableOpacity>
          </View>
          <View style={styles.hintModalBody}>
            {isHintModalVisible ? (
              <ExerciseSetupGuide exerciseType={exerciseType} guide={guide} />
            ) : null}
            <TouchableOpacity
              onPress={() => setIsHintModalVisible(false)}
              style={[styles.primaryBtn, { backgroundColor: t.accent }]}
            >
              <Text style={{ color: t.accentOnPrimary, fontWeight: '700', fontSize: 16 }}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {streakContinue ? (
        <StreakContinueOverlay
          visible
          fromDays={streakContinue.fromDays}
          toDays={streakContinue.toDays}
          onDismiss={() => {
            setStreakContinue(null);
            if (pendingCelebration) {
              setCelebration(pendingCelebration);
              setPendingCelebration(null);
              return;
            }
            if (pendingLevelUp) {
              setLevelUp(pendingLevelUp);
              setPendingLevelUp(null);
              return;
            }
            router.back();
          }}
        />
      ) : null}

      {celebration && !streakContinue ? (
        <GoalCompleteOverlay
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
              return;
            }
            router.back();
          }}
        />
      ) : null}

      {levelUp && !celebration && !streakContinue ? (
        <LevelUpOverlay
          visible
          fromLevel={levelUp.fromLevel}
          toLevel={levelUp.toLevel}
          onDismiss={() => {
            setLevelUp(null);
            router.back();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Header({
  title,
  subtitle,
  onClose,
  rightAction,
  insetsTop,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  rightAction?: ReactNode;
  insetsTop: number;
}) {
  return (
    <View style={[styles.header, { paddingTop: insetsTop + 8 }]}>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={28} color="#F8FAFC" />
      </TouchableOpacity>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ?? <View style={{ width: 56 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(5, 7, 15, 0.85)',
    zIndex: 10,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  activeHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  setupBody: {
    flex: 1,
    padding: 20,
    gap: 16,
    backgroundColor: '#05070F',
  },
  hintModalSafe: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  hintModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  hintModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  hintModalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  cameraBody: {
    flex: 1,
  },
  transitionBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#05070F',
  },
  transitionEyebrow: {
    color: '#22d3ee',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  transitionTitle: {
    color: '#F8FAFC',
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  transitionTarget: {
    color: '#CBD5E1',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  transitionHint: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
  },
  skipTextBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  reviewBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#05070F',
  },
  reviewCount: {
    color: '#F8FAFC',
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 76,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    width: '100%',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(14, 21, 36, 0.9)',
  },
});
