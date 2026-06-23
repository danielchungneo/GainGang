import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, radius } from '../theme';

export interface ProgressBarProps {
  /** 0–1 */
  value: number;
  /** Two-stop gradient for the fill. Defaults to the aura gradient. */
  colors?: readonly [string, string];
  /** Adds a colored glow under the fill. */
  glowColor?: string;
  height?: number;
}

export function ProgressBar({ value, colors, glowColor, height = 9 }: ProgressBarProps) {
  const { theme } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  const fill = colors ?? theme.aura;

  return (
    <View style={[styles.track, { height, backgroundColor: theme.track }]}>
      <LinearGradient
        colors={fill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          StyleSheet.absoluteFill,
          {
            width: `${pct * 100}%`,
            borderRadius: radius.pill,
            shadowColor: glowColor ?? fill[0],
            shadowOpacity: 0.7,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: 'hidden', width: '100%' },
});
