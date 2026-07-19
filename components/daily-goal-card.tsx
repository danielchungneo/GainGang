import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import {
  GoalCompleteOverlay,
  type GoalCompleteExerciseTarget,
} from '@/components/goal-complete-overlay';
import { LevelUpOverlay } from '@/components/level-up-overlay';
import { StreakContinueOverlay } from '@/components/streak-continue-overlay';
import { DailyGoalCard as DailyGoalCardView } from '@/components/ui/daily-goal-card';
import { useLogActivity } from '@/hooks/use-activities';
import { useAuth } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { formatGoalDate, timeLeftUntilDateEnd } from '@/lib/format';
import {
  buildDailyGoalTotalsAfter,
  resolvePostSaveCelebration,
  type DailyGoalSaveCelebrationInput,
  type StreakContinuePayload,
} from '@/lib/daily-goal-celebration';
import {
  saveDailyGoalExerciseAmount,
  saveDailyGoalExerciseDelta,
} from '@/lib/daily-goal-save';
import {
  buildRepCounterSessionKey,
  consumePendingRepCount,
  serializeRepCounterQueue,
} from '@/lib/rep-counting/pending-result';
import { supportsCameraTracking } from '@/lib/rep-counting/exercise-registry';
import {
  getAvailableWorkoutCycles,
  getWorkoutEligibleExercises,
  type WorkoutModeOptions,
} from '@/lib/rep-counting/workout-mode';
import type { DailyGoalExerciseWithProgress, DailyGoalWithProgress } from '@/types';

interface DailyGoalCardProps {
  goal: DailyGoalWithProgress;
  loggable?: boolean;
  /** Camera-first flow: per-exercise perform buttons and auto-save counted reps. */
  cameraActions?: boolean;
  /** When set, celebrations render on the parent screen instead of inside the card. */
  onActivitySaved?: (input: DailyGoalSaveCelebrationInput) => void;
}

/** Daily goal card wired to weekly plan data from the API. */
export function DailyGoalCard({
  goal,
  loggable = true,
  cameraActions = false,
  onActivitySaved,
}: DailyGoalCardProps) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const logActivity = useLogActivity();
  const { data: profile } = useProfile();
  const goalRef = useRef(goal);
  goalRef.current = goal;

  const onActivitySavedRef = useRef(onActivitySaved);
  onActivitySavedRef.current = onActivitySaved;

  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    title: string;
    xpEarned: number;
    exercises: GoalCompleteExerciseTarget[];
  } | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [streakContinue, setStreakContinue] = useState<StreakContinuePayload | null>(null);
  const [streakKey, setStreakKey] = useState(0);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [pendingCelebration, setPendingCelebration] = useState<{
    title: string;
    xpEarned: number;
    exercises: GoalCompleteExerciseTarget[];
  } | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(
    null,
  );
  const processingPendingRepsRef = useRef(false);

  const notifyActivitySaved = useCallback(
    (input: DailyGoalSaveCelebrationInput) => {
      const parentHandler = onActivitySavedRef.current;
      if (parentHandler) {
        parentHandler(input);
        return;
      }

      const { celebration: nextCelebration, levelUp: nextLevelUp, streakContinue: nextStreak } =
        resolvePostSaveCelebration(input);

      if (nextStreak) {
        if (nextCelebration) setPendingCelebration(nextCelebration);
        if (nextLevelUp) setPendingLevelUp(nextLevelUp);
        setStreakContinue(nextStreak);
        setStreakKey((k) => k + 1);
        return;
      }

      if (nextCelebration) {
        if (nextLevelUp) setPendingLevelUp(nextLevelUp);
        setCelebration(nextCelebration);
        setCelebrationKey((k) => k + 1);
        return;
      }

      if (nextLevelUp) {
        setLevelUp(nextLevelUp);
        setLevelUpKey((k) => k + 1);
      }
    },
    [],
  );

  const handlePendingReps = useCallback(async () => {
    if (processingPendingRepsRef.current) return;
    if (!userId) return;
    processingPendingRepsRef.current = true;

    const currentGoal = goalRef.current;
    const totalsBefore = currentGoal.exercises.map((ex) => ex.user_total);
    const totalsAfterUpdates: Record<string, number> = {};
    let totalXpAwarded = 0;
    let savedAny = false;

    // Snapshot before saves — post-save profile refetch would skip the streak overlay.
    const profileSnapshot = {
      profileXp: profile?.xp ?? 0,
      currentStreak: profile?.current_streak ?? 0,
      lastActiveOn: profile?.last_active_on ?? null,
    };

    try {
      for (const ex of currentGoal.exercises) {
        if (!supportsCameraTracking(ex.exercise_name, ex.unit)) continue;

        const sessionKey = buildRepCounterSessionKey(ex.exercise_id, currentGoal.id);
        const pending = consumePendingRepCount(sessionKey);
        if (pending === null || pending <= 0) continue;

        setSavingExerciseId(ex.id);
        try {
          const result = await saveDailyGoalExerciseDelta({
            exercise: ex,
            goal: currentGoal,
            delta: pending,
            logActivity,
            userId,
          });
          totalsAfterUpdates[ex.id] = ex.user_total + pending;
          totalXpAwarded += result.xpAwarded;
          savedAny = true;
        } finally {
          setSavingExerciseId(null);
        }
      }

      if (savedAny) {
        notifyActivitySaved({
          goal: currentGoal,
          totalsBefore,
          totalsAfter: buildDailyGoalTotalsAfter(currentGoal, totalsAfterUpdates),
          xpAwarded: totalXpAwarded,
          ...profileSnapshot,
        });
      }
    } finally {
      processingPendingRepsRef.current = false;
    }
  }, [
    logActivity,
    notifyActivitySaved,
    profile?.xp,
    profile?.current_streak,
    profile?.last_active_on,
    userId,
  ]);

  const handlePendingRepsRef = useRef(handlePendingReps);
  handlePendingRepsRef.current = handlePendingReps;

  useFocusEffect(
    useCallback(() => {
      if (!cameraActions || !loggable) return;
      void handlePendingRepsRef.current();
    }, [cameraActions, loggable]),
  );

  function openRepCounter(ex: DailyGoalExerciseWithProgress) {
    const sessionKey = buildRepCounterSessionKey(ex.exercise_id, goal.id);
    const cameraExercises = goal.exercises.filter((e) =>
      supportsCameraTracking(e.exercise_name, e.unit),
    );
    const currentIndex = cameraExercises.findIndex((e) => e.id === ex.id);
    const nextQueue = cameraExercises.slice(currentIndex + 1).map((e) => ({
      exerciseId: e.exercise_id,
      exerciseName: e.exercise_name,
      unit: e.unit,
      targetSeconds: e.unit === 'seconds' ? e.individual_target : undefined,
    }));

    router.push({
      pathname: '/rep-counter',
      params: {
        exerciseId: ex.exercise_id,
        exerciseName: ex.exercise_name,
        sessionKey,
        contextId: goal.id,
        unit: ex.unit,
        ...(ex.unit === 'seconds'
          ? { targetSeconds: String(ex.individual_target) }
          : {}),
        ...(nextQueue.length > 0
          ? { exerciseQueue: serializeRepCounterQueue(nextQueue) }
          : {}),
      },
    });
  }

  async function handleManualLog(ex: DailyGoalExerciseWithProgress, addedAmount: number) {
    if (!userId) return;
    const currentGoal = goalRef.current;
    const totalsBefore = currentGoal.exercises.map((e) => e.user_total);
    const userTotalAfter = ex.user_total + addedAmount;

    // Snapshot before save — post-save profile refetch would skip the streak overlay.
    const profileSnapshot = {
      profileXp: profile?.xp ?? 0,
      currentStreak: profile?.current_streak ?? 0,
      lastActiveOn: profile?.last_active_on ?? null,
    };

    setSavingExerciseId(ex.id);
    try {
      const result = await saveDailyGoalExerciseAmount({
        exercise: ex,
        goal: currentGoal,
        userTotalAfter,
        logActivity,
        userId,
      });
      notifyActivitySaved({
        goal: currentGoal,
        totalsBefore,
        totalsAfter: buildDailyGoalTotalsAfter(currentGoal, { [ex.id]: userTotalAfter }),
        xpAwarded: result.xpAwarded,
        ...profileSnapshot,
      });
    } finally {
      setSavingExerciseId(null);
    }
  }

  function openWorkoutMode(cycles: number, options: WorkoutModeOptions) {
    router.push({
      pathname: '/rep-counter',
      params: {
        mode: 'workout',
        dailyGoalId: goal.id,
        cycles: String(cycles),
        excludeCompletedExercises: options.excludeCompletedExercises ? '1' : '0',
        contextId: goal.id,
      },
    });
  }

  const useCameraFlow = cameraActions && loggable;
  const renderLocalOverlays = !onActivitySaved;
  const workoutEligible = getWorkoutEligibleExercises(goal.exercises);
  const workoutCycleOptions = useCameraFlow
    ? getAvailableWorkoutCycles(goal.exercises)
    : [];
  const workoutExcludeCompletedCycleOptions = useCameraFlow
    ? getAvailableWorkoutCycles(goal.exercises, { excludeCompletedExercises: true })
    : [];
  const workoutSkippedCount = useCameraFlow
    ? goal.exercises.length - workoutEligible.length
    : 0;

  return (
    <>
      <DailyGoalCardView
        kind={goal.gang_name?.toUpperCase() ?? 'DAILY GOAL'}
        title={formatGoalDate(goal.goal_date)}
        timeLeft={timeLeftUntilDateEnd(goal.goal_date)}
        showProgressToggle={useCameraFlow}
        showIndividual={!useCameraFlow}
        exercises={goal.exercises.map((e) => {
          const cameraSupported = supportsCameraTracking(e.exercise_name, e.unit);

          return {
            key: e.id,
            name: e.exercise_name,
            unit: e.unit,
            gang: { current: e.gang_total, target: e.gang_target },
            individual: { current: e.user_total, target: e.individual_target },
            cameraSupported,
            onPerform:
              useCameraFlow && cameraSupported
                ? () => openRepCounter(e)
                : undefined,
            isPerforming: savingExerciseId === e.id,
            onManualLog:
              useCameraFlow && !cameraSupported
                ? (amount) => handleManualLog(e, amount)
                : undefined,
            isManualLogging: savingExerciseId === e.id,
          };
        })}
        workoutCycleOptions={workoutCycleOptions}
        workoutExcludeCompletedCycleOptions={workoutExcludeCompletedCycleOptions}
        workoutSkippedCount={workoutSkippedCount}
        onStartWorkout={
          useCameraFlow && workoutCycleOptions.length > 0
            ? openWorkoutMode
            : undefined
        }
        ctaLabel={
          !useCameraFlow && loggable
            ? goal.exercises.some((e) => e.user_total > 0)
              ? 'UPDATE ACTIVITY'
              : 'LOG ACTIVITY'
            : undefined
        }
        onPressCta={
          !useCameraFlow && loggable
            ? () =>
                router.push({
                  pathname: '/log-daily-goal',
                  params: { dailyGoalId: goal.id, gangId: goal.gang_id },
                })
            : undefined
        }
      />

      {renderLocalOverlays && streakContinue ? (
        <StreakContinueOverlay
          key={streakKey}
          visible
          fromDays={streakContinue.fromDays}
          toDays={streakContinue.toDays}
          onDismiss={() => {
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
            }
          }}
        />
      ) : null}

      {renderLocalOverlays && celebration && !streakContinue ? (
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
            }
          }}
        />
      ) : null}

      {renderLocalOverlays && levelUp && !celebration && !streakContinue ? (
        <LevelUpOverlay
          key={levelUpKey}
          visible
          fromLevel={levelUp.fromLevel}
          toLevel={levelUp.toLevel}
          onDismiss={() => setLevelUp(null)}
        />
      ) : null}
    </>
  );
}
