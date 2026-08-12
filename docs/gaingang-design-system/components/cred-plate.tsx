import { useId } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Polygon,
  Rect,
  Stop,
} from 'react-native-svg';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * CredPlate — the Creds currency mark.
 *
 * A weight plate: gold disc, four grips, hexagonal bore that echoes the
 * GainGang rank badge. Drawn on a 64×64 grid; `size` scales it.
 *
 * Detail is dropped below 22px so the mark stays legible in list rows
 * and the HUD chip.
 */

const GOLD_DARK = { light: '#FFD787', mid: '#F5A524', deep: '#C97A0C' };
const GOLD_LIGHT = { light: '#F5A524', mid: '#E0910F', deep: '#A85F06' };
const BORE = '#2C1D0B';

interface CredPlateProps {
  /** Rendered width & height in px. Default 20 (wallet chip size). */
  size?: number;
  /** Award moments and the hero wallet only — never in list rows. */
  glow?: boolean;
  /** Force a theme; defaults to the active scheme. */
  scheme?: 'light' | 'dark';
}

export function CredPlate({ size = 20, glow = false, scheme }: CredPlateProps) {
  const t = useThemeTokens();
  const isDark = scheme ? scheme === 'dark' : !t.isLight;
  const gold = isDark ? GOLD_DARK : GOLD_LIGHT;
  const detailed = size >= 22;
  const uid = useId().replace(/:/g, '');
  const gradId = `credplate-${uid}`;

  const svg = (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={gradId} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={gold.light} />
          <Stop offset="0.55" stopColor={gold.mid} />
          <Stop offset="1" stopColor={gold.deep} />
        </LinearGradient>
      </Defs>

      <Circle cx="32" cy="32" r="30" fill={`url(#${gradId})`} />

      {detailed ? (
        <Circle
          cx="32"
          cy="32"
          r="24.5"
          fill="none"
          stroke="rgba(44,29,11,0.28)"
          strokeWidth="2"
        />
      ) : null}

      <G fill={BORE}>
        <Rect x="29" y="1.5" width="6" height="8" rx="1.5" />
        <Rect x="29" y="54.5" width="6" height="8" rx="1.5" />
        <Rect x="1.5" y="29" width="8" height="6" rx="1.5" />
        <Rect x="54.5" y="29" width="8" height="6" rx="1.5" />
      </G>

      <Polygon points="32,20 42,26 42,38 32,44 22,38 22,26" fill={BORE} />

      {detailed ? (
        <Polygon
          points="32,25.5 37.5,28.7 37.5,35.3 32,38.5 26.5,35.3 26.5,28.7"
          fill={`url(#${gradId})`}
        />
      ) : null}
    </Svg>
  );

  if (!glow) return svg;

  return (
    <View
      style={{
        shadowColor: gold.mid,
        shadowOpacity: isDark ? 0.7 : 0.35,
        shadowRadius: size * 0.38,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }}
    >
      {svg}
    </View>
  );
}
