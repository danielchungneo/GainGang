import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, levelBadgeForLevel } from '../theme';

export function LevelChip({ level }: { level: number }) {
  const badge = levelBadgeForLevel(Math.max(1, level));
  return (
    <View
      style={[
        styles.chip,
        { borderColor: badge.color, backgroundColor: hexA(badge.color, 0.14) },
      ]}
    >
      <Text style={[styles.text, { color: badge.glow }]}>{level}</Text>
    </View>
  );
}

/** @deprecated Use LevelChip */
export const RankChip = LevelChip;

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  text: { fontFamily: fontFamily.mono, fontSize: 9, letterSpacing: 0.5 },
});
