import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import {
  GoalCompleteOverlay,
  type GoalCompleteExerciseTarget,
} from '@/components/goal-complete-overlay';
import { LevelUpOverlay } from '@/components/level-up-overlay';
import { DailyGoalCard as DailyGoalCardView } from '@/components/ui/daily-goal-card';
import {
  useLogActivity,
  type ActivitySaveResult,
} from '@/hooks/use-activities';
import { useProfile } from '@/hooks/use-profile';
import { formatGoalDate, timeLeftUntilDateEnd } from '@/lib/format';
import {
  buildDailyGoalTotalsAfter,
  resolvePostSaveCelebration,
} from '@/lib/daily-goal-celebration';
import {
  buildRepCounterSessionKey,
  consumePendingRepCount,
  serializeRepCounterQueue,
} from '@/lib/rep-counting/pending-result';
import { supportsCameraTracking } from '@/lib/rep-counting/exercise-registry';
import type { DailyGoalExerciseWithProgress, DailyGoalWithProgress } from '@/types';

interface DailyGoalCardProps {
  goal: DailyGoalWithProgress;
  loggable?: boolean;
  /** Camera-first flow: per-exercise perform buttons and auto-save counted reps. */
  cameraActions?: boolean;
  /** When set, celebrations render on the parent screen instead of inside the card. */
  onActivitySaved?: (input: {
    goal: DailyGoalWithProgress;
    totalsBefore: number[];
    totalsAfter: number[];
    xpAwarded: number;
  }) => void;
}

async function saveCameraReps(
  ex: DailyGoalExerciseWithProgress,
  goal: DailyGoalWithProgress,
  reps: number,
  logActivity: ReturnType<typeof useLogActivity>,
): Promise<ActivitySaveResult> {
  return saveExerciseAmount(ex, goal, ex.user_total + reps, logActivity);
}

async function saveExerciseAmount(
  ex: DailyGoalExerciseWithProgress,
  goal: DailyGoalWithProgress,
  userTotalAfter: number,
  logActivity: ReturnType<typeof useLogActivity>,
): Promise<ActivitySaveResult> {
  const userTotalBefore = ex.user_total;
  const added = userTotalAfter - userTotalBefore;
  const gangTotalBefore = ex.gang_total;
  const gangTotalAfter = ex.gang_total + added;

  return logActivity.mutateAsync({
    gangId: goal.gang_id,
    dailyGoalId: goal.id,
    dailyGoalExerciseId: ex.id,
    exerciseId: ex.exercise_id,
    exerciseName: ex.exercise_name,
    category: goal.day_category ?? undefined,
    unit: ex.unit,
    amount: userTotalAfter,
    questXpContext: {
      gangId: goal.gang_id,
      gangTarget: ex.gang_target,
      individualTarget: ex.individual_target,
      gangTotalBefore,
      gangTotalAfter,
      userTotalBefore,
      userTotalAfter,
    },
  });
}

/** Daily goal card wired to weekly plan data from the API. */
export function DailyGoalCard({
  goal,
  loggable = true,
  cameraActions = false,
  onActivitySaved,
}: DailyGoalCardProps) {
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
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [pendingLevelUp, setPendingLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(
    null,
  );
  const processingPendingRepsRef = useRef(false);

  const notifyActivitySaved = useCallback(
    (
      savedGoal: DailyGoalWithProgress,
      totalsBefore: number[],
      totalsAfter: number[],
      xpAwarded: number,
    ) => {
      const parentHandler = onActivitySavedRef.current;
      if (parentHandler) {
        parentHandler({
          goal: savedGoal,
          totalsBefore,
          totalsAfter,
          xpAwarded,
        });
        return;
      }

      const { celebration: nextCelebration, levelUp: nextLevelUp } = resolvePostSaveCelebration({
        goal: savedGoal,
        totalsBefore,
        totalsAfter,
        xpAwarded,
        profileXp: profile?.xp ?? 0,
      });

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
    [profile?.xp],
  );

  const handlePendingReps = useCallback(async () => {
    if (processingPendingRepsRef.current) return;
    processingPendingRepsRef.current = true;

    const currentGoal = goalRef.current;
    const totalsBefore = currentGoal.exercises.map((ex) => ex.user_total);
    const totalsAfterUpdates: Record<string, number> = {};
    let totalXpAwarded = 0;
    let savedAny = false;

    try {
      for (const ex of currentGoal.exercises) {
        if (!supportsCameraTracking(ex.exercise_name, ex.unit)) continue;

        const sessionKey = buildRepCounterSessionKey(ex.exercise_id, currentGoal.id);
        const pending = consumePendingRepCount(sessionKey);
        if (pending === null || pending <= 0) continue;

        setSavingExerciseId(ex.id);
        try {
          const result = await saveCameraReps(ex, currentGoal, pending, logActivity);
          totalsAfterUpdates[ex.id] = ex.user_total + pending;
          totalXpAwarded += result.xpAwarded;
          savedAny = true;
        } finally {
          setSavingExerciseId(null);
        }
      }

      if (savedAny) {
        notifyActivitySaved(
          currentGoal,
          totalsBefore,
          buildDailyGoalTotalsAfter(currentGoal, totalsAfterUpdates),
          totalXpAwarded,
        );
      }
    } finally {
      processingPendingRepsRef.current = false;
    }
  }, [logActivity, notifyActivitySaved]);

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
    const currentGoal = goalRef.current;
    const totalsBefore = currentGoal.exercises.map((e) => e.user_total);
    const userTotalAfter = ex.user_total + addedAmount;

    setSavingExerciseId(ex.id);
    try {
      const result = await saveExerciseAmount(ex, currentGoal, userTotalAfter, logActivity);
      notifyActivitySaved(
        currentGoal,
        totalsBefore,
        buildDailyGoalTotalsAfter(currentGoal, { [ex.id]: userTotalAfter }),
        result.xpAwarded,
      );
    } finally {
      setSavingExerciseId(null);
    }
  }

  const useCameraFlow = cameraActions && loggable;
  const renderLocalOverlays = !onActivitySaved;

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

      {renderLocalOverlays && celebration ? (
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

      {renderLocalOverlays && levelUp && !celebration ? (
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
