import type { GoalCompleteExerciseTarget } from '@/components/goal-complete-overlay';
import { formatGoalDate, todayISO } from '@/lib/format';
import { getLevelUpInfo, type DailyGoalExerciseWithProgress, type DailyGoalWithProgress } from '@/types';

export type DailyGoalCelebrationKind = 'goal' | 'day';

export interface DailyGoalCelebrationPayload {
  title: string;
  xpEarned: number;
  exercises: GoalCompleteExerciseTarget[];
  /** `day` when this save clears every required exercise across today's goals. */
  kind: DailyGoalCelebrationKind;
}

export interface StreakContinuePayload {
  fromDays: number;
  toDays: number;
}

export interface DailyGoalSaveCelebrationInput {
  goal: DailyGoalWithProgress;
  totalsBefore: number[];
  totalsAfter: number[];
  xpAwarded: number;
  profileXp: number;
  /** Profile streak before this save (for first-of-day detection). */
  currentStreak?: number;
  /** Profile last_active_on before this save (YYYY-MM-DD). */
  lastActiveOn?: string | null;
  /**
   * All of today's gang daily goals. Used to detect day-clear (uncommon crate)
   * vs a single club goal finish. Falls back to `goal` alone when omitted.
   */
  todaysGoals?: DailyGoalWithProgress[];
}

/** Whether an exercise counts toward personal daily-goal completion from logged totals. */
export function isDailyGoalExerciseMet(
  ex: DailyGoalExerciseWithProgress,
  total: number,
): boolean {
  if (!ex.is_required_for_user) return true;
  if (ex.individual_target <= 0) return true;
  return total >= ex.individual_target;
}

export function buildDailyGoalTotalsAfter(
  goal: DailyGoalWithProgress,
  updates: Record<string, number>,
): number[] {
  return goal.exercises.map((ex) => updates[ex.id] ?? ex.user_total);
}

function isGoalCompleteWithTotals(
  goal: DailyGoalWithProgress,
  totals: number[],
): boolean {
  if (goal.exercises.length === 0) return false;
  return goal.exercises.every((ex, i) => isDailyGoalExerciseMet(ex, totals[i]));
}

export function isDailyGoalNewlyComplete(input: {
  goal: DailyGoalWithProgress;
  totalsBefore: number[];
  totalsAfter: number[];
}): boolean {
  const { goal, totalsBefore, totalsAfter } = input;

  const allCompleteBefore = isGoalCompleteWithTotals(goal, totalsBefore);
  const allCompleteAfter = isGoalCompleteWithTotals(goal, totalsAfter);

  return allCompleteAfter && !allCompleteBefore;
}

/** Goals used for day-clear checks — prefer the full today list when provided. */
function resolveTodaysGoalsForCelebration(input: {
  goal: DailyGoalWithProgress;
  todaysGoals?: DailyGoalWithProgress[];
}): DailyGoalWithProgress[] {
  const siblings = input.todaysGoals ?? [];
  if (siblings.length === 0) return [input.goal];

  const hasSavedGoal = siblings.some((g) => g.id === input.goal.id);
  return hasSavedGoal ? siblings : [...siblings, input.goal];
}

/**
 * True when this save flips the user from "still has required work today"
 * to "every required exercise across today's goals is cleared."
 */
export function isDayNewlyComplete(input: {
  goal: DailyGoalWithProgress;
  totalsBefore: number[];
  totalsAfter: number[];
  todaysGoals?: DailyGoalWithProgress[];
}): boolean {
  const goals = resolveTodaysGoalsForCelebration(input);

  const completeBefore = goals.every((g) => {
    if (g.id === input.goal.id) {
      return isGoalCompleteWithTotals(g, input.totalsBefore);
    }
    return isGoalCompleteWithTotals(
      g,
      g.exercises.map((ex) => ex.user_total),
    );
  });

  const completeAfter = goals.every((g) => {
    if (g.id === input.goal.id) {
      return isGoalCompleteWithTotals(g, input.totalsAfter);
    }
    return isGoalCompleteWithTotals(
      g,
      g.exercises.map((ex) => ex.user_total),
    );
  });

  return completeAfter && !completeBefore;
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

  const dayComplete = isDayNewlyComplete({
    goal: input.goal,
    totalsBefore: input.totalsBefore,
    totalsAfter: input.totalsAfter,
    todaysGoals: input.todaysGoals,
  });

  return {
    title: formatGoalDate(input.goal.goal_date),
    xpEarned: input.xpAwarded,
    kind: dayComplete ? 'day' : 'goal',
    exercises: input.goal.exercises.map((ex, i) => ({
      name: ex.exercise_name,
      unit: ex.unit,
      from: input.totalsBefore[i],
      target: ex.individual_target,
    })),
  };
}

/**
 * First logged activity of the calendar day bumps the personal streak by 1.
 * Uses pre-save profile fields so we know the from → to count for animation.
 * `activityDate` must be today — logging/editing a past day does not bump.
 */
export function resolveStreakContinue(input: {
  currentStreak: number;
  lastActiveOn: string | null;
  today?: string;
  /** Date of the activity being saved (YYYY-MM-DD). Defaults to today. */
  activityDate?: string;
}): StreakContinuePayload | null {
  const today = input.today ?? todayISO();
  const activityDate = input.activityDate ?? today;
  if (activityDate !== today) return null;
  if (input.lastActiveOn === today) return null;

  return {
    fromDays: input.currentStreak,
    toDays: input.currentStreak + 1,
  };
}

export function resolvePostSaveCelebration(input: DailyGoalSaveCelebrationInput): {
  celebration: DailyGoalCelebrationPayload | null;
  levelUp: { fromLevel: number; toLevel: number } | null;
  streakContinue: StreakContinuePayload | null;
} {
  const levelUp = getLevelUpInfo(input.profileXp, input.xpAwarded);
  const celebration = buildDailyGoalCelebration(input);
  const streakContinue =
    input.currentStreak !== undefined
      ? resolveStreakContinue({
          currentStreak: input.currentStreak,
          lastActiveOn: input.lastActiveOn ?? null,
          activityDate: input.goal.goal_date,
        })
      : null;

  return { celebration, levelUp, streakContinue };
}
