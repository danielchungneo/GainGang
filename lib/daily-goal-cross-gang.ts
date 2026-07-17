import type {
  ActivitySaveResult,
  LogActivityInput,
} from '@/hooks/use-activities';
import { fetchMyTodaysDailyGoals } from '@/hooks/use-weekly-plans';
import { todayISO } from '@/lib/format';
import { normalizeExerciseName } from '@/lib/rep-counting/exercise-registry';
import type {
  DailyGoalExerciseWithProgress,
  DailyGoalWithProgress,
  ExerciseCategory,
  ExerciseUnit,
} from '@/types';

interface LogActivityMutator {
  mutateAsync: (input: LogActivityInput) => Promise<ActivitySaveResult>;
}

interface MatchableExercise {
  id: string;
  exercise_id: string;
  exercise_name: string;
  unit: ExerciseUnit;
}

/** True when two daily-goal exercises represent the same movement + unit. */
export function dailyGoalExercisesMatch(a: MatchableExercise, b: MatchableExercise): boolean {
  if (a.unit !== b.unit) return false;
  if (a.exercise_id && b.exercise_id && a.exercise_id === b.exercise_id) return true;
  return normalizeExerciseName(a.exercise_name) === normalizeExerciseName(b.exercise_name);
}

export interface MatchingDailyGoalExercise {
  goal: DailyGoalWithProgress;
  exercise: DailyGoalExerciseWithProgress;
}

/** Find the same exercise on other gangs' daily goals for the same calendar day. */
export function findMatchingDailyGoalExercises(
  goals: DailyGoalWithProgress[],
  source: {
    dailyGoalId: string;
    exercise: MatchableExercise;
  },
): MatchingDailyGoalExercise[] {
  const matches: MatchingDailyGoalExercise[] = [];

  for (const goal of goals) {
    if (goal.id === source.dailyGoalId) continue;
    for (const exercise of goal.exercises) {
      if (exercise.id === source.exercise.id) continue;
      if (!dailyGoalExercisesMatch(source.exercise, exercise)) continue;
      matches.push({ goal, exercise });
    }
  }

  return matches;
}

/**
 * Apply the same amount delta to matching exercises on the user's other gang
 * daily goals for today. Skips flat activity-log XP so logging once does not
 * award N× the base XP; personal/gang milestone XP still applies per goal.
 */
export async function fanOutDailyGoalExerciseDelta(input: {
  userId: string;
  sourceDailyGoalId: string;
  sourceExercise: MatchableExercise;
  delta: number;
  goalDate: string;
  category?: ExerciseCategory;
  logActivity: LogActivityMutator;
}): Promise<number> {
  if (input.delta === 0) return 0;
  if (input.goalDate !== todayISO()) return 0;

  const todaysGoals = await fetchMyTodaysDailyGoals(input.userId);
  const matches = findMatchingDailyGoalExercises(todaysGoals, {
    dailyGoalId: input.sourceDailyGoalId,
    exercise: input.sourceExercise,
  });
  if (matches.length === 0) return 0;

  let siblingXp = 0;

  for (const { goal, exercise } of matches) {
    const userTotalBefore = exercise.user_total;
    const userTotalAfter = Math.max(0, userTotalBefore + input.delta);
    if (userTotalAfter === userTotalBefore) continue;

    const result = await input.logActivity.mutateAsync({
      gangId: goal.gang_id,
      dailyGoalId: goal.id,
      dailyGoalExerciseId: exercise.id,
      exerciseId: exercise.exercise_id,
      exerciseName: exercise.exercise_name,
      category: input.category ?? goal.day_category ?? undefined,
      unit: exercise.unit,
      amount: userTotalAfter,
      awardActivityLogXp: false,
      skipStreakRefresh: true,
      questXpContext: {
        gangId: goal.gang_id,
        gangTarget: exercise.gang_target,
        individualTarget: exercise.individual_target,
        gangTotalBefore: exercise.gang_total,
        gangTotalAfter: exercise.gang_total + (userTotalAfter - userTotalBefore),
        userTotalBefore,
        userTotalAfter,
      },
    });
    siblingXp += result.xpAwarded;
  }

  return siblingXp;
}
