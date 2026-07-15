import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
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
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily, status } from '@/lib/gaingang-theme';

const SCREEN = Dimensions.get('window');
const CARD_W = Math.min(SCREEN.width - 48, 320);
const RING_SIZE = 280;
const RING_L = SCREEN.width / 2 - RING_SIZE / 2;
const RING_T = SCREEN.height / 2 - RING_SIZE / 2;

const FIRE = status.fire;
const FIRE_GLOW = '#FFCF70';
const FIRE_HOT = '#FF6B1A';
const BORDER_DIM = 'rgba(245,165,36,0.28)';
const BORDER_GLOW = 'rgba(245,165,36,0.9)';

const T = {
  bgDelay: 0,
  bgDur: 380,
  cardDelay: 160,
  cardDur: 520,
  flamePulse: 420,
  countDelay: 720,
  countDur: 520,
  flashDelay: 700,
  flashInDur: 120,
  flashOutDur: 360,
  plusDelay: 780,
  ring1: 980,
  ring2: 1120,
  ring3: 1260,
  ringDur: 1000,
  emberStart: 200,
} as const;

const H = {
  card: T.cardDelay,
  flame: T.cardDelay + 120,
  flash: T.flashDelay,
  count: T.countDelay + 120,
  countSettle: T.countDelay + 280,
  ring1: T.ring1,
  ring2: T.ring2,
  ring3: T.ring3,
} as const;

const EMBERS = [
  { left: 0.18, delay: 0, size: 10, drift: -28 },
  { left: 0.32, delay: 90, size: 14, drift: -42 },
  { left: 0.48, delay: 40, size: 12, drift: -36 },
  { left: 0.62, delay: 130, size: 16, drift: -48 },
  { left: 0.76, delay: 70, size: 11, drift: -30 },
  { left: 0.4, delay: 180, size: 9, drift: -54 },
  { left: 0.68, delay: 210, size: 13, drift: -40 },
] as const;

function scheduleStreakHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};

  const timeouts: ReturnType<typeof setTimeout>[] = [];

  function at(ms: number, fn: () => void) {
    timeouts.push(setTimeout(fn, ms));
  }

  at(H.card, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });

  at(H.flame, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });

  at(H.flash, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });

  at(H.count, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });

  at(H.countSettle, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });

  for (const ms of [H.ring1, H.ring2, H.ring3]) {
    at(ms, () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  }

  return () => timeouts.forEach(clearTimeout);
}

function dismissWithHaptic(onDismiss?: () => void) {
  if (Platform.OS !== 'web') {
    void Haptics.selectionAsync();
  }
  onDismiss?.();
}

interface EmberProps {
  leftPct: number;
  delay: number;
  size: number;
  drift: number;
  playing: boolean;
}

function Ember({ leftPct, delay, size, drift, playing }: EmberProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!playing) {
      progress.value = 0;
      return;
    }

    progress.value = 0;
    progress.value = withDelay(
      T.emberStart + delay,
      withRepeat(
        withTiming(1, { duration: 1400 + delay, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [playing, delay, progress]);

  const style = useAnimatedStyle(() => {
    const y = interpolate(progress.value, [0, 1], [18, drift]);
    const opa = interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 0.95, 0.55, 0]);
    const sc = interpolate(progress.value, [0, 0.3, 1], [0.55, 1.05, 0.4]);
    return {
      opacity: opa,
      transform: [{ translateY: y }, { scale: sc }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ember,
        {
          left: `${leftPct * 100}%`,
          marginLeft: -size / 2,
        },
        style,
      ]}>
      <Ionicons name="flame" size={size} color={FIRE_GLOW} />
    </Animated.View>
  );
}

export interface StreakContinueOverlayProps {
  visible: boolean;
  /** Streak day count before today's first exercise */
  fromDays?: number;
  /** Streak day count after today's first exercise */
  toDays?: number;
  onDismiss?: () => void;
}

export function StreakContinueOverlay({
  visible,
  fromDays = 0,
  toDays = 1,
  onDismiss,
}: StreakContinueOverlayProps) {
  const [displayDays, setDisplayDays] = useState(fromDays);
  const isFirstStreak = fromDays <= 0;

  const bgOpa = useSharedValue(0);
  const cardY = useSharedValue(46);
  const cardOpa = useSharedValue(0);
  const borderGlow = useSharedValue(0);
  const flameSc = useSharedValue(0.75);
  const flameOpa = useSharedValue(0);
  const countSc = useSharedValue(0.85);
  const countOpa = useSharedValue(0);
  const plusOpa = useSharedValue(0);
  const plusY = useSharedValue(10);
  const plusSc = useSharedValue(0.6);
  const flashOpa = useSharedValue(0);
  const r1Sc = useSharedValue(0.3);
  const r1Opa = useSharedValue(0);
  const r2Sc = useSharedValue(0.3);
  const r2Opa = useSharedValue(0);
  const r3Sc = useSharedValue(0.3);
  const r3Opa = useSharedValue(0);

  const easeOut = Easing.out(Easing.cubic);

  function reset() {
    'worklet';
    bgOpa.value = 0;
    cardY.value = 46;
    cardOpa.value = 0;
    borderGlow.value = 0;
    flameSc.value = 0.75;
    flameOpa.value = 0;
    countSc.value = 0.85;
    countOpa.value = 0;
    plusOpa.value = 0;
    plusY.value = 10;
    plusSc.value = 0.6;
    flashOpa.value = 0;
    r1Sc.value = 0.3;
    r1Opa.value = 0;
    r2Sc.value = 0.3;
    r2Opa.value = 0;
    r3Sc.value = 0.3;
    r3Opa.value = 0;
  }

  function play() {
    bgOpa.value = withDelay(T.bgDelay, withTiming(0.92, { duration: T.bgDur, easing: easeOut }));

    cardOpa.value = withDelay(T.cardDelay, withTiming(1, { duration: T.cardDur, easing: easeOut }));
    cardY.value = withDelay(T.cardDelay, withTiming(0, { duration: T.cardDur, easing: easeOut }));

    flameOpa.value = withDelay(T.cardDelay + 80, withTiming(1, { duration: 360, easing: easeOut }));
    flameSc.value = withDelay(
      T.cardDelay + 80,
      withSequence(
        withSpring(1.12, { damping: 10, stiffness: 160, mass: 0.85 }),
        withTiming(1, { duration: 220, easing: easeOut }),
        withRepeat(
          withSequence(
            withTiming(1.1, { duration: T.flamePulse, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: T.flamePulse, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      ),
    );

    countOpa.value = withDelay(T.cardDelay + 140, withTiming(1, { duration: 340, easing: easeOut }));
    countSc.value = withDelay(
      T.cardDelay + 140,
      withSpring(1, { damping: 12, stiffness: 170, mass: 0.9 }),
    );

    flashOpa.value = withDelay(
      T.flashDelay,
      withSequence(
        withTiming(0.45, { duration: T.flashInDur }),
        withTiming(0, { duration: T.flashOutDur, easing: easeOut }),
      ),
    );

    countSc.value = withDelay(
      T.countDelay,
      withSequence(
        withTiming(0.72, { duration: 110, easing: easeOut }),
        withSpring(1.18, { damping: 9, stiffness: 190, mass: 0.8 }),
        withSpring(1, { damping: 12, stiffness: 160 }),
      ),
    );

    borderGlow.value = withDelay(T.countDelay, withTiming(1, { duration: 420, easing: easeOut }));

    plusOpa.value = withDelay(T.plusDelay, withTiming(1, { duration: 220, easing: easeOut }));
    plusY.value = withDelay(
      T.plusDelay,
      withTiming(-18, { duration: 680, easing: easeOut }),
    );
    plusSc.value = withDelay(
      T.plusDelay,
      withSequence(
        withSpring(1.15, { damping: 10, stiffness: 200 }),
        withTiming(1, { duration: 220 }),
      ),
    );

    (
      [
        [r1Sc, r1Opa, T.ring1],
        [r2Sc, r2Opa, T.ring2],
        [r3Sc, r3Opa, T.ring3],
      ] as const
    ).forEach(([sc, opa, delay]) => {
      sc.value = withDelay(delay, withTiming(2.7, { duration: T.ringDur, easing: easeOut }));
      opa.value = withDelay(
        delay,
        withSequence(
          withTiming(0.8, { duration: 50 }),
          withTiming(0, { duration: T.ringDur, easing: easeOut }),
        ),
      );
    });
  }

  useEffect(() => {
    if (!visible) return;

    setDisplayDays(fromDays);
    reset();
    const cancelHaptics = scheduleStreakHaptics();
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => play());
    });

    const bumpTimer = setTimeout(() => {
      setDisplayDays(toDays);
    }, T.countDelay + 120);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(bumpTimer);
      cancelHaptics();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fromDays, toDays]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: bgOpa.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpa.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    width: CARD_W,
    transform: [{ translateY: cardY.value }],
    opacity: cardOpa.value,
    borderColor: interpolateColor(borderGlow.value, [0, 1], [BORDER_DIM, BORDER_GLOW]),
  }));

  const flameStyle = useAnimatedStyle(() => ({
    opacity: flameOpa.value,
    transform: [{ scale: flameSc.value }],
  }));

  const countStyle = useAnimatedStyle(() => ({
    opacity: countOpa.value,
    transform: [{ scale: countSc.value }],
  }));

  const plusStyle = useAnimatedStyle(() => ({
    opacity: plusOpa.value,
    transform: [{ translateY: plusY.value }, { scale: plusSc.value }],
  }));

  const r1Style = useAnimatedStyle(() => ({
    transform: [{ scale: r1Sc.value }],
    opacity: r1Opa.value,
  }));
  const r2Style = useAnimatedStyle(() => ({
    transform: [{ scale: r2Sc.value }],
    opacity: r2Opa.value,
  }));
  const r3Style = useAnimatedStyle(() => ({
    transform: [{ scale: r3Sc.value }],
    opacity: r3Opa.value,
  }));

  const headline = isFirstStreak ? 'STREAK STARTED' : 'STREAK CONTINUES';
  const subtitle = isFirstStreak
    ? 'First workout of the day — keep it lit.'
    : 'First workout of the day locked in.';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent>
      <View style={styles.container}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          pointerEvents="none"
        />

        <Animated.View
          style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
          pointerEvents="none"
        />

        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissWithHaptic(onDismiss)} />

        <View style={[styles.ringBox, { left: RING_L, top: RING_T }]} pointerEvents="none">
          <Animated.View style={[StyleSheet.absoluteFill, styles.ring, r1Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.ring, r2Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.ring, r3Style]} />
        </View>

        <Pressable onPress={() => dismissWithHaptic(onDismiss)}>
          <Animated.View style={[styles.card, cardStyle]}>
            <View style={styles.emberField} pointerEvents="none">
              {EMBERS.map((ember, i) => (
                <Ember
                  key={i}
                  leftPct={ember.left}
                  delay={ember.delay}
                  size={ember.size}
                  drift={ember.drift}
                  playing={visible}
                />
              ))}
            </View>

            <Text style={styles.eyebrow}>{headline}</Text>

            <View style={styles.hero}>
              <Animated.View style={[styles.flameWrap, flameStyle]}>
                <Ionicons name="flame" size={64} color={FIRE} />
                <View style={styles.flameHot} pointerEvents="none">
                  <Ionicons name="flame" size={36} color={FIRE_HOT} />
                </View>
              </Animated.View>

              <Animated.View style={countStyle}>
                <Text style={styles.count} accessibilityLabel={`${displayDays} day streak`}>
                  {displayDays}
                </Text>
              </Animated.View>

              <Animated.View style={[styles.plusBadge, plusStyle]} pointerEvents="none">
                <Text style={styles.plusText}>+1</Text>
              </Animated.View>
            </View>

            <Text style={styles.daysLabel}>DAY STREAK</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { backgroundColor: '#120A04' },
  flash: { backgroundColor: FIRE_GLOW },

  ringBox: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  ring: {
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(245,165,36,0.85)',
    ...Platform.select({
      ios: {
        shadowColor: FIRE,
        shadowOpacity: 0.55,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },

  card: {
    borderRadius: 18,
    backgroundColor: '#1A1008',
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 28,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: FIRE,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
      },
      android: { elevation: 12 },
    }),
  },

  emberField: {
    ...StyleSheet.absoluteFill,
    top: 8,
    height: 120,
  },
  ember: {
    position: 'absolute',
    bottom: 8,
  },

  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 4,
    color: FIRE_GLOW,
    marginBottom: 18,
    textAlign: 'center',
  },

  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    marginBottom: 6,
  },
  flameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: FIRE,
        shadowOpacity: 0.9,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  flameHot: {
    position: 'absolute',
    bottom: 5,
    opacity: 0.85,
  },

  count: {
    fontFamily: fontFamily.display,
    fontSize: 84,
    lineHeight: 86,
    color: FIRE,
    textAlign: 'center',
  },

  plusBadge: {
    position: 'absolute',
    right: -8,
    top: 28,
    backgroundColor: FIRE_HOT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plusText: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 16,
    lineHeight: 18,
    color: '#1A1008',
  },

  daysLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 3,
    color: '#C9A066',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#B89A70',
    textAlign: 'center',
    maxWidth: 240,
  },
});
