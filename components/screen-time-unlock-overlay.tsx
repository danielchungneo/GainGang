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
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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
const ACCENT_SOFT = 'rgba(77,140,255,0.22)';
const BORDER_DIM = 'rgba(77,140,255,0.28)';
const BORDER_GLOW = 'rgba(143,180,255,0.85)';

const T = {
  bgDur: 340,
  cardDelay: 120,
  cardDur: 420,
  lockDelay: 240,
  lockDur: 380,
  shakeDelay: 700,
  unlockDelay: 900,
  unlockDur: 420,
  flashDelay: 900,
  stampDelay: 1120,
  ring1: 1080,
  ring2: 1220,
  ring3: 1360,
  ringDur: 900,
} as const;

const H = {
  card: T.cardDelay,
  shake: T.shakeDelay,
  unlock: T.unlockDelay + 40,
  stamp: T.stampDelay + 80,
  ring1: T.ring1,
  ring2: T.ring2,
  ring3: T.ring3,
} as const;

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 + 0.35;
  return {
    angle,
    dist: 42 + (i % 4) * 14,
    size: 4 + (i % 3) * 2,
    delay: (i % 5) * 24,
    rotate: (i % 2 === 0 ? 1 : -1) * (14 + (i % 4) * 8),
  };
});

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

function UnlockSpark({
  progress,
  spark,
  color,
}: {
  progress: SharedValue<number>;
  spark: (typeof SPARKS)[number];
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const local = Math.max(0, Math.min(1, (progress.value * 1000 - spark.delay) / 480));
    const eased = 1 - Math.pow(1 - local, 3);
    return {
      opacity: local > 0 && local < 1 ? Math.sin(local * Math.PI) : 0,
      transform: [
        { translateX: Math.cos(spark.angle) * spark.dist * eased },
        { translateY: Math.sin(spark.angle) * spark.dist * eased },
        { rotate: `${spark.rotate * eased}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: spark.size,
          height: spark.size * 0.45,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
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
  const lockEnter = useSharedValue(0);
  const lockShake = useSharedValue(0);
  const closedOpacity = useSharedValue(1);
  const openOpacity = useSharedValue(0);
  const openRotate = useSharedValue(-14);
  const platePulse = useSharedValue(0);
  const flash = useSharedValue(0);
  const spark = useSharedValue(0);
  const stamp = useSharedValue(0);
  const stampPulse = useSharedValue(0);
  const checkIn = useSharedValue(0);
  const borderGlow = useSharedValue(0);
  const copyIn = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      bg.value = 0;
      card.value = 0;
      lockEnter.value = 0;
      lockShake.value = 0;
      closedOpacity.value = 1;
      openOpacity.value = 0;
      openRotate.value = -14;
      platePulse.value = 0;
      flash.value = 0;
      spark.value = 0;
      stamp.value = 0;
      stampPulse.value = 0;
      checkIn.value = 0;
      borderGlow.value = 0;
      copyIn.value = 0;
      ring1.value = 0;
      ring2.value = 0;
      ring3.value = 0;
      return;
    }

    const clearHaptics = scheduleUnlockHaptics();
    const ease = Easing.out(Easing.cubic);

    bg.value = withTiming(1, { duration: T.bgDur, easing: ease });
    card.value = withDelay(
      T.cardDelay,
      withTiming(1, { duration: T.cardDur, easing: ease }),
    );
    lockEnter.value = withDelay(
      T.lockDelay,
      withTiming(1, { duration: T.lockDur, easing: ease }),
    );
    platePulse.value = withDelay(
      T.lockDelay + 80,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    lockShake.value = withDelay(
      T.shakeDelay,
      withSequence(
        withTiming(-9, { duration: 45 }),
        withTiming(9, { duration: 45 }),
        withTiming(-7, { duration: 40 }),
        withTiming(7, { duration: 40 }),
        withTiming(-4, { duration: 35 }),
        withTiming(0, { duration: 35 }),
      ),
    );

    flash.value = withDelay(
      T.flashDelay,
      withSequence(
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 320, easing: ease }),
      ),
    );

    closedOpacity.value = withDelay(
      T.unlockDelay,
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
    );
    openOpacity.value = withDelay(
      T.unlockDelay + 60,
      withTiming(1, { duration: T.unlockDur * 0.55, easing: ease }),
    );
    openRotate.value = withDelay(
      T.unlockDelay + 60,
      withTiming(0, { duration: 360, easing: ease }),
    );

    spark.value = withDelay(
      T.unlockDelay + 40,
      withTiming(1, { duration: 560, easing: ease }),
    );

    borderGlow.value = withDelay(
      T.unlockDelay,
      withTiming(1, { duration: 420, easing: ease }),
    );

    stamp.value = withDelay(
      T.stampDelay,
      withTiming(1, { duration: 300, easing: ease }),
    );
    checkIn.value = withDelay(
      T.stampDelay + 40,
      withTiming(1, { duration: 260, easing: ease }),
    );
    stampPulse.value = withDelay(
      T.stampDelay + 280,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    copyIn.value = withDelay(
      T.stampDelay + 160,
      withTiming(1, { duration: 340, easing: ease }),
    );

    const ringAnim = (delay: number) =>
      withDelay(delay, withTiming(1, { duration: T.ringDur, easing: ease }));
    ring1.value = ringAnim(T.ring1);
    ring2.value = ringAnim(T.ring2);
    ring3.value = ringAnim(T.ring3);

    return clearHaptics;
  }, [
    visible,
    bg,
    borderGlow,
    card,
    checkIn,
    closedOpacity,
    copyIn,
    flash,
    lockEnter,
    lockShake,
    openOpacity,
    openRotate,
    platePulse,
    ring1,
    ring2,
    ring3,
    spark,
    stamp,
    stampPulse,
  ]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bg.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.55,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ translateY: interpolate(card.value, [0, 1], [28, 0]) }],
    borderColor: interpolateColor(borderGlow.value, [0, 1], [BORDER_DIM, BORDER_GLOW]),
  }));

  const lockWrapStyle = useAnimatedStyle(() => ({
    opacity: lockEnter.value,
    transform: [
      { translateY: interpolate(lockEnter.value, [0, 1], [10, 0]) },
      { translateX: lockShake.value },
    ],
  }));

  const plateGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + platePulse.value * 0.22 + borderGlow.value * 0.2,
  }));

  const plateRingStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      borderGlow.value,
      [0, 1],
      ['rgba(77,140,255,0.35)', ACCENT_GLOW],
    ),
    opacity: 0.55 + platePulse.value * 0.35,
  }));

  const closedStyle = useAnimatedStyle(() => ({
    opacity: closedOpacity.value,
  }));

  const openStyle = useAnimatedStyle(() => ({
    opacity: openOpacity.value,
    transform: [{ rotate: `${openRotate.value}deg` }],
  }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ translateY: interpolate(stamp.value, [0, 1], [14, 0]) }],
  }));

  const stampAuraStyle = useAnimatedStyle(() => ({
    opacity: stamp.value * (0.25 + stampPulse.value * 0.35),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkIn.value,
    transform: [{ translateX: interpolate(checkIn.value, [0, 1], [-6, 0]) }],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyIn.value,
    transform: [{ translateY: interpolate(copyIn.value, [0, 1], [8, 0]) }],
  }));

  const r1 = useAnimatedStyle(() => ({
    opacity: interpolate(ring1.value, [0, 0.18, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.4, 1.12]) }],
  }));
  const r2 = useAnimatedStyle(() => ({
    opacity: interpolate(ring2.value, [0, 0.18, 1], [0, 0.42, 0]),
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.4, 1.32]) }],
  }));
  const r3 = useAnimatedStyle(() => ({
    opacity: interpolate(ring3.value, [0, 0.18, 1], [0, 0.32, 0]),
    transform: [{ scale: interpolate(ring3.value, [0, 1], [0.4, 1.52]) }],
  }));

  function handleDismiss() {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onDismiss?.();
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable style={styles.root} onPress={handleDismiss} accessibilityRole="button">
        <Animated.View style={[styles.backdrop, bgStyle]} />
        <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />

        <Animated.View pointerEvents="none" style={[styles.ring, r1]} />
        <Animated.View pointerEvents="none" style={[styles.ring, r2]} />
        <Animated.View pointerEvents="none" style={[styles.ring, r3]} />

        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.eyebrow}>FOCUS LOCK</Text>

          <Animated.View style={[styles.lockStage, lockWrapStyle]}>
            <Animated.View pointerEvents="none" style={[styles.plateGlow, plateGlowStyle]} />
            <Animated.View pointerEvents="none" style={[styles.plateRing, plateRingStyle]} />

            <Animated.View style={[styles.lockLayer, closedStyle]}>
              <Ionicons name="lock-closed" size={64} color={ACCENT} />
            </Animated.View>
            <Animated.View style={[styles.lockLayer, openStyle]}>
              <Ionicons name="lock-open" size={64} color={ACCENT_GLOW} />
            </Animated.View>

            {SPARKS.map((s, i) => (
              <UnlockSpark
                key={`spark-${i}`}
                progress={spark}
                spark={s}
                color={i % 2 === 0 ? ACCENT_GLOW : ACCENT}
              />
            ))}
          </Animated.View>

          <View style={styles.stampWrap}>
            <Animated.View pointerEvents="none" style={[styles.stampAura, stampAuraStyle]} />
            <Animated.View style={[styles.stamp, stampStyle]}>
              <Animated.View style={checkStyle}>
                <Ionicons name="checkmark-circle" size={20} color={ACCENT_GLOW} />
              </Animated.View>
              <Text style={styles.stampText}>UNLOCKED</Text>
            </Animated.View>
          </View>

          <Animated.View style={copyStyle}>
            <Text style={styles.subtitle}>
              Today’s goals are done. Your restricted apps are open for the rest of
              the day.
            </Text>
            <Text style={styles.hint}>Tap anywhere to continue</Text>
          </Animated.View>
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
    backgroundColor: 'rgba(5,7,15,0.9)',
  },
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ACCENT_GLOW,
  },
  ring: {
    position: 'absolute',
    left: RING_L,
    top: RING_T,
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  card: {
    width: CARD_W,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#0E1524',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 16,
  },
  eyebrow: {
    fontFamily: fontFamily.display,
    fontSize: 12,
    letterSpacing: 2.4,
    color: ACCENT_GLOW,
  },
  lockStage: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  plateGlow: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  plateRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: ACCENT_SOFT,
  },
  lockLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  stampAura: {
    position: 'absolute',
    width: 210,
    height: 52,
    borderRadius: 14,
    backgroundColor: ACCENT,
  },
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: 'rgba(14,21,36,0.92)',
  },
  stampText: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    letterSpacing: 2.6,
    color: '#F2F5FC',
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
    marginTop: 10,
    textAlign: 'center',
  },
});
