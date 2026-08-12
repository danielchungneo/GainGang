import { StyleSheet, Text, View } from 'react-native';

import { fontFamily } from '@/lib/gaingang-theme';
import {
  resolveWarDivision,
  WAR_DIVISION_BADGE,
  warDivisionLabel,
} from '@/lib/gang-wars/divisions';

interface GangDivisionBadgeProps {
  division?: string | null;
  size?: 'sm' | 'md';
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Compact chip showing the gang's current war division. */
export function GangDivisionBadge({
  division,
  size = 'md',
}: GangDivisionBadgeProps) {
  const resolved = resolveWarDivision(division);
  const badge = WAR_DIVISION_BADGE[resolved];
  const isSm = size === 'sm';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${warDivisionLabel(resolved)} division`}
      style={[
        styles.chip,
        {
          borderColor: badge.color,
          backgroundColor: hexA(badge.color, 0.18),
          paddingHorizontal: isSm ? 6 : 8,
          paddingVertical: isSm ? 2 : 3,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: badge.glow,
            fontSize: isSm ? 9 : 10,
            letterSpacing: isSm ? 0.7 : 0.9,
          },
        ]}
      >
        {warDivisionLabel(resolved).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontFamily: fontFamily.monoBold,
  },
});
