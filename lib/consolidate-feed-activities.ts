import { normalizeExerciseName } from '@/lib/rep-counting/exercise-registry';
import type { ActivityExercise, ActivityFeedItem } from '@/types';

const SYSTEM_ACTIVITY_NOTES = new Set(['Gang War', 'Weekly Challenge']);

function activityDayKey(activity: ActivityFeedItem): string {
  const date = activity.activity_date ?? activity.created_at.slice(0, 10);
  return `${activity.user_id}:${date}`;
}

function movementKey(exercise: ActivityExercise): string {
  const movement = exercise.exercise_id ?? normalizeExerciseName(exercise.exercise_name);
  return `${movement}:${exercise.unit}`;
}

/** True when notes are reserved challenge/war source tags, not user-authored text. */
export function isSystemActivityNote(notes: string | null | undefined): boolean {
  if (!notes) return false;
  if (SYSTEM_ACTIVITY_NOTES.has(notes)) return true;
  return notes.split(' · ').every((part) => SYSTEM_ACTIVITY_NOTES.has(part.trim()));
}

function userFacingNotes(notes: string | null | undefined): string | null {
  if (!notes || isSystemActivityNote(notes)) return null;
  return notes;
}

function withUserFacingNotes(activity: ActivityFeedItem): ActivityFeedItem {
  return {
    ...activity,
    notes: userFacingNotes(activity.notes),
    exercises: (activity.exercises ?? []).map((exercise) => ({
      ...exercise,
      notes: userFacingNotes(exercise.notes),
    })),
  };
}

/** Merge exercise lines across duplicate day rows, keeping the highest amount per movement+unit. */
export function consolidateExercisesByMax(
  activities: { exercises?: ActivityExercise[] | null }[],
): ActivityExercise[] {
  const byMovement = new Map<string, ActivityExercise>();

  for (const activity of activities) {
    for (const exercise of activity.exercises ?? []) {
      const key = movementKey(exercise);
      const existing = byMovement.get(key);
      const cleaned = {
        ...exercise,
        notes: userFacingNotes(exercise.notes),
      };
      if (!existing) {
        byMovement.set(key, cleaned);
        continue;
      }
      if (cleaned.amount > existing.amount) {
        byMovement.set(key, {
          ...cleaned,
          // Keep a stable id for list keys when the winning row changes.
          id: existing.id,
        });
      }
    }
  }

  return Array.from(byMovement.values());
}

/**
 * Collapse duplicate activity rows into one card per user per day.
 * Prefers daily-goal rows as the primary card; exercise amounts use max across
 * sources; challenge/war source tags are never shown as notes.
 */
export function consolidateFeedByUserDay(items: ActivityFeedItem[]): ActivityFeedItem[] {
  if (items.length === 0) return items;
  if (items.length === 1) return [withUserFacingNotes(items[0])];

  const groups = new Map<string, ActivityFeedItem[]>();
  for (const item of items) {
    const key = activityDayKey(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const consolidated: ActivityFeedItem[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      consolidated.push(withUserFacingNotes(group[0]));
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const aDaily = a.daily_goal_id ? 1 : 0;
      const bDaily = b.daily_goal_id ? 1 : 0;
      if (aDaily !== bDaily) return bDaily - aDaily;
      const aAt = a.updated_at ?? a.created_at;
      const bAt = b.updated_at ?? b.created_at;
      return bAt.localeCompare(aAt);
    });
    const primary = sorted[0];
    const notes =
      userFacingNotes(primary.notes) ??
      userFacingNotes(sorted.find((row) => userFacingNotes(row.notes))?.notes);

    consolidated.push({
      ...primary,
      exercises: consolidateExercisesByMax(sorted),
      notes,
      photo_url: primary.photo_url ?? sorted.find((row) => row.photo_url)?.photo_url ?? null,
    });
  }

  return consolidated.sort((a, b) => {
    const aAt = a.updated_at ?? a.created_at;
    const bAt = b.updated_at ?? b.created_at;
    return bAt.localeCompare(aAt);
  });
}
