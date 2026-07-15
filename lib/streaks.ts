import { todayISO } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { addDaysISO } from '@/types';

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  lastActiveOn: string | null;
}

/**
 * Compute personal streak stats from distinct YYYY-MM-DD activity dates.
 * Current streak stays alive through today if the last workout was yesterday.
 */
export function computeStreakStats(
  activityDates: string[],
  today: string = todayISO(),
): StreakStats {
  const unique = [
    ...new Set(activityDates.filter((d): d is string => !!d)),
  ].sort();

  if (unique.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveOn: null };
  }

  const dateSet = new Set(unique);
  const lastActiveOn = unique[unique.length - 1]!;

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === addDaysISO(unique[i - 1]!, 1)) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 1;
    }
  }

  const yesterday = addDaysISO(today, -1);
  let cursor: string | null = null;
  if (dateSet.has(today)) cursor = today;
  else if (dateSet.has(yesterday)) cursor = yesterday;
  else {
    return { currentStreak: 0, longestStreak, lastActiveOn };
  }

  let currentStreak = 0;
  while (cursor && dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysISO(cursor, -1);
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastActiveOn,
  };
}

/** Recompute personal streak from activity dates and persist on the profile. */
export async function refreshPersonalStreak(userId: string): Promise<StreakStats> {
  const { data, error } = await supabase
    .from('activities')
    .select('activity_date')
    .eq('user_id', userId)
    .not('activity_date', 'is', null);
  if (error) throw error;

  const stats = computeStreakStats(
    (data ?? []).map((row) => row.activity_date).filter((d): d is string => !!d),
  );

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      current_streak: stats.currentStreak,
      longest_streak: stats.longestStreak,
      last_active_on: stats.lastActiveOn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (updateError) throw updateError;

  return stats;
}
