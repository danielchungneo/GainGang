import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, fontFamily, status } from '../theme';
import { LevelChip } from './RankChip';

export interface LeaderboardRowProps {
  position: number;
  name: string;
  initials: string;
  reps: number;
  level: number;
  /** 0–1 completion, shown as caption. */
  completion?: number;
  /** Two-color avatar gradient. */
  avatarColors?: readonly [string, string];
  /** Highlight as the current user. */
  isYou?: boolean;
}

export function LeaderboardRow({
  position,
  name,
  initials,
  reps,
  level,
  completion,
  avatarColors,
  isYou,
}: LeaderboardRowProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const top = position === 1;
  const posColor = top ? status.warning : isYou ? c.primaryGlow : c.textDim;

  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: c.border },
        top && { backgroundColor: theme.mode === 'dark' ? 'rgba(245,165,36,0.06)' : 'rgba(245,165,36,0.08)' },
        isYou && { backgroundColor: theme.mode === 'dark' ? 'rgba(77,140,255,0.06)' : 'rgba(47,109,255,0.05)' },
      ]}
    >
      <Text style={[styles.pos, { color: posColor }]}>{position}</Text>

      <LinearGradient
        colors={avatarColors ?? theme.aura}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatar}
      >
        <Text style={styles.initials}>{initials}</Text>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: isYou ? c.primaryGlow : c.text }]}>{name}</Text>
        {completion != null && (
          <Text style={[styles.sub, { color: c.textMuted }]}>{Math.round(completion * 100)}% complete</Text>
        )}
      </View>

      <LevelChip level={level} />
      <Text style={[styles.reps, { color: c.text }]}>{reps}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pos: { fontFamily: fontFamily.display, fontSize: 18, width: 24 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fontFamily.display, fontSize: 13, color: '#FFFFFF' },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  sub: { fontFamily: fontFamily.mono, fontSize: 11, marginTop: 2 },
  reps: { fontFamily: fontFamily.monoBold, fontSize: 16, width: 48, textAlign: 'right' },
});
