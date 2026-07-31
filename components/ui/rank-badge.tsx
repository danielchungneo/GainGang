import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Polygon,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';

import {
  parseBorderStyle,
  type CosmeticBorderStyle,
} from '@/lib/cosmetics';
import { fontFamily, levelBadgeForLevel } from '@/lib/gaingang-theme';
import type { Json } from '@/types/database';

export interface LevelBadgeProps {
  level: number;
  size?: number;
  showLabel?: boolean;
  /** Overrides the center numeral (e.g. "XP" for reward rarity badges). */
  centerLabel?: string;
  /** Cosmetic frame style jsonb or parsed border. */
  borderStyle?: Json | CosmeticBorderStyle | null;
}

function levelFontSize(level: number, size: number): number {
  if (level < 10) return size * 0.45;
  if (level < 100) return size * 0.32;
  return size * 0.24;
}

function centerLabelFontSize(label: string, size: number): number {
  if (label.length <= 2) return size * 0.34;
  if (label.length <= 3) return size * 0.26;
  return size * 0.2;
}

function resolveBorder(
  borderStyle?: Json | CosmeticBorderStyle | null,
): CosmeticBorderStyle | null {
  if (!borderStyle) return null;
  if (
    typeof borderStyle === 'object' &&
    !Array.isArray(borderStyle) &&
    'colors' in borderStyle &&
    Array.isArray((borderStyle as CosmeticBorderStyle).colors)
  ) {
    const colors = (borderStyle as CosmeticBorderStyle).colors;
    if (colors.length > 0 && typeof colors[0] === 'string') {
      return borderStyle as CosmeticBorderStyle;
    }
  }
  return parseBorderStyle(borderStyle as Json);
}

export function LevelBadge({
  level,
  size = 88,
  showLabel = false,
  centerLabel,
  borderStyle,
}: LevelBadgeProps) {
  const resolvedLevel = Math.max(1, level);
  const badge = levelBadgeForLevel(resolvedLevel);
  const border = resolveBorder(borderStyle);
  const framePad = border ? Math.max(border.width ?? 2, 2) + 2 : 0;
  const h = size * 1.09;
  const outerW = size + framePad * 2;
  const outerH = h + framePad * 2;
  const gradId = `level-fill-${resolvedLevel}-${centerLabel ?? 'n'}`;
  const frameGradId = `level-frame-${resolvedLevel}-${centerLabel ?? 'n'}`;
  const display = centerLabel ?? String(resolvedLevel);
  const fontSize = centerLabel
    ? centerLabelFontSize(centerLabel, size)
    : levelFontSize(resolvedLevel, size);
  const pts = (w: number, ht: number) =>
    `${w * 0.5},0 ${w},${ht * 0.25} ${w},${ht * 0.75} ${w * 0.5},${ht} 0,${ht * 0.75} 0,${ht * 0.25}`;

  const frameColor = border?.colors[0] ?? badge.color;
  const frameColor2 = border?.colors[1] ?? border?.colors[0] ?? badge.glow;

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: outerW,
          height: outerH,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: border?.glow ?? badge.color,
          shadowOpacity: border ? 0.85 : 0.7,
          shadowRadius: size * (border ? 0.38 : 0.32),
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Svg width={outerW} height={outerH} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={badge.fill[0]} />
              <Stop offset="1" stopColor={badge.fill[1]} />
            </SvgGradient>
            {border ? (
              <SvgGradient id={frameGradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={frameColor} />
                <Stop offset="1" stopColor={frameColor2} />
              </SvgGradient>
            ) : null}
          </Defs>
          {border ? (
            <Polygon
              points={pts(outerW, outerH)}
              fill={`url(#${frameGradId})`}
              opacity={0.95}
            />
          ) : null}
          <Polygon
            points={pts(size, h)}
            x={framePad}
            translateX={framePad}
            translateY={framePad}
            fill={`url(#${gradId})`}
          />
          <Polygon
            points={pts(size - 4, h - 4)}
            x={framePad + 2}
            translateX={framePad + 2}
            translateY={framePad + 2}
            fill="none"
            stroke={border?.glow ?? badge.color}
            strokeOpacity={border ? 0.85 : 0.5}
            strokeWidth={border ? Math.max(border.width ?? 2, 1.5) : 1}
          />
        </Svg>
        <Text style={[styles.level, { color: badge.glow, fontSize }]}>
          {display}
        </Text>
      </View>

      {showLabel && (
        <>
          <Text style={[styles.label, { color: badge.glow }]}>
            LEVEL {resolvedLevel}
          </Text>
          <Text style={styles.tierName}>{badge.name}</Text>
        </>
      )}
    </View>
  );
}

/** @deprecated Use LevelBadge with `level` instead. */
export const RankBadge = LevelBadge;
export type RankBadgeProps = LevelBadgeProps;

export function levelColor(level: number): string {
  return levelBadgeForLevel(level).color;
}

/** @deprecated Use levelColor instead. */
export const RANK_COLORS = {} as Record<string, string>;

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
