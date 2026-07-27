import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily } from '@/lib/gaingang-theme';

const SCREEN = Dimensions.get('window');
const CARD_W = Math.min(SCREEN.width - 48, 320);
const RING_SIZE = 280;
const RING_L = SCREEN.width / 2 - RING_SIZE / 2;
const RING_T = SCREEN.height / 2 - RING_SIZE / 2;

const ACCENT = '#4D8CFF';
const ACCENT_GLOW = '#8FB4FF';
const BORDER_DIM = 'rgba(77,140,255,0.28)';
const BORDER_GLOW = 'rgba(77,140,255,0.9)';

const T = {
  bgDur: 380,
  cardDelay: 160,
  cardDur: 520,
  lockDelay: 280,
  lockDur: 480,
  shakeDelay: 780,
  unlockDelay: 980,
  unlockDur: 520,
  stampDelay: 1180,
  ring1: 1400,
  ring2: 1540,
  ring3: 1680,
  ringDur: 1000,
} as const;

const H = {
  card: T.cardDelay,
  shake: T.shakeDelay,
  unlock: T.unlockDelay + 80,
  stamp: T.stampDelay + 120,
  ring1: T.ring1,
  ring2: T.ring2,
  ring3: T.ring3,
} as const;

function scheduleUnlockHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  function at(ms: number, fn: () => void) {
    timeouts.push(setTimeout(fn, ms));
  }

  at(H.card, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });
  at(H.shake, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });
  at(H.unlock, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
  at(H.stamp, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });
  for (const ms of [H.ring1, H.ring2, H.ring3]) {
    at(ms, () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  }

  return () => timeouts.forEach(clearTimeout);
}

export interface ScreenTimeUnlockOverlayProps {
  visible: boolean;
  onDismiss?: () => void;
}

/**
 * Celebration when Focus lock lifts after today's personal goals are cleared.
 * Closed lock → shake → open lock, with GainGang-styled stamp + aura rings.
 */
export function ScreenTimeUnlockOverlay({
  visible,
  onDismiss,
}: ScreenTimeUnlockOverlayProps) {
  const bg = useSharedValue(0);
  const card = useSharedValue(0);
  const lockScale = useSharedValue(0.4);
  const lockShake = useSharedValue(0);
  const closedOpacity = useSharedValue(1);
  const openOpacity = useSharedValue(0);
  const openRotate = useSharedValue(-12);
  const stamp = useSharedValue(0);
  const borderGlow = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      bg.value = 0;
      card.value = 0;
      lockScale.value = 0.4;
      lockShake.value = 0;
      closedOpacity.value = 1;
      openOpacity.value = 0;
      openRotate.value = -12;
      stamp.value = 0;
      borderGlow.value = 0;
      ring1.value = 0;
      ring2.value = 0;
      ring3.value = 0;
      return;
    }

    const clearHaptics = scheduleUnlockHaptics();

    bg.value = withTiming(1, { duration: T.bgDur, easing: Easing.out(Easing.cubic) });
    card.value = withDelay(
      T.cardDelay,
      withSpring(1, { damping: 14, stiffness: 160 }),
    );
    lockScale.value = withDelay(
      T.lockDelay,
      withSpring(1, { damping: 12, stiffness: 180 }),
    );
    lockShake.value = withDelay(
      T.shakeDelay,
      withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-8, { duration: 45 }),
        withTiming(8, { duration: 45 }),
        withTiming(0, { duration: 40 }),
      ),
    );
    closedOpacity.value = withDelay(
      T.unlockDelay,
      withTiming(0, { duration: T.unlockDur * 0.45, easing: Easing.in(Easing.quad) }),
    );
    openOpacity.value = withDelay(
      T.unlockDelay + 80,
      withTiming(1, { duration: T.unlockDur * 0.55, easing: Easing.out(Easing.cubic) }),
    );
    openRotate.value = withDelay(
      T.unlockDelay + 80,
      withSpring(0, { damping: 10, stiffness: 140 }),
    );
    stamp.value = withDelay(
      T.stampDelay,
      withSpring(1, { damping: 11, stiffness: 170 }),
    );
    borderGlow.value = withDelay(
      T.unlockDelay,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    const ringAnim = (delay: number) =>
      withDelay(
        delay,
        withTiming(1, { duration: T.ringDur, easing: Easing.out(Easing.cubic) }),
      );
    ring1.value = ringAnim(T.ring1);
    ring2.value = ringAnim(T.ring2);
    ring3.value = ringAnim(T.ring3);

    return clearHaptics;
  }, [
    visible,
    bg,
    borderGlow,
    card,
    closedOpacity,
    lockScale,
    lockShake,
    openOpacity,
    openRotate,
    ring1,
    ring2,
    ring3,
    stamp,
  ]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bg.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [
      { translateY: interpolate(card.value, [0, 1], [36, 0]) },
      { scale: interpolate(card.value, [0, 1], [0.92, 1]) },
    ],
    borderColor: interpolateColor(borderGlow.value, [0, 1], [BORDER_DIM, BORDER_GLOW]),
  }));

  const lockWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: lockScale.value },
      { translateX: lockShake.value },
    ],
  }));

  const closedStyle = useAnimatedStyle(() => ({
    opacity: closedOpacity.value,
    transform: [{ scale: closedOpacity.value }],
  }));

  const openStyle = useAnimatedStyle(() => ({
    opacity: openOpacity.value,
    transform: [
      { scale: interpolate(openOpacity.value, [0, 1], [0.7, 1]) },
      { rotate: `${openRotate.value}deg` },
    ],
  }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [1.35, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-8, -2])}deg` },
    ],
  }));

  const r1 = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.2, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.35, 1.15]) }],
  }));
  const r2 = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.2, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.35, 1.35]) }],
  }));
  const r3 = useAnimatedStyle(() => ({
    opacity: interpolate(ring3.value, [0, 0.2, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(ring3.value, [0, 1], [0.35, 1.55]) }],
  }));

  function handleDismiss() {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onDismiss?.();
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable style={styles.root} onPress={handleDismiss} accessibilityRole="button">
        <Animated.View style={[styles.backdrop, bgStyle]} />

        <Animated.View pointerEvents="none" style={[styles.ring, r1]} />
        <Animated.View pointerEvents="none" style={[styles.ring, r2]} />
        <Animated.View pointerEvents="none" style={[styles.ring, r3]} />

        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.eyebrow}>FOCUS LOCK</Text>

          <Animated.View style={[styles.lockStage, lockWrapStyle]}>
            <Animated.View style={[styles.lockLayer, closedStyle]}>
              <Ionicons name="lock-closed" size={72} color={ACCENT} />
            </Animated.View>
            <Animated.View style={[styles.lockLayer, openStyle]}>
              <Ionicons name="lock-open" size={72} color={ACCENT_GLOW} />
            </Animated.View>
          </Animated.View>

          <Animated.View style={[styles.stamp, stampStyle]}>
            <Text style={styles.stampText}>UNLOCKED</Text>
          </Animated.View>

          <Text style={styles.subtitle}>
            Today’s goals are done. Your restricted apps are open for the rest of
            the day.
          </Text>

          <Text style={styles.hint}>Tap anywhere to continue</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,7,15,0.88)',
  },
  ring: {
    position: 'absolute',
    left: RING_L,
    top: RING_T,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  card: {
    width: CARD_W,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#0E1524',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 14,
  },
  eyebrow: {
    fontFamily: fontFamily.display,
    fontSize: 12,
    letterSpacing: 2.4,
    color: ACCENT_GLOW,
  },
  lockStage: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  lockLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stamp: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: 'rgba(77,140,255,0.12)',
  },
  stampText: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    letterSpacing: 3,
    color: '#E8EDF7',
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#AEB8D0',
  },
  hint: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: 'rgba(174,184,208,0.65)',
    marginTop: 4,
  },
});
