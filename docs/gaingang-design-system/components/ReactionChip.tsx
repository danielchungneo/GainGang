import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fontFamily } from '../theme';

export type ReactionKind = 'fire' | 'respect' | 'beast';

const META: Record<ReactionKind, { emoji: string; label: string; color: string; tint: string }> = {
  fire: { emoji: '🔥', label: 'Fire', color: '#F5A524', tint: 'rgba(245,165,36,0.12)' },
  respect: { emoji: '🙌', label: 'Respect', color: '#8FB4FF', tint: 'rgba(77,140,255,0.10)' },
  beast: { emoji: '💪', label: 'Beast Mode', color: '#FF7396', tint: 'rgba(255,61,113,0.10)' },
};

export interface ReactionChipProps {
  kind: ReactionKind;
  count?: number;
  active?: boolean;
  onPress?: () => void;
}

/** Tiered reaction / kudos pill. */
export function ReactionChip({ kind, count }: ReactionChipProps) {
  const m = META[kind];
  return (
    <View style={[styles.chip, { backgroundColor: m.tint, borderColor: m.color }]}>
      <Text style={styles.emoji}>{m.emoji}</Text>
      <Text style={[styles.text, { color: m.color }]}>
        {m.label}
        {count != null ? ` ${count}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  emoji: { fontSize: 13 },
  text: { fontFamily: fontFamily.mono, fontSize: 12 },
});
