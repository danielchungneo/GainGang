/**
 * Milestone lines — only the highest earned step is shown in the trophy case.
 * If none are earned, the first (lowest) step stays visible as locked.
 */

import { resolveAchievementTier } from './catalog';
import { ACHIEVEMENT_TIER_ORDER, type AchievementTier } from './tiers';

export const ACHIEVEMENT_LINES: readonly (readonly string[])[] = [
  ['first_goal', 'goals_10', 'goals_50', 'goals_100'],
  ['day_clear_1', 'day_clear_30'],
  ['streak_3', 'streak_7', 'streak_30', 'streak_100'],
  ['reps_100', 'reps_500', 'reps_1k', 'reps_2k', 'reps_5k'],
  ['time_10m', 'time_60m', 'time_3h', 'time_10h', 'time_24h'],
  ['crates_1', 'crates_10', 'crates_30', 'crates_100', 'crates_250'],
  ['loot_1', 'loot_5', 'loot_15', 'loot_40', 'loot_75'],
  ['xp_500', 'xp_3k', 'xp_10k', 'xp_35k', 'xp_75k'],
  ['first_kudos', 'kudos_50', 'kudos_250'],
  ['kudos_recv_1', 'kudos_recv_50', 'kudos_recv_250'],
] as const;

interface CollapseableAchievement {
  key: string;
  earned: boolean;
  is_secret: boolean;
  tier?: string | null;
  threshold?: number | null;
  title?: string;
}

function rarityRank(tier: AchievementTier): number {
  return ACHIEVEMENT_TIER_ORDER.indexOf(tier);
}

/**
 * Collapse each milestone line to a single badge:
 * - highest earned in the line, or
 * - the first locked step when nothing in the line is earned.
 * Secrets stay hidden until earned. Standalone achievements are unchanged.
 */
export function collapseAchievementLines<T extends CollapseableAchievement>(
  achievements: T[],
): T[] {
  const byKey = new Map(achievements.map((a) => [a.key, a]));
  const hidden = new Set<string>();

  for (const line of ACHIEVEMENT_LINES) {
    let bestEarnedIndex = -1;
    for (let i = 0; i < line.length; i++) {
      const row = byKey.get(line[i]);
      if (row?.earned) bestEarnedIndex = i;
    }

    if (bestEarnedIndex >= 0) {
      for (let i = 0; i < line.length; i++) {
        if (i !== bestEarnedIndex) hidden.add(line[i]);
      }
      continue;
    }

    for (let i = 1; i < line.length; i++) {
      hidden.add(line[i]);
    }
  }

  return achievements.filter((a) => {
    if (hidden.has(a.key)) return false;
    if (a.is_secret && !a.earned) return false;
    return true;
  });
}

/** Sort trophy case: rarer tiers first, then earned over locked, then title. */
export function sortAchievementsByRarity<T extends CollapseableAchievement>(
  achievements: T[],
): T[] {
  return [...achievements].sort((a, b) => {
    const tierA = resolveAchievementTier({
      key: a.key,
      tier: a.tier,
      threshold: a.threshold,
    });
    const tierB = resolveAchievementTier({
      key: b.key,
      tier: b.tier,
      threshold: b.threshold,
    });
    const rarityDiff = rarityRank(tierB) - rarityRank(tierA);
    if (rarityDiff !== 0) return rarityDiff;
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return (a.title ?? a.key).localeCompare(b.title ?? b.key);
  });
}
