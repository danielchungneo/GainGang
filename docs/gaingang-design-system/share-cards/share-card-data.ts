/**
 * Maps an ActivityFeedItem onto the values the share cards render.
 */
import { activityDateLabel, formatAmount } from '@/lib/format';
import type { ActivityFeedItem } from '@/types';

/** Keep to 5 or fewer so the hero block stays legible at 9:16. */
export const MAX_SHARE_EXERCISES = 5;

export interface ShareExercise {
  /** Formatted amount incl. unit, e.g. "50", "3m", "2.5 mi" */
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
    amount: stripRepsUnit(formatAmount(ex.amount, ex.unit)),
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

/** "50 reps Push Ups" reads as noise — drop the unit word, keep others. */
function stripRepsUnit(formatted: string): string {
  return formatted.replace(/\s*reps?$/i, '');
}
