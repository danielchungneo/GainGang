export type {
  Database,
  Json,
  Tables,
  Views,
  InsertRow,
  UpdateRow,
  FitnessLevel,
  Rank,
  GangPrivacy,
  GangRole,
  ExerciseCategory,
  ExerciseUnit,
  QuestType,
  QuestStatus,
  AchievementCategory,
  NotificationType,
} from './database';

import type {
  Tables,
  ExerciseCategory,
  ExerciseUnit,
  Rank,
} from './database';

/**
 * GainGang domain models.
 *
 * Row types from `types/database.ts` are the source of truth for persisted
 * shapes. The view models below compose those rows with joined/aggregated data
 * for the UI (feed items, quest progress, members with profiles, etc.).
 */

export type Profile = Tables<'profiles'>;
export type Gang = Tables<'gangs'>;
export type GangMember = Tables<'gang_members'>;
export type Exercise = Tables<'exercises'>;
export type Quest = Tables<'quests'>;
export type Activity = Tables<'activities'>;
export type Comment = Tables<'comments'>;
export type Achievement = Tables<'achievements'>;
export type AppNotification = Tables<'notifications'>;

/** A gang the current user belongs to, with their role + member count. */
export interface GangSummary extends Gang {
  role: GangMember['role'];
  member_count: number;
}

/** A gang member row joined with its profile (for rosters & leaderboards). */
export interface GangMemberWithProfile extends GangMember {
  profile: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'rank' | 'xp'>;
}

/** A quest enriched with collective + personal progress. */
export interface QuestWithProgress extends Quest {
  gang_total: number;
  contributor_count: number;
  /** the signed-in user's contribution toward this quest */
  user_total: number;
  exercise_name?: string | null;
}

/** An activity enriched for the social feed. */
export interface ActivityFeedItem extends Activity {
  author: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'rank'>;
  kudos_count: number;
  comment_count: number;
  /** whether the signed-in user has given kudos */
  has_kudos: boolean;
}

/** A comment joined with its author profile. */
export interface CommentWithAuthor extends Comment {
  author: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'>;
}

/** A leaderboard row for a gang. */
export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  rank: Rank;
  total: number;
  position: number;
}

// ---------------------------------------------------------------------------
// Static reference data (mirrors the SQL CHECK constraints; maps over enums).
// ---------------------------------------------------------------------------

/** The fixed 5-day weekly schedule (doc §3.4). */
export interface ScheduleDay {
  day: number;
  category: ExerciseCategory;
  label: string;
  focus: string;
}

export const WEEKLY_SCHEDULE: readonly ScheduleDay[] = [
  { day: 1, category: 'chest', label: 'Chest', focus: 'Push-based movements targeting the chest' },
  { day: 2, category: 'legs', label: 'Legs', focus: 'Lower body strength and explosiveness' },
  { day: 3, category: 'cardio', label: 'Cardio', focus: 'Distance-based travel (run, walk, bike)' },
  { day: 4, category: 'back', label: 'Back', focus: 'Pull-based movements targeting the back' },
  { day: 5, category: 'core', label: 'Core', focus: 'Full trunk stability and abdominal strength' },
] as const;

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  chest: 'Chest',
  legs: 'Legs',
  cardio: 'Cardio',
  back: 'Back',
  core: 'Core',
};

export const CATEGORY_ICONS: Record<ExerciseCategory, string> = {
  chest: 'fitness',
  legs: 'walk',
  cardio: 'bicycle',
  back: 'barbell',
  core: 'body',
};

export const UNIT_LABELS: Record<ExerciseUnit, { short: string; long: string }> = {
  reps: { short: 'reps', long: 'repetitions' },
  seconds: { short: 'sec', long: 'seconds' },
  meters: { short: 'm', long: 'meters' },
};

/** Rank progression E → S, with the XP required to reach each rank. */
export const RANK_ORDER: readonly Rank[] = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

export const RANK_THRESHOLDS: Record<Rank, number> = {
  E: 0,
  D: 500,
  C: 1500,
  B: 4000,
  A: 9000,
  S: 20000,
};

export const RANK_LABELS: Record<Rank, string> = {
  E: 'E-Rank',
  D: 'D-Rank',
  C: 'C-Rank',
  B: 'B-Rank',
  A: 'A-Rank',
  S: 'S-Rank',
};

/** Returns the rank a given XP total qualifies for. */
export function rankForXp(xp: number): Rank {
  let current: Rank = 'E';
  for (const rank of RANK_ORDER) {
    if (xp >= RANK_THRESHOLDS[rank]) current = rank;
  }
  return current;
}

/** Progress (0–1) toward the next rank, plus the XP remaining. */
export function rankProgress(xp: number): { current: Rank; next: Rank | null; ratio: number; toNext: number } {
  const current = rankForXp(xp);
  const idx = RANK_ORDER.indexOf(current);
  const next = idx < RANK_ORDER.length - 1 ? RANK_ORDER[idx + 1] : null;
  if (!next) return { current, next: null, ratio: 1, toNext: 0 };
  const floor = RANK_THRESHOLDS[current];
  const ceil = RANK_THRESHOLDS[next];
  const ratio = Math.min(1, Math.max(0, (xp - floor) / (ceil - floor)));
  return { current, next, ratio, toNext: Math.max(0, ceil - xp) };
}

/** Today's scheduled category (Mon=Day1 … Fri=Day5, weekend rolls to Core). */
export function todaysCategory(date = new Date()): ExerciseCategory {
  const dow = date.getDay(); // 0 Sun … 6 Sat
  const map: Record<number, ExerciseCategory> = {
    1: 'chest',
    2: 'legs',
    3: 'cardio',
    4: 'back',
    5: 'core',
    6: 'core',
    0: 'core',
  };
  return map[dow];
}
