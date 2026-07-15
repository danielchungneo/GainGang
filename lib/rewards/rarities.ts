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
 * Must stay in sync with `open_reward_crate` SQL roll bands.
 */
export const REWARD_RARITIES: Record<RewardRarity, RewardRarityDef> = {
  E: {
    rarity: 'E',
    name: 'Common',
    weight: 45,
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
    weight: 15,
    xpAmount: 100,
    badgeLevel: 25,
    ...pickRankVisual('C'),
  },
  B: {
    rarity: 'B',
    name: 'Epic',
    weight: 9,
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
    weight: 1,
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
