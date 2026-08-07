/**
 * Achievement badge tiers — metal frame progression for milestone series
 * (e.g. 1k / 10k / 100k reps) and rare unlocks.
 */

export type AchievementTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'legendary';

export interface AchievementTierDef {
  tier: AchievementTier;
  name: string;
  /** Outer frame colors (1 = solid, 2 = gradient). */
  border: [string, string];
  glow: string;
  /** Inner medal fill gradient. */
  fill: [string, string];
  /** Icon color when earned. */
  icon: string;
  /** Stroke width bias for the frame ring. */
  borderWidth: number;
}

export const ACHIEVEMENT_TIERS: Record<AchievementTier, AchievementTierDef> = {
  bronze: {
    tier: 'bronze',
    name: 'Bronze',
    border: ['#B87333', '#8A5520'],
    glow: '#E8A86A',
    fill: ['#3A2818', '#1A120C'],
    icon: '#E8A86A',
    borderWidth: 2.5,
  },
  silver: {
    tier: 'silver',
    name: 'Silver',
    border: ['#C8D0DE', '#8B95A8'],
    glow: '#E8EDF7',
    fill: ['#2A3346', '#171D2B'],
    icon: '#E8EDF7',
    borderWidth: 2.5,
  },
  gold: {
    tier: 'gold',
    name: 'Gold',
    border: ['#F5A524', '#C47E0A'],
    glow: '#FFD56A',
    fill: ['#523616', '#2C1D0B'],
    icon: '#FFD56A',
    borderWidth: 3,
  },
  platinum: {
    tier: 'platinum',
    name: 'Platinum',
    border: ['#E8EDF7', '#7EAAFF'],
    glow: '#B8D0FF',
    fill: ['#1E2A44', '#0D1528'],
    icon: '#E8EDF7',
    borderWidth: 3,
  },
  legendary: {
    tier: 'legendary',
    name: 'Legendary',
    border: ['#F5A524', '#9D4EDD'],
    glow: '#C77DFF',
    fill: ['#3A1A4A', '#1A0F28'],
    icon: '#FFD56A',
    borderWidth: 3.5,
  },
};

export const ACHIEVEMENT_TIER_ORDER: AchievementTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'legendary',
];

/** Locked / unearned badge palette — keeps silhouette readable without spoiling metal. */
export const LOCKED_ACHIEVEMENT_TIER: AchievementTierDef = {
  tier: 'bronze',
  name: 'Locked',
  border: ['#3A4558', '#2A3346'],
  glow: '#64748B',
  fill: ['#1A1E28', '#0E1118'],
  icon: '#64748B',
  borderWidth: 2,
};

export function achievementTierDef(tier: AchievementTier): AchievementTierDef {
  return ACHIEVEMENT_TIERS[tier];
}
