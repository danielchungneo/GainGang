import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, fontFamily, status } from '../theme';

/** Streak flame pill — "47 DAY STREAK". */
export function StreakPill({ days }: { days: number }) {
  return (
    <View style={[styles.wrap, { backgroundColor: 'rgba(245,165,36,0.08)', borderColor: 'rgba(245,165,36,0.22)' }]}>
      <Text style={styles.flame}>🔥</Text>
      <View>
        <Text style={[styles.count, { color: status.fire }]}>{days}</Text>
        <Text style={styles.label}>DAY STREAK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  flame: { fontSize: 20 },
  count: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 18 },
  label: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 1, color: '#7D8AA8' },
});
