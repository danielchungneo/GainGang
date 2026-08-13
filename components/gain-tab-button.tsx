import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useSegments } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { HapticTab } from '@/components/haptic-tab';
import { useNeedsWeeklyChallengeAttempt } from '@/hooks/use-challenges';
import { status, useTheme } from '@/lib/gaingang-theme';

const GAIN_SIZE = 58;
const STAGE = 88;

type GainTabButtonProps = ComponentProps<typeof HapticTab>;

function useGainTabFocused() {
  const pathname = usePathname();
  const segments = useSegments();

  if (
    pathname === '/' ||
    pathname === '/index' ||
    pathname === '/(tabs)' ||
    pathname === '/(tabs)/index'
  ) {
    return true;
  }

  if (!segments.includes('(tabs)')) return false;
  const leaf = segments[segments.length - 1];
  return leaf === '(tabs)' || leaf === 'index';
}

function PulseRing({
  progress,
  color,
  phase,
}: {
  progress: SharedValue<number>;
  color: string;
  phase: number;
}) {
  const style = useAnimatedStyle(() => {
    const local = (progress.value + phase) % 1;
    return {
      opacity: interpolate(local, [0, 0.12, 0.65, 1], [0, 0.75, 0.2, 0]),
      transform: [{ scale: interpolate(local, [0, 1], [0.88, 1.32]) }],
      borderColor: color,
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.pulseRing, style]} />;
}

/** Raised center tab for the Gain (workout) screen. */
export function GainTabButton({
  children: _children,
  style,
  ...props
}: GainTabButtonProps) {
  const { theme } = useTheme();
  const focused = useGainTabFocused();
  const needsChallengeAttempt = useNeedsWeeklyChallengeAttempt();
  const primary = theme.colors.primary;

  const pulse = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!focused) {
      pulse.value = 0;
      glow.value = 0;
      return;
    }

    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [focused, pulse, glow]);

  const orbStyle = useAnimatedStyle(() => {
    if (!focused) {
      return {
        transform: [{ scale: 1 }],
        shadowOpacity: 0.42,
        shadowRadius: 12,
      };
    }
    return {
      transform: [{ scale: 1.05 + glow.value * 0.045 }],
      shadowOpacity: 0.58 + glow.value * 0.28,
      shadowRadius: 14 + glow.value * 12,
    };
  });

  const coreGlowStyle = useAnimatedStyle(() => ({
    opacity: focused ? 0.35 + glow.value * 0.35 : 0,
    transform: [{ scale: 1 + glow.value * 0.08 }],
  }));

  return (
    <HapticTab
      {...props}
      style={[style, styles.slot]}
      accessibilityLabel={props.accessibilityLabel ?? 'Gain'}
      accessibilityState={{ ...props.accessibilityState, selected: focused }}
    >
      <View style={styles.stage}>
        {focused ? (
          <>
            <PulseRing progress={pulse} color={primary} phase={0} />
            <PulseRing progress={pulse} color="#FFFFFF" phase={0.5} />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.coreGlow,
                { backgroundColor: primary },
                coreGlowStyle,
              ]}
            />
          </>
        ) : null}

        <Animated.View
          style={[styles.orbShadow, { shadowColor: primary }, orbStyle]}
        >
          <LinearGradient
            colors={theme.aura}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.orb,
              {
                borderColor: focused ? '#FFFFFF' : 'rgba(255,255,255,0.28)',
                borderWidth: focused ? 2.5 : 2,
              },
            ]}
          >
            <Ionicons name="barbell" size={26} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

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
  stage: {
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: GAIN_SIZE + 8,
    height: GAIN_SIZE + 8,
    borderRadius: 999,
    borderWidth: 2,
  },
  coreGlow: {
    position: 'absolute',
    width: GAIN_SIZE + 6,
    height: GAIN_SIZE + 6,
    borderRadius: 999,
  },
  orbShadow: {
    borderRadius: GAIN_SIZE / 2,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  orb: {
    width: GAIN_SIZE,
    height: GAIN_SIZE,
    borderRadius: GAIN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: status.danger,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
