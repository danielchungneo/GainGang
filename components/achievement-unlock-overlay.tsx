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
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AchievementBadge } from '@/components/ui/achievement-badge';
import { useCelebrationGate } from '@/hooks/use-celebration-gate';
import {
  achievementTierDef,
  isAchievementTier,
  resolveAchievementTier,
} from '@/lib/achievements';
import { fontFamily } from '@/lib/gaingang-theme';
import type { Achievement } from '@/types';

const SCREEN = Dimensions.get('window');
const CARD_W = Math.min(SCREEN.width - 48, 320);
const RING_SIZE = 280;
const RING_L = SCREEN.width / 2 - RING_SIZE / 2;
const RING_T = SCREEN.height / 2 - RING_SIZE / 2;

const T = {
  bgDelay: 0,
  bgDur: 380,
  cardDelay: 140,
  cardDur: 520,
  badgeDelay: 220,
  badgeSpinDur: 1100,
  badgeIdleSpinDur: 3600,
  flashDelay: 640,
  ring1: 900,
  ring2: 1040,
  ring3: 1180,
  ringDur: 1000,
} as const;

function scheduleUnlockHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  function at(ms: number, fn: () => void) {
    timeouts.push(setTimeout(fn, ms));
  }

  at(T.cardDelay, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });
  at(T.badgeDelay + 80, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });
  at(T.flashDelay, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
  at(T.flashDelay + 140, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });

  return () => timeouts.forEach(clearTimeout);
}

function dismissWithHaptic(onDismiss?: () => void) {
  if (Platform.OS !== 'web') {
    void Haptics.selectionAsync();
  }
  onDismiss?.();
}

export interface AchievementUnlockOverlayProps {
  visible: boolean;
  achievement: Achievement | null;
  onDismiss?: () => void;
}

export function AchievementUnlockOverlay({
  visible,
  achievement,
  onDismiss,
}: AchievementUnlockOverlayProps) {
  useCelebrationGate(visible && !!achievement);

  const tier = achievement
    ? resolveAchievementTier({
        key: achievement.key,
        tier: achievement.tier,
        threshold: achievement.threshold,
      })
    : 'bronze';
  const tierDef = achievementTierDef(isAchievementTier(tier) ? tier : 'bronze');
  const glow = tierDef.glow;
  const borderDim = `${glow}44`;
  const borderBright = `${glow}E6`;

  const bgOpa = useSharedValue(0);
  const cardY = useSharedValue(46);
  const cardOpa = useSharedValue(0);
  const borderGlow = useSharedValue(0);
  const badgeSc = useSharedValue(0.7);
  const badgeOpa = useSharedValue(0);
  const badgeRotY = useSharedValue(0);
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
    badgeSc.value = 0.7;
    badgeOpa.value = 0;
    badgeRotY.value = -180;
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

    borderGlow.value = withDelay(
      T.badgeDelay,
      withSequence(
        withTiming(1, { duration: 280, easing: easeOut }),
        withTiming(0.55, { duration: 420, easing: easeOut }),
      ),
    );

    badgeOpa.value = withDelay(T.badgeDelay, withTiming(1, { duration: 360, easing: easeOut }));
    badgeSc.value = withDelay(
      T.badgeDelay,
      withSequence(
        withSpring(1.12, { damping: 10, stiffness: 160, mass: 0.85 }),
        withTiming(1, { duration: 220, easing: easeOut }),
      ),
    );
    // Y-axis spin: coin/medal turning in place (face → edge → face).
    badgeRotY.value = withDelay(
      T.badgeDelay,
      withSequence(
        withTiming(360, {
          duration: T.badgeSpinDur,
          easing: Easing.out(Easing.cubic),
        }),
        withRepeat(
          withTiming(720, {
            duration: T.badgeIdleSpinDur,
            easing: Easing.linear,
          }),
          -1,
          false,
        ),
      ),
    );

    flashOpa.value = withDelay(
      T.flashDelay,
      withSequence(
        withTiming(0.55, { duration: 100 }),
        withTiming(0, { duration: 320 }),
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
          withTiming(0.75, { duration: 50 }),
          withTiming(0, { duration: T.ringDur, easing: easeOut }),
        ),
      );
    });
  }

  useEffect(() => {
    if (!visible || !achievement) return;

    reset();
    const cancelHaptics = scheduleUnlockHaptics();
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => play());
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelHaptics();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, achievement?.id]);

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
    borderColor: interpolateColor(borderGlow.value, [0, 1], [borderDim, borderBright]),
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpa.value,
    transform: [
      { perspective: 900 },
      { rotateY: `${badgeRotY.value}deg` },
      { scale: badgeSc.value },
    ],
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

  if (!achievement) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          pointerEvents="none"
        />
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: glow }, flashStyle]}
          pointerEvents="none"
        />

        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissWithHaptic(onDismiss)} />

        <View style={[styles.ringBox, { left: RING_L, top: RING_T }]} pointerEvents="none">
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.ring,
              { borderColor: `${glow}D9` },
              r1Style,
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.ring,
              { borderColor: `${glow}D9` },
              r2Style,
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.ring,
              { borderColor: `${glow}D9` },
              r3Style,
            ]}
          />
        </View>

        <Pressable onPress={() => dismissWithHaptic(onDismiss)}>
          <Animated.View style={[styles.card, cardStyle]}>
            <Text style={[styles.eyebrow, { color: glow }]}>ACHIEVEMENT UNLOCKED</Text>

            <Animated.View style={[styles.badgeWrap, badgeStyle]}>
              <AchievementBadge
                icon={achievement.icon}
                tier={tier}
                earned
                size={96}
              />
            </Animated.View>

            <Text style={styles.title}>{achievement.title}</Text>
            <Text style={styles.description}>{achievement.description}</Text>
            <Text style={[styles.tierLabel, { color: glow }]}>{tierDef.name}</Text>
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
  backdrop: { backgroundColor: '#05070F' },
  ringBox: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  ring: {
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.5,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#0E1424',
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 28,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
      },
      android: { elevation: 12 },
    }),
  },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 3.2,
    marginBottom: 18,
    textAlign: 'center',
  },
  badgeWrap: {
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    lineHeight: 30,
    color: '#F4F7FF',
    textAlign: 'center',
  },
  description: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#9AA6C2',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
  },
  tierLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 14,
  },
});
