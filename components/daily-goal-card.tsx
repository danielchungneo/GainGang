import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  GoalCompleteOverlay,
  type GoalCompleteExerciseTarget,
} from '@/components/goal-complete-overlay';
import { LevelUpOverlay } from '@/components/level-up-overlay';
import { DailyGoalCard as DailyGoalCardView } from '@/components/ui/daily-goal-card';
import {
  fetchPersonalGoalAwardedExerciseIds,
  useLogActivity,
  type ActivitySaveResult,
} from '@/hooks/use-activities';
import { useProfile } from '@/hooks/use-profile';
import { formatGoalDate, timeLeftUntilDateEnd } from '@/lib/format';
import {
  buildRepCounterSessionKey,
  consumePendingRepCount,
} from '@/lib/rep-counting/pending-result';
import { supportsCameraRepCounting } from '@/lib/rep-counting/exercise-registry';
import {
  getLevelUpInfo,
  type DailyGoalExerciseWithProgress,
  type DailyGoalWithProgress,
} from '@/types';

interface DailyGoalCardProps {
  goal: DailyGoalWithProgress;
  loggable?: boolean;
  /** Camera-first flow: per-exercise perform buttons and auto-save counted reps. */
  cameraActions?: boolean;
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

function buildTotalsAfter(
  goal: DailyGoalWithProgress,
  updates: Record<string, number>,
): number[] {
  return goal.exercises.map((ex) => updates[ex.id] ?? ex.user_total);
}

function isDailyGoalNewlyComplete(
  goal: DailyGoalWithProgress,
  totalsBefore: number[],
  totalsAfter: number[],
  awardedIdsBefore: Set<string>,
): boolean {
  const isExerciseMet = (ex: DailyGoalExerciseWithProgress, total: number) =>
    ex.individual_target > 0 && total >= ex.individual_target;

  const allCompleteBefore = goal.exercises.every(
    (ex, i) => awardedIdsBefore.has(ex.id) || isExerciseMet(ex, totalsBefore[i]),
  );
  const allCompleteAfter = goal.exercises.every((ex, i) =>
    isExerciseMet(ex, totalsAfter[i]),
  );

  return allCompleteAfter && !allCompleteBefore;
}

/** Daily goal card wired to weekly plan data from the API. */
export function DailyGoalCard({
  goal,
  loggable = true,
  cameraActions = false,
}: DailyGoalCardProps) {
  const logActivity = useLogActivity();
  const { data: profile } = useProfile();
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

  const showPostSaveCelebrations = useCallback(
    (
      totalsBefore: number[],
      totalsAfter: number[],
      awardedIdsBefore: Set<string>,
      xpAwarded: number,
    ) => {
      const levelUpInfo = getLevelUpInfo(profile?.xp ?? 0, xpAwarded);

      if (isDailyGoalNewlyComplete(goal, totalsBefore, totalsAfter, awardedIdsBefore)) {
        const exercises: GoalCompleteExerciseTarget[] = goal.exercises.map((ex, i) => ({
          name: ex.exercise_name,
          unit: ex.unit,
          from: totalsBefore[i],
          target: ex.individual_target,
        }));

        if (levelUpInfo) setPendingLevelUp(levelUpInfo);
        setCelebration({
          title: formatGoalDate(goal.goal_date),
          xpEarned: xpAwarded,
          exercises,
        });
        setCelebrationKey((k) => k + 1);
        return;
      }

      if (levelUpInfo) {
        setLevelUp(levelUpInfo);
        setLevelUpKey((k) => k + 1);
      }
    },
    [goal, profile?.xp],
  );

  const handlePendingReps = useCallback(
    async (exerciseGoalId?: string) => {
      const totalsBefore = goal.exercises.map((ex) => ex.user_total);
      const totalsAfterUpdates: Record<string, number> = {};
      let totalXpAwarded = 0;
      let savedAny = false;

      const awardedIdsBefore = await fetchPersonalGoalAwardedExerciseIds(
        goal.exercises.map((ex) => ex.id),
      );

      for (const ex of goal.exercises) {
        if (exerciseGoalId && ex.id !== exerciseGoalId) continue;
        if (!supportsCameraRepCounting(ex.exercise_name) || ex.unit !== 'reps') continue;

        const sessionKey = buildRepCounterSessionKey(ex.exercise_id, goal.id);
        const pending = consumePendingRepCount(sessionKey);
        if (pending === null || pending <= 0) continue;

        setSavingExerciseId(ex.id);
        try {
          const result = await saveCameraReps(ex, goal, pending, logActivity);
          totalsAfterUpdates[ex.id] = ex.user_total + pending;
          totalXpAwarded += result.xpAwarded;
          savedAny = true;
        } finally {
          setSavingExerciseId(null);
        }
      }

      if (savedAny) {
        showPostSaveCelebrations(
          totalsBefore,
          buildTotalsAfter(goal, totalsAfterUpdates),
          awardedIdsBefore,
          totalXpAwarded,
        );
      }
    },
    [goal, logActivity, showPostSaveCelebrations],
  );

  useFocusEffect(
    useCallback(() => {
      if (!cameraActions || !loggable) return;
      void handlePendingReps();
    }, [cameraActions, loggable, handlePendingReps]),
  );

  function openRepCounter(ex: DailyGoalExerciseWithProgress) {
    const sessionKey = buildRepCounterSessionKey(ex.exercise_id, goal.id);
    router.push({
      pathname: '/rep-counter',
      params: {
        exerciseId: ex.exercise_id,
        exerciseName: ex.exercise_name,
        sessionKey,
        contextId: goal.id,
      },
    });
  }

  async function handleManualLog(ex: DailyGoalExerciseWithProgress, addedAmount: number) {
    const totalsBefore = goal.exercises.map((e) => e.user_total);
    const userTotalAfter = ex.user_total + addedAmount;

    setSavingExerciseId(ex.id);
    try {
      const awardedIdsBefore = await fetchPersonalGoalAwardedExerciseIds(
        goal.exercises.map((e) => e.id),
      );
      const result = await saveExerciseAmount(ex, goal, userTotalAfter, logActivity);
      showPostSaveCelebrations(
        totalsBefore,
        buildTotalsAfter(goal, { [ex.id]: userTotalAfter }),
        awardedIdsBefore,
        result.xpAwarded,
      );
    } finally {
      setSavingExerciseId(null);
    }
  }

  const useCameraFlow = cameraActions && loggable;

  return (
    <>
      <DailyGoalCardView
        kind={goal.gang_name?.toUpperCase() ?? 'DAILY GOAL'}
        title={formatGoalDate(goal.goal_date)}
        timeLeft={timeLeftUntilDateEnd(goal.goal_date)}
        showProgressToggle={useCameraFlow}
        showIndividual={!useCameraFlow}
        exercises={goal.exercises.map((e) => {
          const cameraSupported =
            e.unit === 'reps' && supportsCameraRepCounting(e.exercise_name);

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
            }
          }}
        />
      ) : null}

      {levelUp && !celebration ? (
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
