import type { Rank } from '@/types';

/** Rarity ladder shared by all crate loot (E common → S mythic). */
export type RewardRarity = Rank;

/**
 * Extensible reward kinds. Add new kinds here as loot expands
 * (e.g. 'title' | 'banner' | 'border' | 'currency' | 'xp_boost').
 */
export type RewardKind = 'xp';

interface CrateRewardBase {
  kind: RewardKind;
  rarity: RewardRarity;
  /** Uppercase-ish row label shown in RewardReveal. */
  label: string;
  /** Display string for the amount / unlock name. */
  value: string;
}

/** XP drop from a reward crate. */
export interface XpCrateReward extends CrateRewardBase {
  kind: 'xp';
  amount: number;
  /**
   * Level used to pick a LevelBadge palette for this rarity.
   * Not the player's level — a visual stand-in for the drop tier.
   */
  badgeLevel: number;
}

/** Discriminated union — extend as new reward kinds ship. */
export type CrateReward = XpCrateReward;

/** Persisted shape of `user_reward_crates.contents`. */
export interface CrateContents {
  version: 1;
  rewards: CrateReward[];
}
