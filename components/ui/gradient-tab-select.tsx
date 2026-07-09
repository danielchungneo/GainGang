import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily, radius, useTheme } from '@/lib/gaingang-theme';

export interface GradientTabOption<T extends string> {
  key: T;
  label: string;
}

export interface GradientTabSelectProps<T extends string> {
  tabs: GradientTabOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
}

export function GradientTabSelect<T extends string>({
  tabs,
  selected,
  onSelect,
}: GradientTabSelectProps<T>) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor:
            theme.mode === 'dark' ? 'rgba(77,140,255,0.06)' : 'rgba(47,109,255,0.05)',
          borderColor: c.borderGlow,
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = selected === tab.key;

        return (
          <View key={tab.key} style={styles.tabSlot}>
            <Pressable
              onPress={() => onSelect(tab.key)}
              style={({ pressed }) => [
                styles.tabPressable,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              {active ? (
                <LinearGradient
                  colors={theme.aura}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabFillActive}
                >
                  <Text style={styles.tabLabelActive} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.tabFillInactive}>
                  <Text style={[styles.tabLabelInactive, { color: c.textMuted }]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  tabSlot: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  tabPressable: {
    flex: 1,
    width: '100%',
  },
  tabFillActive: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tabFillInactive: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 36,
  },
  tabLabelActive: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelInactive: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 12,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
