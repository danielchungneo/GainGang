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
  WeeklyPlanStatus,
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
export type WeeklyPlan = Tables<'weekly_plans'>;
export type DailyGoal = Tables<'daily_goals'>;
export type DailyGoalExercise = Tables<'daily_goal_exercises'>;
export type Activity = Tables<'activities'>;
export type ActivityExercise = Tables<'activity_exercises'>;
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

/** A quest enriched with collective + personal progress. @deprecated Use DailyGoalWithProgress */
export interface QuestWithProgress extends Quest {
  gang_total: number;
  contributor_count: number;
  /** the signed-in user's contribution toward this quest */
  user_total: number;
  exercise_name?: string | null;
}

/** Per-exercise progress within a daily goal. */
export interface DailyGoalExerciseWithProgress {
  id: string;
  exercise_id: string;
  exercise_name: string;
  unit: ExerciseUnit;
  individual_target: number;
  gang_target: number;
  gang_total: number;
  contributor_count: number;
  user_total: number;
  activity_id?: string | null;
}

/** A daily goal enriched with exercise-level progress. */
export interface DailyGoalWithProgress extends DailyGoal {
  gang_id: string;
  gang_name?: string;
  member_count: number;
  exercises: DailyGoalExerciseWithProgress[];
}

/** A weekly plan with its daily goals. */
export interface WeeklyPlanWithGoals extends WeeklyPlan {
  daily_goals: DailyGoalWithProgress[];
}

/** An activity enriched for the social feed. */
export interface ActivityFeedItem extends Activity {
  author: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'xp'>;
  exercises: ActivityExercise[];
  kudos_count: number;
  comment_count: number;
  /** whether the signed-in user has given kudos */
  has_kudos: boolean;
}

/** Flattened exercise log used by legacy quest editing screens. */
export interface ActivityExerciseSnapshot extends ActivityExercise {
  gang_id: string | null;
  quest_id: string | null;
  daily_goal_id: string | null;
}

/** An activity with its exercise lines (profile, detail views). */
export interface ActivityWithExercises extends Activity {
  exercises: ActivityExercise[];
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
  xp: number;
  level: number;
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

/** All 7 days for weekly plan creation (ISO: 1=Mon … 7=Sun). */
export interface WeekDay {
  dayOfWeek: number;
  label: string;
  shortLabel: string;
  defaultCategory: ExerciseCategory;
}

export const WEEK_DAYS: readonly WeekDay[] = [
  { dayOfWeek: 1, label: 'Monday', shortLabel: 'Mon', defaultCategory: 'chest' },
  { dayOfWeek: 2, label: 'Tuesday', shortLabel: 'Tue', defaultCategory: 'legs' },
  { dayOfWeek: 3, label: 'Wednesday', shortLabel: 'Wed', defaultCategory: 'cardio' },
  { dayOfWeek: 4, label: 'Thursday', shortLabel: 'Thu', defaultCategory: 'back' },
  { dayOfWeek: 5, label: 'Friday', shortLabel: 'Fri', defaultCategory: 'core' },
  { dayOfWeek: 6, label: 'Saturday', shortLabel: 'Sat', defaultCategory: 'core' },
  { dayOfWeek: 7, label: 'Sunday', shortLabel: 'Sun', defaultCategory: 'core' },
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
  miles: { short: 'mi', long: 'miles' },
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

// ---------------------------------------------------------------------------
// Level progression (derived from XP — shown in UI instead of class rank)
// Level 1→2 costs 100 XP; each level-up after that costs +25 XP more.
// ---------------------------------------------------------------------------

/** XP to go from level 1 → 2. */
export const XP_LEVEL_BASE = 100;
/** Extra XP added to each subsequent level-up requirement. */
export const XP_LEVEL_INCREMENT = 25;

/** @deprecated Use XP_LEVEL_BASE */
export const XP_PER_LEVEL = XP_LEVEL_BASE;

/** XP required to advance from `level` to `level + 1`. */
export function xpToAdvanceFromLevel(level: number): number {
  return XP_LEVEL_BASE + (Math.max(1, level) - 1) * XP_LEVEL_INCREMENT;
}

/** Total XP at the start of `level` (level 1 begins at 0 XP). */
export function xpForLevel(level: number): number {
  const target = Math.max(1, level);
  if (target === 1) return 0;
  const steps = target - 1;
  return (
    steps * XP_LEVEL_BASE + (XP_LEVEL_INCREMENT * (steps - 1) * steps) / 2
  );
}

/** Player level from total XP. */
export function levelFromXp(xp: number): number {
  let level = 1;
  let accumulated = 0;
  const total = Math.max(0, xp);
  while (accumulated + xpToAdvanceFromLevel(level) <= total) {
    accumulated += xpToAdvanceFromLevel(level);
    level++;
  }
  return level;
}

/** If an XP gain crossed a level boundary, returns the before/after levels. */
export function getLevelUpInfo(
  xpBefore: number,
  xpGained: number,
): { fromLevel: number; toLevel: number } | null {
  const fromLevel = levelFromXp(xpBefore);
  const toLevel = levelFromXp(xpBefore + Math.max(0, xpGained));
  if (toLevel <= fromLevel) return null;
  return { fromLevel, toLevel };
}

/** Progress within the current level toward the next. */
export function levelProgress(xp: number): {
  level: number;
  currentXp: number;
  targetXp: number;
  toNext: number;
  ratio: number;
} {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const targetXp = xpToAdvanceFromLevel(level);
  const currentXp = xp - floor;
  const toNext = Math.max(0, floor + targetXp - xp);
  const ratio = Math.min(1, Math.max(0, currentXp / targetXp));
  return { level, currentXp, targetXp, toNext, ratio };
}

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

/** ISO day-of-week: 1 = Monday … 7 = Sunday. */
export function isoDayOfWeek(date = new Date()): number {
  const dow = date.getDay();
  return dow === 0 ? 7 : dow;
}

/** Monday of the week containing `date`, as YYYY-MM-DD (local). */
export function mondayOfWeek(date = new Date()): string {
  const d = new Date(date);
  const iso = isoDayOfWeek(d);
  d.setDate(d.getDate() - (iso - 1));
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/** Add days to a YYYY-MM-DD string. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
