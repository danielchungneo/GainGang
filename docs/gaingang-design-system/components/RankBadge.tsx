import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { ranks, RankTier, fontFamily } from '../theme';

export interface RankBadgeProps {
  tier: RankTier;
  /** Diameter-ish footprint of the hexagon in px. */
  size?: number;
  /** Show the "C-RANK" + tier name caption below. */
  showLabel?: boolean;
}

/**
 * Hexagonal rank badge with per-tier luminous glow — the hero element
 * of the system. Uses react-native-svg for the hex + border.
 *
 *   npx expo install react-native-svg
 */
export function RankBadge({ tier, size = 88, showLabel = false }: RankBadgeProps) {
  const r = ranks[tier];
  const h = size * 1.09; // hex is slightly taller than wide
  // pointy-top hexagon points within a size×h box
  const pts = (w: number, ht: number) =>
    `${w * 0.5},0 ${w},${ht * 0.25} ${w},${ht * 0.75} ${w * 0.5},${ht} 0,${ht * 0.75} 0,${ht * 0.25}`;

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: h,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: r.color,
          shadowOpacity: 0.7,
          shadowRadius: size * 0.32,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Svg width={size} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={`fill-${tier}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={r.fill[0]} />
              <Stop offset="1" stopColor={r.fill[1]} />
            </SvgGradient>
          </Defs>
          <Polygon points={pts(size, h)} fill={`url(#fill-${tier})`} />
          <Polygon
            points={pts(size - 4, h - 4)}
            x={2}
            translateX={2}
            translateY={2}
            fill="none"
            stroke={r.color}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        </Svg>
        <Text style={[styles.letter, { color: r.glow, fontSize: size * 0.45 }]}>{tier}</Text>
      </View>

      {showLabel && (
        <>
          <Text style={[styles.rank, { color: r.glow }]}>{tier}-RANK</Text>
          <Text style={styles.name}>{r.name}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  letter: { fontFamily: fontFamily.display },
  rank: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 1.6, marginTop: 12 },
  name: { fontFamily: fontFamily.body, fontSize: 11, color: '#6C7896', marginTop: 2 },
});
