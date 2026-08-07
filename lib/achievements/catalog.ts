import {
  ACHIEVEMENT_TIER_ORDER,
  type AchievementTier,
} from './tiers';

/**
 * Explicit tier per catalog key — fallback when DB `tier` is missing
 * (older clients / partial seeds). Prefer `resolveAchievementTier`.
 */
export const ACHIEVEMENT_TIER_BY_KEY: Record<string, AchievementTier> = {
  first_goal: 'bronze',
  goals_10: 'silver',
  goals_50: 'gold',
  goals_100: 'platinum',
  day_clear_1: 'bronze',
  day_clear_30: 'legendary',

  streak_3: 'bronze',
  streak_7: 'silver',
  streak_30: 'gold',
  streak_100: 'legendary',

  reps_100: 'bronze',
  reps_500: 'silver',
  reps_1k: 'gold',
  reps_2k: 'platinum',
  reps_5k: 'legendary',

  time_10m: 'bronze',
  time_60m: 'silver',
  time_3h: 'gold',
  time_10h: 'platinum',
  time_24h: 'legendary',

  crates_1: 'bronze',
  crates_10: 'silver',
  crates_30: 'gold',
  crates_100: 'platinum',
  crates_250: 'legendary',

  loot_1: 'bronze',
  loot_5: 'silver',
  loot_15: 'gold',
  loot_40: 'platinum',
  loot_75: 'legendary',

  xp_500: 'bronze',
  xp_3k: 'silver',
  xp_10k: 'gold',
  xp_35k: 'platinum',
  xp_75k: 'legendary',

  first_kudos: 'bronze',
  kudos_50: 'silver',
  kudos_250: 'gold',
  kudos_recv_1: 'bronze',
  kudos_recv_50: 'silver',
  kudos_recv_250: 'gold',
  first_comment: 'bronze',
  first_follow: 'bronze',
  first_poke: 'bronze',

  join_gang: 'bronze',
  gang_goal_assist: 'bronze',
  solo_day_clear: 'legendary',

  challenge_first: 'bronze',
};

export function isAchievementTier(value: string): value is AchievementTier {
  return (ACHIEVEMENT_TIER_ORDER as string[]).includes(value);
}

/**
 * Rough threshold → tier for catalog rows that aren't in the key map yet.
 * Tune per category later if milestone curves diverge.
 */
export function inferAchievementTier(threshold: number | null | undefined): AchievementTier {
  if (threshold == null || threshold <= 1) return 'bronze';
  if (threshold < 30) return 'silver';
  if (threshold < 100) return 'gold';
  if (threshold < 1000) return 'platinum';
  return 'legendary';
}

export function achievementTierForKey(
  key: string,
  threshold?: number | null,
): AchievementTier {
  return ACHIEVEMENT_TIER_BY_KEY[key] ?? inferAchievementTier(threshold);
}

/** Prefer DB `tier`, then key map, then threshold heuristic. */
export function resolveAchievementTier(input: {
  key: string;
  tier?: string | null;
  threshold?: number | null;
}): AchievementTier {
  if (input.tier && isAchievementTier(input.tier)) return input.tier;
  return achievementTierForKey(input.key, input.threshold);
}
