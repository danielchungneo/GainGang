import type { useLogActivity, ActivitySaveResult } from '@/hooks/use-activities';
import { fanOutDailyGoalExerciseDelta } from '@/lib/daily-goal-cross-gang';
import type { DailyGoalExerciseWithProgress, DailyGoalWithProgress } from '@/types';

type LogActivityMutation = ReturnType<typeof useLogActivity>;

/**
 * Persist a new absolute user total for one daily-goal exercise, then mirror
 * the delta to sibling gangs. Used by camera auto-save and workout segments.
 */
export async function saveDailyGoalExerciseAmount(input: {
  exercise: DailyGoalExerciseWithProgress;
  goal: DailyGoalWithProgress;
  userTotalAfter: number;
  logActivity: LogActivityMutation;
  userId: string;
}): Promise<ActivitySaveResult> {
  const { exercise: ex, goal, userTotalAfter, logActivity, userId } = input;
  const userTotalBefore = ex.user_total;
  const added = userTotalAfter - userTotalBefore;
  const gangTotalBefore = ex.gang_total;
  const gangTotalAfter = ex.gang_total + added;

  const primary = await logActivity.mutateAsync({
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

  const siblingXp = await fanOutDailyGoalExerciseDelta({
    userId,
    sourceDailyGoalId: goal.id,
    sourceExercise: ex,
    delta: added,
    goalDate: goal.goal_date,
    category: goal.day_category ?? undefined,
    logActivity,
  });

  return {
    ...primary,
    xpAwarded: primary.xpAwarded + siblingXp,
  };
}

/** Add a camera/workout delta on top of the exercise's current user total. */
export async function saveDailyGoalExerciseDelta(input: {
  exercise: DailyGoalExerciseWithProgress;
  goal: DailyGoalWithProgress;
  delta: number;
  logActivity: LogActivityMutation;
  userId: string;
}): Promise<ActivitySaveResult> {
  return saveDailyGoalExerciseAmount({
    exercise: input.exercise,
    goal: input.goal,
    userTotalAfter: input.exercise.user_total + input.delta,
    logActivity: input.logActivity,
    userId: input.userId,
  });
}
