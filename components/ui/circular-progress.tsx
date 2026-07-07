import { useId } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { fontFamily, status, useTheme } from '@/lib/gaingang-theme';

export interface CircularProgressProps {
  /** Progress value from 0 to 1. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Center label, e.g. "72%" */
  label?: string;
  /** Smaller caption under the label inside the ring. */
  caption?: string;
  complete?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 10,
  label,
  caption,
  complete = false,
  style,
}: CircularProgressProps) {
  const { theme } = useTheme();
  const gradId = useId().replace(/:/g, '');
  const pct = Math.max(0, Math.min(1, value));
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);
  const progressColors = complete ? ([status.success, status.success] as const) : theme.aura;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={progressColors[0]} />
            <Stop offset="1" stopColor={progressColors[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {pct > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {label ? (
          <Text
            style={[
              styles.label,
              { color: complete ? status.success : theme.colors.primaryGlow },
            ]}
          >
            {label}
          </Text>
        ) : null}
        {caption ? (
          <Text style={[styles.caption, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    maxWidth: '88%',
  },
  label: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    lineHeight: 30,
  },
  caption: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: 2,
    textAlign: 'center',
  },
});
