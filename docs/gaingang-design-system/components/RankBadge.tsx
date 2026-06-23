import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { fontFamily, levelBadgeForLevel } from '../theme';

export interface LevelBadgeProps {
  level: number;
  size?: number;
  showLabel?: boolean;
}

function levelFontSize(level: number, size: number): number {
  if (level < 10) return size * 0.45;
  if (level < 100) return size * 0.32;
  return size * 0.24;
}

/** Hexagonal level badge — color shifts every 10 levels. */
export function LevelBadge({ level, size = 88, showLabel = false }: LevelBadgeProps) {
  const resolvedLevel = Math.max(1, level);
  const badge = levelBadgeForLevel(resolvedLevel);
  const h = size * 1.09;
  const gradId = `level-fill-${resolvedLevel}`;
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
          shadowColor: badge.color,
          shadowOpacity: 0.7,
          shadowRadius: size * 0.32,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Svg width={size} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={badge.fill[0]} />
              <Stop offset="1" stopColor={badge.fill[1]} />
            </SvgGradient>
          </Defs>
          <Polygon points={pts(size, h)} fill={`url(#${gradId})`} />
          <Polygon
            points={pts(size - 4, h - 4)}
            x={2}
            translateX={2}
            translateY={2}
            fill="none"
            stroke={badge.color}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        </Svg>
        <Text
          style={[styles.level, { color: badge.glow, fontSize: levelFontSize(resolvedLevel, size) }]}
        >
          {resolvedLevel}
        </Text>
      </View>

      {showLabel && (
        <>
          <Text style={[styles.label, { color: badge.glow }]}>LEVEL {resolvedLevel}</Text>
          <Text style={styles.tierName}>{badge.name}</Text>
        </>
      )}
    </View>
  );
}

/** @deprecated Use LevelBadge */
export const RankBadge = LevelBadge;
export type RankBadgeProps = LevelBadgeProps;

const styles = StyleSheet.create({
  level: { fontFamily: fontFamily.display },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 12,
  },
  tierName: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: '#6C7896',
    marginTop: 2,
  },
});
