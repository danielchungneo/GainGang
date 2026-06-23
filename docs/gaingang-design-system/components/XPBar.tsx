import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fontFamily, ranks, RankTier } from '../theme';
import { ProgressBar } from './ProgressBar';

export interface XPBarProps {
  level: number;
  fromTier: RankTier;
  toTier: RankTier;
  currentXp: number;
  targetXp: number;
}

/** Level + XP progress toward the next rank. */
export function XPBar({ level, fromTier, toTier, currentXp, targetXp }: XPBarProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const remaining = Math.max(0, targetXp - currentXp);

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: c.surface,
          borderColor: c.borderGlow,
          shadowColor: c.primary,
          shadowOpacity: theme.mode === 'dark' ? 0.4 : 0.2,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      ]}
    >
      <Text style={[styles.lv, { color: c.primaryGlow }]}>LV.{level}</Text>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text
            style={[styles.meta, styles.rank, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {fromTier}-RANK → {toTier}-RANK
          </Text>
          <Text style={[styles.meta, styles.xp, { color: c.textDim }]}>
            {currentXp.toLocaleString()} / {targetXp.toLocaleString()} XP
          </Text>
        </View>
        <ProgressBar value={currentXp / targetXp} />
        <Text style={[styles.remain, { color: c.textMuted }]}>
          {remaining.toLocaleString()} XP to rank up
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
  },
  lv: {
    fontFamily: fontFamily.display,
    fontSize: 13,
    letterSpacing: 1,
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  meta: { fontFamily: fontFamily.mono, fontSize: 11 },
  rank: { flex: 1 },
  xp: { flexShrink: 0 },
  remain: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    alignSelf: 'flex-end',
  },
});
