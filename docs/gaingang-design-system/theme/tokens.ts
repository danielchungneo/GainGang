/**
 * GainGang Design System — Core Tokens
 * Calisthenics. Community. Quest.
 *
 * Single source of truth for color, type, spacing, radius and elevation.
 * Pure data — no React Native imports — so it can be used anywhere
 * (components, navigation themes, storybook, tests).
 */

// ───────────────────────────────────────────────────────────
// BRAND
// ───────────────────────────────────────────────────────────
export const brand = {
  blue: '#4D8CFF', // System Blue — primary
  blueDeep: '#3B6FD9',
  blueGlow: '#8FB4FF', // Aura highlight
  violet: '#9D4EDD', // Quest Violet — secondary
  violetDeep: '#7B35C2',
  violetGlow: '#C77DFF',
} as const;

/** Signature blue→violet "aura" gradient used on primary CTAs, avatars, accents. */
export const auraGradient = [brand.blue, brand.violet] as const;
export const auraGradientLight = ['#2F6DFF', '#7B2FDE'] as const;

// ───────────────────────────────────────────────────────────
// RANK TIERS  (E → S — "rising heat")
// ───────────────────────────────────────────────────────────
export type RankTier = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface RankDef {
  tier: RankTier;
  /** Primary luminous color of the tier. */
  color: string;
  /** Brighter text/icon variant for legibility on dark badges. */
  glow: string;
  /** Dark gradient pair behind the tier letter. */
  fill: [string, string];
  /** Human-facing tier title. */
  name: string;
}

export const ranks: Record<RankTier, RankDef> = {
  E: { tier: 'E', color: '#64748B', glow: '#94A3B8', fill: ['#2A3346', '#171D2B'], name: 'Awakened' },
  D: { tier: 'D', color: '#2DD4BF', glow: '#2DD4BF', fill: ['#103A35', '#0D201D'], name: 'Rising' },
  C: { tier: 'C', color: '#4D8CFF', glow: '#7EAAFF', fill: ['#13315F', '#0D1A32'], name: 'Hunter' },
  B: { tier: 'B', color: '#9D4EDD', glow: '#C77DFF', fill: ['#321A52', '#1B0F2D'], name: 'Elite' },
  A: { tier: 'A', color: '#F5A524', glow: '#F5A524', fill: ['#523616', '#2C1D0B'], name: 'Monarch' },
  S: { tier: 'S', color: '#FF3D71', glow: '#FF7396', fill: ['#5C1430', '#2E0A18'], name: 'Sovereign' },
};

export const rankOrder: RankTier[] = ['E', 'D', 'C', 'B', 'A', 'S'];

// ───────────────────────────────────────────────────────────
// SEMANTIC / STATUS
// ───────────────────────────────────────────────────────────
export const status = {
  success: '#2DD4BF',
  warning: '#F5A524',
  danger: '#FF3D71',
  fire: '#F5A524', // streaks, "Fire" reaction
} as const;

// ───────────────────────────────────────────────────────────
// SPACING — 4pt base
// ───────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ───────────────────────────────────────────────────────────
// RADIUS — soft & approachable
// ───────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 11,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

// ───────────────────────────────────────────────────────────
// TYPOGRAPHY
// Three roles: Display (Chakra Petch), Mono/Data (JetBrains Mono),
// Body (Hanken Grotesk). Font *keys* map to loaded font names in fonts.ts.
// ───────────────────────────────────────────────────────────
export const fontFamily = {
  display: 'ChakraPetch_700Bold',
  displaySemi: 'ChakraPetch_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemi: 'HankenGrotesk_600SemiBold',
} as const;

/** Ready-made text style presets. Spread into a Text style. */
export const type = {
  display: { fontFamily: fontFamily.display, fontSize: 44, lineHeight: 46, letterSpacing: -0.5 },
  heading: { fontFamily: fontFamily.displaySemi, fontSize: 28, lineHeight: 32 },
  questTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30 },
  rankLetter: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 40 },
  label: { fontFamily: fontFamily.mono, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' as const },
  labelSm: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  data: { fontFamily: fontFamily.monoBold, fontSize: 16 },
  dataSm: { fontFamily: fontFamily.mono, fontSize: 11 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 25 },
  bodySm: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
} as const;
