import type { GoalCompleteExerciseTarget } from '@/components/goal-complete-overlay';
import { formatGoalDate } from '@/lib/format';
import { getLevelUpInfo, type DailyGoalExerciseWithProgress, type DailyGoalWithProgress } from '@/types';

export interface DailyGoalCelebrationPayload {
  title: string;
  xpEarned: number;
  exercises: GoalCompleteExerciseTarget[];
}

export interface DailyGoalSaveCelebrationInput {
  goal: DailyGoalWithProgress;
  totalsBefore: number[];
  totalsAfter: number[];
  xpAwarded: number;
  profileXp: number;
}

/** Whether an exercise counts toward personal daily-goal completion from logged totals. */
export function isDailyGoalExerciseMet(
  ex: DailyGoalExerciseWithProgress,
  total: number,
): boolean {
  if (ex.individual_target <= 0) return true;
  return total >= ex.individual_target;
}

export function buildDailyGoalTotalsAfter(
  goal: DailyGoalWithProgress,
  updates: Record<string, number>,
): number[] {
  return goal.exercises.map((ex) => updates[ex.id] ?? ex.user_total);
}

export function isDailyGoalNewlyComplete(input: {
  goal: DailyGoalWithProgress;
  totalsBefore: number[];
  totalsAfter: number[];
}): boolean {
  const { goal, totalsBefore, totalsAfter } = input;

  const allCompleteBefore = goal.exercises.every((ex, i) =>
    isDailyGoalExerciseMet(ex, totalsBefore[i]),
  );
  const allCompleteAfter = goal.exercises.every((ex, i) =>
    isDailyGoalExerciseMet(ex, totalsAfter[i]),
  );

  return allCompleteAfter && !allCompleteBefore;
}

export function buildDailyGoalCelebration(
  input: DailyGoalSaveCelebrationInput,
): DailyGoalCelebrationPayload | null {
  if (
    !isDailyGoalNewlyComplete({
      goal: input.goal,
      totalsBefore: input.totalsBefore,
      totalsAfter: input.totalsAfter,
    })
  ) {
    return null;
  }

  return {
    title: formatGoalDate(input.goal.goal_date),
    xpEarned: input.xpAwarded,
    exercises: input.goal.exercises.map((ex, i) => ({
      name: ex.exercise_name,
      unit: ex.unit,
      from: input.totalsBefore[i],
      target: ex.individual_target,
    })),
  };
}

export function resolvePostSaveCelebration(input: DailyGoalSaveCelebrationInput): {
  celebration: DailyGoalCelebrationPayload | null;
  levelUp: { fromLevel: number; toLevel: number } | null;
} {
  const levelUp = getLevelUpInfo(input.profileXp, input.xpAwarded);
  const celebration = buildDailyGoalCelebration(input);

  return { celebration, levelUp };
}
