/**
 * Maps an ActivityFeedItem onto the values the share cards render.
 */
import { activityDateLabel, formatAmount } from '@/lib/format';
import type { ActivityFeedItem, ExerciseUnit } from '@/types';

/** Keep to 5 or fewer so the hero block stays legible at 9:16. */
export const MAX_SHARE_EXERCISES = 5;

export interface ShareExercise {
  /** Compact amount for the hero numeral, e.g. "50", "45s", "3m", "2.5 mi" */
  amount: string;
  /** e.g. "Push Ups" */
  name: string;
}

export interface ShareCardData {
  exercises: ShareExercise[];
  streakDays: number;
  totalReps: number;
  dateLabel: string;
}

export function shareCardData(activity: ActivityFeedItem): ShareCardData {
  const lines = activity.exercises ?? [];

  const exercises = lines.map((ex) => ({
    amount: formatShareAmount(ex.amount, ex.unit),
    name: ex.exercise_name,
  }));

  const totalReps = lines
    .filter((ex) => ex.unit === 'reps')
    .reduce((sum, ex) => sum + ex.amount, 0);

  const dateIso = activity.activity_date ?? activity.created_at.slice(0, 10);

  return {
    exercises,
    streakDays: activity.streak_at_log ?? 0,
    totalReps,
    dateLabel: activityDateLabel(dateIso),
  };
}

/**
 * Share numerals are large and right-aligned in a tight column — keep strings short.
 * Reps drop the unit word; seconds use `45s` / `3m` instead of `45 sec`.
 */
function formatShareAmount(amount: number, unit: ExerciseUnit): string {
  if (unit === 'seconds') {
    if (amount >= 60) {
      const m = Math.floor(amount / 60);
      const s = Math.round(amount % 60);
      return s ? `${m}m ${s}s` : `${m}m`;
    }
    return `${Math.round(amount)}s`;
  }

  if (unit === 'reps') {
    return Math.round(amount).toLocaleString();
  }

  return formatAmount(amount, unit);
}
