import type { Json, RewardCrateTier } from '@/types/database';
import type { CosmeticKind } from '@/types/database';

import { rarityDef } from './rarities';
import type {
  CosmeticCrateReward,
  CredsCrateReward,
  CrateContents,
  CrateReward,
  RewardRarity,
  XpCrateReward,
} from './types';

const RARITIES = new Set<RewardRarity>(['E', 'D', 'C', 'B', 'A', 'S']);
const COSMETIC_KINDS = new Set<CosmeticKind>([
  'title',
  'avatar_border',
  'level_border',
  'banner',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRewardRarity(value: unknown): value is RewardRarity {
  return typeof value === 'string' && RARITIES.has(value as RewardRarity);
}

function isCosmeticKind(value: unknown): value is CosmeticKind {
  return typeof value === 'string' && COSMETIC_KINDS.has(value as CosmeticKind);
}

function parseXpReward(raw: Record<string, unknown>): XpCrateReward | null {
  if (raw.kind !== 'xp') return null;
  if (!isRewardRarity(raw.rarity)) return null;
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount <= 0) {
    return null;
  }

  const def = rarityDef(raw.rarity);
  const amount = Math.floor(raw.amount);
  const badgeLevel =
    typeof raw.badgeLevel === 'number' && raw.badgeLevel > 0
      ? Math.floor(raw.badgeLevel)
      : def.badgeLevel;

  return {
    kind: 'xp',
    rarity: raw.rarity,
    amount,
    badgeLevel,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label : 'XP DROP',
    value:
      typeof raw.value === 'string' && raw.value.trim()
        ? raw.value
        : `+${amount} XP`,
  };
}

function parseCredsReward(raw: Record<string, unknown>): CredsCrateReward | null {
  if (raw.kind !== 'creds') return null;
  if (!isRewardRarity(raw.rarity)) return null;
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount <= 0) {
    return null;
  }

  const def = rarityDef(raw.rarity);
  const amount = Math.floor(raw.amount);
  const badgeLevel =
    typeof raw.badgeLevel === 'number' && raw.badgeLevel > 0
      ? Math.floor(raw.badgeLevel)
      : def.badgeLevel;

  return {
    kind: 'creds',
    rarity: raw.rarity,
    amount,
    badgeLevel,
    label: 'CREDS',
    value:
      typeof raw.value === 'string' && raw.value.trim()
        ? raw.value
        : `+${amount} Creds`,
  };
}

function parseCosmeticReward(raw: Record<string, unknown>): CosmeticCrateReward | null {
  if (raw.kind !== 'cosmetic') return null;
  if (!isRewardRarity(raw.rarity)) return null;
  if (typeof raw.cosmeticId !== 'string' || !raw.cosmeticId.trim()) return null;
  if (!isCosmeticKind(raw.cosmeticKind)) return null;

  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : typeof raw.value === 'string' && raw.value.trim()
        ? raw.value.trim()
        : 'Cosmetic';

  return {
    kind: 'cosmetic',
    rarity: raw.rarity,
    cosmeticId: raw.cosmeticId,
    cosmeticKind: raw.cosmeticKind,
    name,
    label:
      typeof raw.label === 'string' && raw.label.trim()
        ? raw.label
        : 'COSMETIC UNLOCKED',
    value: typeof raw.value === 'string' && raw.value.trim() ? raw.value : name,
  };
}

function parseReward(raw: unknown): CrateReward | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'xp') return parseXpReward(raw);
  if (raw.kind === 'cosmetic') return parseCosmeticReward(raw);
  if (raw.kind === 'creds') return parseCredsReward(raw);
  return null;
}

/** Safely parse a crate's `contents` jsonb into typed rewards. */
export function parseCrateContents(contents: Json | null | undefined): CrateContents | null {
  if (!isRecord(contents)) return null;
  if (contents.version !== 1) return null;
  if (!Array.isArray(contents.rewards)) return null;

  const rewards = contents.rewards
    .map(parseReward)
    .filter((r): r is CrateReward => r != null);

  if (rewards.length === 0) return null;
  return { version: 1, rewards };
}

/** Highest rarity among contents (drives reveal tier coloring). */
export function highestRewardRarity(rewards: CrateReward[]): RewardRarity | null {
  const order: RewardRarity[] = ['E', 'D', 'C', 'B', 'A', 'S'];
  let best: RewardRarity | null = null;
  let bestIdx = -1;
  for (const reward of rewards) {
    const idx = order.indexOf(reward.rarity);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = reward.rarity;
    }
  }
  return best;
}

/** Prefer badge emblem from the lead XP reward, then Creds. */
export function emblemLevelFromRewards(rewards: CrateReward[]): number | undefined {
  const xp = rewards.find((r): r is XpCrateReward => r.kind === 'xp');
  if (xp) return xp.badgeLevel;
  const creds = rewards.find((r): r is CredsCrateReward => r.kind === 'creds');
  return creds?.badgeLevel;
}

export function revealTierFromCrate(
  crateTier: RewardCrateTier | string | null | undefined,
  rewards: CrateReward[],
): RewardCrateTier {
  const fromLoot = highestRewardRarity(rewards);
  if (fromLoot) return fromLoot;
  if (
    crateTier === 'aura' ||
    crateTier === 'E' ||
    crateTier === 'D' ||
    crateTier === 'C' ||
    crateTier === 'B' ||
    crateTier === 'A' ||
    crateTier === 'S'
  ) {
    return crateTier;
  }
  return 'aura';
}

export function raritySubtitle(rewards: CrateReward[]): string | undefined {
  if (rewards.length === 0) return undefined;
  const top = highestRewardRarity(rewards);
  if (!top) return undefined;
  const def = rarityDef(top);
  const xp = rewards.find((r): r is XpCrateReward => r.kind === 'xp');
  const cosmetic = rewards.find((r): r is CosmeticCrateReward => r.kind === 'cosmetic');
  const creds = rewards.find((r): r is CredsCrateReward => r.kind === 'creds');
  const credsBit = creds ? ` · +${creds.amount} Creds` : '';
  if (xp && cosmetic) return `${def.name} XP · ${cosmetic.name}${credsBit}`;
  if (xp) return `${def.name} XP drop · +${xp.amount} XP${credsBit}`;
  if (cosmetic) return `${def.name} · ${cosmetic.name}${credsBit}`;
  if (creds) return `${def.name} · +${creds.amount} Creds`;
  return `${def.name} reward`;
}

export function rewardAccentColor(reward: CrateReward): string {
  return rarityDef(reward.rarity).color;
}
