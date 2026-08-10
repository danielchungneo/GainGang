import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useNeedsWeeklyChallengeAttempt } from '@/hooks/use-challenges';
import { status, useTheme } from '@/lib/gaingang-theme';

const GAIN_SIZE = 58;

type GainTabButtonProps = ComponentProps<typeof HapticTab>;

/** Raised center tab for the Gain (workout) screen. */
export function GainTabButton({
  children: _children,
  style,
  ...props
}: GainTabButtonProps) {
  const { theme } = useTheme();
  const focused = !!props.accessibilityState?.selected;
  const needsChallengeAttempt = useNeedsWeeklyChallengeAttempt();

  return (
    <HapticTab
      {...props}
      style={[style, styles.slot]}
      accessibilityLabel={props.accessibilityLabel ?? 'Gain'}
    >
      <View>
        <LinearGradient
          colors={theme.aura}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.orb,
            {
              borderColor: focused ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)',
              shadowColor: theme.colors.primary,
              transform: [{ scale: focused ? 1.04 : 1 }],
            },
          ]}
        >
          <Ionicons name="barbell" size={26} color="#FFFFFF" />
        </LinearGradient>
        {needsChallengeAttempt ? (
          <View
            style={styles.badge}
            accessibilityLabel="Weekly challenge available"
          />
        ) : null}
      </View>
    </HapticTab>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    top: -16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: GAIN_SIZE,
    height: GAIN_SIZE,
    borderRadius: GAIN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 10,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: status.danger,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
