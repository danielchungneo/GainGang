import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Polygon,
  Stop,
} from 'react-native-svg';

import {
  achievementIonicon,
  achievementTierDef,
  LOCKED_ACHIEVEMENT_TIER,
  type AchievementTier,
} from '@/lib/achievements';
import { fontFamily } from '@/lib/gaingang-theme';

export interface AchievementBadgeProps {
  /** Value from `achievements.icon` (e.g. flame, dumbbell). */
  icon?: string | null;
  tier: AchievementTier;
  /** When false, uses locked palette + lock glyph. */
  earned?: boolean;
  size?: number;
  showLabel?: boolean;
  /** Optional title under the medal (achievement name). */
  title?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Pointy-top hexagon (same proportions as LevelBadge). */
function hexPoints(w: number, ht: number): string {
  return `${w * 0.5},0 ${w},${ht * 0.25} ${w},${ht * 0.75} ${w * 0.5},${ht} 0,${ht * 0.75} 0,${ht * 0.25}`;
}

/**
 * Hexagonal achievement badge with a metal tier frame.
 * Locked: muted slate + lock glyph. Unlocked: tier colors + achievement icon.
 */
export function AchievementBadge({
  icon,
  tier,
  earned = true,
  size = 72,
  showLabel = false,
  title,
  onPress,
  accessibilityLabel,
}: AchievementBadgeProps) {
  const def = earned ? achievementTierDef(tier) : LOCKED_ACHIEVEMENT_TIER;
  const framePad = Math.max(def.borderWidth, 2) + (earned ? 2 : 1);
  const bodyW = size;
  const bodyH = size * 1.09;
  const outerW = bodyW + framePad * 2;
  const outerH = bodyH + framePad * 2;
  const iconSize = Math.round(size * (earned ? 0.4 : 0.34));
  const ionicon = earned ? achievementIonicon(icon) : 'lock-closed';
  const fillId = `ach-fill-${tier}-${earned ? 'e' : 'l'}-${size}`;
  const frameId = `ach-frame-${tier}-${earned ? 'e' : 'l'}-${size}`;
  const rimInset = earned ? 2 : 3;

  const badge = (
    <View style={styles.wrap}>
      <View
        style={{
          width: outerW,
          height: outerH,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: def.glow,
          shadowOpacity: earned ? 0.75 : 0.12,
          shadowRadius: size * (earned ? 0.36 : 0.12),
          shadowOffset: { width: 0, height: 0 },
          elevation: earned ? 6 : 0,
          opacity: earned ? 1 : 0.85,
        }}
      >
        <Svg width={outerW} height={outerH} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={fillId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={def.fill[0]} />
              <Stop offset="1" stopColor={def.fill[1]} />
            </SvgGradient>
            <SvgGradient id={frameId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={def.border[0]} />
              <Stop offset="1" stopColor={def.border[1]} />
            </SvgGradient>
          </Defs>
          <Polygon points={hexPoints(outerW, outerH)} fill={`url(#${frameId})`} opacity={0.98} />
          <Polygon
            points={hexPoints(bodyW, bodyH)}
            fill={`url(#${fillId})`}
            translateX={framePad}
            translateY={framePad}
          />
          <Polygon
            points={hexPoints(bodyW - rimInset * 2, bodyH - rimInset * 2)}
            fill="none"
            stroke={def.glow}
            strokeOpacity={earned ? 0.55 : 0.2}
            strokeWidth={earned ? Math.max(def.borderWidth * 0.55, 1) : 1}
            strokeDasharray={earned ? undefined : '4 3'}
            translateX={framePad + rimInset}
            translateY={framePad + rimInset}
          />
        </Svg>
        <Ionicons name={ionicon} size={iconSize} color={def.icon} />
      </View>

      {showLabel && (
        <>
          {title ? (
            <Text
              style={[styles.title, { color: earned ? def.glow : '#6C7896' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
          ) : null}
          <Text style={styles.tierName}>{earned ? def.name : 'Locked'}</Text>
        </>
      )}
    </View>
  );

  if (!onPress) return badge;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (earned ? `${title ?? 'Achievement'}, ${def.name}` : `Locked achievement${title ? `: ${title}` : ''}`)
      }
      style={({ pressed }) => [styles.pressable, pressed ? { opacity: 0.85 } : null]}
    >
      {badge}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
    alignItems: 'center',
  },
  wrap: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    width: '100%',
    paddingHorizontal: 2,
  },
  tierName: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#6C7896',
    marginTop: 4,
  },
});
