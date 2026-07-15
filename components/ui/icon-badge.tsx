import { Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { status } from '@/lib/gaingang-theme';

export interface IconBadgeProps {
  count: number;
  /** Caps the displayed numeral (e.g. 99 → "99+"). */
  max?: number;
  style?: StyleProp<ViewStyle>;
}

/** Small count pill for header / tab icons. Hidden when count is 0. */
export function IconBadge({ count, max = 99, style }: IconBadgeProps) {
  if (count <= 0) return null;

  const label = count > max ? `${max}+` : String(count);

  return (
    <View style={[styles.badge, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: status.danger,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
