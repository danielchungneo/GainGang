/**
 * GainGang — Brand Design Tokens
 *
 * Social fitness app with a Solo Leveling / RPG system aesthetic.
 * Dark-first palette. Three font families. Six rank tiers.
 *
 * Usage:
 *   import { Colors, Gradients, Typography, Spacing, Radius, RankColors } from 'src/brand/constants/brand';
 */

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────

export const Colors = {
  // Void — dark canvas
  void:     '#05070F',
  surface1: '#0E1524',   // Cards, nav bar, modals
  surface2: '#131C30',   // Elevated / nested cards
  surface3: '#1D2840',   // Hover, active, pressed states

  // Light surfaces (light theme / parity)
  lightBase:     '#F4F6FC',
  lightSurface:  '#FFFFFF',
  lightSurface2: '#EEF1FA',
  lightBorder:   '#DFE4F2',

  // Brand
  systemBlue:   '#4D8CFF',
  questViolet:  '#9D4EDD',
  auraBlue:     '#8FB4FF',   // Gradient highlight (light end)
  auraViolet:   '#C77DFF',   // Gradient highlight (dark end)

  // Text — dark theme
  textPrimary:   '#E8EDF7',
  textSecondary: '#AEB8D0',
  textMuted:     '#7D8AA8',
  textSubtle:    '#6C7896',

  // Text — light theme
  textDark:      '#0D1426',
  textDarkMuted: '#5B678C',

  // Borders
  borderSubtle: 'rgba(125, 165, 255, 0.14)',
  borderMedium: 'rgba(125, 165, 255, 0.22)',
  borderStrong: 'rgba(125, 165, 255, 0.45)',

  // Semantic
  success: '#2DD4BF',
  warning: '#F5A524',
  danger:  '#FF3D71',

  // XP / streak
  xp:     '#F5A524',
  streak: '#F5A524',

  // Rank tiers — E (weakest) → S (sovereign)
  rankE: '#64748B',
  rankD: '#2DD4BF',
  rankC: '#4D8CFF',
  rankB: '#9D4EDD',
  rankA: '#F5A524',
  rankS: '#FF3D71',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RANK
// ─────────────────────────────────────────────────────────────────────────────

export type RankTier = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export const RankColors: Record<RankTier, string> = {
  E: Colors.rankE,
  D: Colors.rankD,
  C: Colors.rankC,
  B: Colors.rankB,
  A: Colors.rankA,
  S: Colors.rankS,
};

export const RankLabels: Record<RankTier, string> = {
  E: 'Awakened',
  D: 'Rising',
  C: 'Hunter',
  B: 'Elite',
  A: 'Monarch',
  S: 'Sovereign',
};

// ─────────────────────────────────────────────────────────────────────────────
// GRADIENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All gradient arrays are [start, end] — pass directly to expo-linear-gradient:
 *   <LinearGradient colors={Gradients.brand} start={{x:0.1,y:0}} end={{x:0.9,y:1}} />
 */
export const Gradients = {
  /** Blue → Violet — primary CTAs, mark fill, progress bars */
  brand: ['#4D8CFF', '#9D4EDD'] as [string, string],

  /** Lighter aura — gradient text (GANG wordmark), subtle accents */
  brandLight: ['#8FB4FF', '#C77DFF'] as [string, string],

  /** Light-mode brand gradient */
  brandLightMode: ['#2F6DFF', '#7B2FDE'] as [string, string],

  /** Dark card / icon container surface */
  surface: ['#0E1524', '#131C30'] as [string, string],

  /** XP progress bar */
  xp: ['#4D8CFF', '#8FB4FF'] as [string, string],

  /** Rank S special — crimson pulse */
  rankS: ['#FF3D71', '#FF7396'] as [string, string],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Font family names match the expo-google-fonts package exports:
 *   @expo-google-fonts/chakra-petch
 *   @expo-google-fonts/jetbrains-mono
 *   @expo-google-fonts/hanken-grotesk
 *
 * Load all weights in your root layout — see README.
 */
export const Typography = {
  // Chakra Petch — titles, rank letters, wordmark, CTA buttons
  display700: 'ChakraPetch_700Bold',
  display600: 'ChakraPetch_600SemiBold',
  display400: 'ChakraPetch_400Regular',

  // JetBrains Mono — labels, stats, rep counts, system tags, metadata
  mono700: 'JetBrainsMono_700Bold',
  mono500: 'JetBrainsMono_500Medium',
  mono400: 'JetBrainsMono_400Regular',

  // Hanken Grotesk — body copy, descriptions, UI prose
  body700: 'HankenGrotesk_700Bold',
  body600: 'HankenGrotesk_600SemiBold',
  body500: 'HankenGrotesk_500Medium',
  body400: 'HankenGrotesk_400Regular',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPACING  (4pt base grid)
// ─────────────────────────────────────────────────────────────────────────────

export const Spacing = {
  xxs:  4,
  xs:   8,
  sm:  12,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  xxxl: 72,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RADIUS
// ─────────────────────────────────────────────────────────────────────────────

export const Radius = {
  sm:   8,
  md:  14,
  lg:  18,
  xl:  24,
  pill: 999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SHADOWS / GLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * iOS shadow props — apply to a wrapping View.
 * For Android, use react-native-shadow-2 with startColor from GlowColors.
 */
export const Glow = {
  blue: {
    shadowColor: Colors.systemBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 12,
    elevation: 0,
  },
  violet: {
    shadowColor: Colors.questViolet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 0,
  },
  blueStrong: {
    shadowColor: Colors.systemBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 22,
    elevation: 0,
  },
} as const;
