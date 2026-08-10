import type { WarDivision } from '@/types';
import type { RewardRarity } from '@/lib/rewards';

export const WAR_DIVISIONS: WarDivision[] = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'emerald',
  'diamond',
  'crystal',
  'onyx',
];

export const WAR_DIVISION_LABELS: Record<WarDivision, string> = {
  iron: 'Iron',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  emerald: 'Emerald',
  diamond: 'Diamond',
  crystal: 'Crystal',
  onyx: 'Onyx',
};

/** Staging-quality border colors around the gang banner image. */
export const WAR_DIVISION_BORDERS: Record<
  WarDivision,
  { colors: [string, string]; width: number }
> = {
  iron: { colors: ['#6B7280', '#374151'], width: 3 },
  bronze: { colors: ['#CD7F32', '#8B4513'], width: 3 },
  silver: { colors: ['#E5E7EB', '#9CA3AF'], width: 3 },
  gold: { colors: ['#FBBF24', '#D97706'], width: 4 },
  emerald: { colors: ['#34D399', '#059669'], width: 4 },
  diamond: { colors: ['#67E8F9', '#0891B2'], width: 4 },
  crystal: { colors: ['#C4B5FD', '#7C3AED'], width: 5 },
  onyx: { colors: ['#1F2937', '#000000'], width: 5 },
};

/** Win crate floor tier by division fought (before promote). */
export const WAR_DIVISION_CRATE_TIERS: Record<WarDivision, RewardRarity> = {
  iron: 'E',
  bronze: 'E',
  silver: 'D',
  gold: 'C',
  emerald: 'B',
  diamond: 'A',
  crystal: 'S',
  onyx: 'S',
};

export function isWarDivision(value: string | null | undefined): value is WarDivision {
  return !!value && (WAR_DIVISIONS as string[]).includes(value);
}

export function promoteWarDivision(division: WarDivision): WarDivision {
  const idx = WAR_DIVISIONS.indexOf(division);
  if (idx < 0) return 'iron';
  return WAR_DIVISIONS[Math.min(idx + 1, WAR_DIVISIONS.length - 1)]!;
}

export function demoteWarDivision(division: WarDivision): WarDivision {
  const idx = WAR_DIVISIONS.indexOf(division);
  if (idx < 0) return 'iron';
  return WAR_DIVISIONS[Math.max(idx - 1, 0)]!;
}
