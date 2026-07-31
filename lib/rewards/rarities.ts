import { ranks, type RankTier } from '@/lib/gaingang-theme';

import type { RewardRarity } from './types';

export interface RewardRarityDef {
  rarity: RewardRarity;
  /** Human-facing name shown in UI copy. */
  name: string;
  /** Relative drop weight — higher = more common. */
  weight: number;
  /** XP granted when this rarity is rolled for an XP reward. */
  xpAmount: number;
  /**
   * Representative player level for LevelBadge coloring.
   * Levels map to palette bands every 10 levels.
   */
  badgeLevel: number;
  color: string;
  glow: string;
  fill: [string, string];
}

/**
 * Loot rarity table (weights sum to 100).
 * Must stay in sync with `roll_reward_rarity` SQL roll bands.
 */
export const REWARD_RARITIES: Record<RewardRarity, RewardRarityDef> = {
  E: {
    rarity: 'E',
    name: 'Common',
    weight: 40,
    xpAmount: 25,
    badgeLevel: 5,
    ...pickRankVisual('E'),
  },
  D: {
    rarity: 'D',
    name: 'Uncommon',
    weight: 25,
    xpAmount: 50,
    badgeLevel: 15,
    ...pickRankVisual('D'),
  },
  C: {
    rarity: 'C',
    name: 'Rare',
    weight: 18,
    xpAmount: 100,
    badgeLevel: 25,
    ...pickRankVisual('C'),
  },
  B: {
    rarity: 'B',
    name: 'Epic',
    weight: 10,
    xpAmount: 200,
    badgeLevel: 35,
    ...pickRankVisual('B'),
  },
  A: {
    rarity: 'A',
    name: 'Legendary',
    weight: 5,
    xpAmount: 400,
    badgeLevel: 45,
    ...pickRankVisual('A'),
  },
  S: {
    rarity: 'S',
    name: 'Mythic',
    weight: 2,
    xpAmount: 800,
    badgeLevel: 55,
    ...pickRankVisual('S'),
  },
};

export const REWARD_RARITY_ORDER: RewardRarity[] = ['E', 'D', 'C', 'B', 'A', 'S'];

function pickRankVisual(tier: RankTier) {
  const def = ranks[tier];
  return {
    color: def.color,
    glow: def.glow,
    fill: def.fill,
  };
}

export function rarityDef(rarity: RewardRarity): RewardRarityDef {
  return REWARD_RARITIES[rarity];
}

/** Crate floor for a level-up reward. Every 10th → B, else every 5th → C, else E. */
export function crateTierForLevel(level: number): RewardRarity {
  if (level > 0 && level % 10 === 0) return 'B';
  if (level > 0 && level % 5 === 0) return 'C';
  return 'E';
}

/**
 * Roll a loot rarity at or above `minRarity`, renormalizing the base weights
 * among the remaining tiers. Must stay in sync with `roll_reward_rarity(text)`.
 */
export function rollRewardRarity(minRarity: RewardRarity = 'E'): RewardRarity {
  const start = REWARD_RARITY_ORDER.indexOf(minRarity);
  const eligible = REWARD_RARITY_ORDER.slice(Math.max(0, start));
  const totalWeight = eligible.reduce((sum, rarity) => sum + rarityDef(rarity).weight, 0);
  let roll = Math.random() * totalWeight;
  for (const rarity of eligible) {
    roll -= rarityDef(rarity).weight;
    if (roll < 0) return rarity;
  }
  return eligible[eligible.length - 1] ?? minRarity;
}
