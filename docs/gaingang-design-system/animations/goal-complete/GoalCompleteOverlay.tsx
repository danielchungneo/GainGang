/**
 * GoalCompleteOverlay — GainGang celebration modal
 *
 * Plays when every exercise in a daily goal is completed:
 *   1. Dark overlay fades in
 *   2. Quest card slides up
 *   3. Each exercise progress bar fills (staggered)
 *   4. "Goal Complete ✓" stamps in with a spring bounce
 *   5. Aura rings burst outward
 *   6. "+XP EARNED" pill drifts up
 *
 * Peer deps (should already be in a GainGang Expo project):
 *   npx expo install react-native-reanimated expo-linear-gradient
 */
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withDelay,
  withTiming,
  withSpring,
  withSequence,
  interpolateColor,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamily } from '../../theme/tokens';

type ExerciseUnit = 'reps' | 'seconds' | 'miles';

const SCREEN = Dimensions.get('window');
const CARD_W = Math.min(SCREEN.width - 48, 340);
const RING_SIZE = 300;
const RING_L = SCREEN.width / 2 - RING_SIZE / 2;
const RING_T = SCREEN.height / 2 - RING_SIZE / 2;

const T = {
  bgDelay: 0,
  bgDur: 420,
  cardDelay: 200,
  cardDur: 580,
  barDelay: 780,
  barDur: 650,
  barStagger: 160,
  glowDur: 540,
  ringDur: 1100,
  xpDur: 480,
};

export interface GoalCompleteExerciseTarget {
  name: string;
  unit: ExerciseUnit;
  from: number;
  target: number;
}

export interface GoalCompleteOverlayProps {
  visible: boolean;
  questTitle?: string;
  questKind?: string;
  description?: string;
  xpEarned?: number;
  /** All exercises in the daily goal — each gets an animated progress bar. */
  exercises?: GoalCompleteExerciseTarget[];
  /** @deprecated Prefer `exercises` for multi-exercise daily goals. */
  yourTarget?: { from: number; target: number };
  onDismiss?: () => void;
}

function formatBarValue(amount: number, unit: ExerciseUnit): string {
  if (unit === 'miles') {
    const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
    return `${formatted} mi`;
  }
  if (unit === 'seconds') {
    if (amount >= 60) {
      const m = Math.floor(amount / 60);
      const s = amount % 60;
      return s ? `${m}m ${s}s` : `${m}m`;
    }
    return `${amount} sec`;
  }
  return `${amount.toLocaleString()} reps`;
}

interface AnimatedExerciseBarProps {
  exercise: GoalCompleteExerciseTarget;
  delay: number;
  duration: number;
  onFinished?: () => void;
}

function AnimatedExerciseBar({ exercise, delay, duration, onFinished }: AnimatedExerciseBarProps) {
  const startPct = exercise.from / Math.max(exercise.target, 1);
  const barPct = useSharedValue(startPct);
  const currentAmount = useSharedValue(exercise.from);
  const trackWidth = useSharedValue(0);
  const [displayCurrent, setDisplayCurrent] = useState(exercise.from);
  const [complete, setComplete] = useState(exercise.from >= exercise.target);

  const easeInOut = Easing.inOut(Easing.cubic);

  const setDisplayCurrentFromWorklet = useCallback((value: number) => {
    setDisplayCurrent(value);
  }, []);

  useAnimatedReaction(
    () => currentAmount.value,
    (value) => {
      runOnJS(setDisplayCurrentFromWorklet)(value);
    },
    [setDisplayCurrentFromWorklet],
  );

  const handleFinished = useCallback(() => {
    setComplete(true);
    onFinished?.();
  }, [onFinished]);

  useEffect(() => {
    barPct.value = startPct;
    currentAmount.value = exercise.from;
    setDisplayCurrent(exercise.from);
    setComplete(exercise.from >= exercise.target);

    barPct.value = withDelay(
      delay,
      withTiming(1, { duration, easing: easeInOut }, (finished) => {
        if (finished) runOnJS(handleFinished)();
      }),
    );
    currentAmount.value = withDelay(
      delay,
      withTiming(exercise.target, { duration, easing: easeInOut }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.from, exercise.target, delay, duration]);

  const barStyle = useAnimatedStyle(() => {
    const w = trackWidth.value;
    if (w <= 0) return { width: 0 };
    return { width: Math.max(barPct.value > 0 ? 2 : 0, w * barPct.value) };
  });

  const barGradientStyle = useAnimatedStyle(() => ({
    width: trackWidth.value,
  }));

  const targetLabel = complete
    ? `${formatBarValue(exercise.target, exercise.unit)} ✓`
    : `${formatBarValue(displayCurrent, exercise.unit)} / ${formatBarValue(exercise.target, exercise.unit)}`;

  return (
    <View style={s.exerciseBlock}>
      <View style={s.barMeta}>
        <Text style={s.exerciseName} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={[s.barVal, { color: complete ? '#C77DFF' : '#8FB4FF' }]}>{targetLabel}</Text>
      </View>
      <View
        style={s.track}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) trackWidth.value = w;
        }}>
        <Animated.View style={[s.fillWrap, barStyle]}>
          <Animated.View style={[s.barGradient, barGradientStyle]}>
            <LinearGradient
              colors={['#9D4EDD', '#C77DFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

export function GoalCompleteOverlay({
  visible,
  questTitle = 'The Iron Oath',
  questKind = 'Daily Goal',
  description,
  xpEarned = 50,
  exercises: exercisesProp,
  yourTarget,
  onDismiss,
}: GoalCompleteOverlayProps) {
  const exercises: GoalCompleteExerciseTarget[] =
    exercisesProp ??
    (yourTarget
      ? [{ name: 'Your target', unit: 'reps', from: yourTarget.from, target: yourTarget.target }]
      : [{ name: 'Your target', unit: 'reps', from: 0, target: 20 }]);

  const bgOpa = useSharedValue(0);
  const cardY = useSharedValue(44);
  const cardOpa = useSharedValue(0);
  const glowPow = useSharedValue(0);
  const stampSc = useSharedValue(0.15);
  const stampOpa = useSharedValue(0);
  const r1Sc = useSharedValue(0.3);
  const r1Opa = useSharedValue(0);
  const r2Sc = useSharedValue(0.3);
  const r2Opa = useSharedValue(0);
  const r3Sc = useSharedValue(0.3);
  const r3Opa = useSharedValue(0);
  const xpY = useSharedValue(18);
  const xpOpa = useSharedValue(0);

  const [celebrationShown, setCelebrationShown] = useState(false);
  const hasPlayed = useRef(false);
  const finishedBars = useRef(0);

  const easeOut = Easing.out(Easing.cubic);

  const descText =
    description ??
    (exercises.length === 1
      ? `${formatBarValue(exercises[0].target, exercises[0].unit)} are yours.`
      : `All ${exercises.length} exercises complete.`);

  function playCelebration() {
    glowPow.value = withDelay(40, withTiming(1, { duration: T.glowDur, easing: easeOut }));

    stampOpa.value = withDelay(80, withTiming(1, { duration: 280, easing: easeOut }));
    stampSc.value = withDelay(80, withSpring(1, { damping: 13, stiffness: 195, mass: 0.85 }));

    (
      [
        [r1Sc, r1Opa, 160],
        [r2Sc, r2Opa, 310],
        [r3Sc, r3Opa, 460],
      ] as const
    ).forEach(([sc, opa, delay]) => {
      sc.value = withDelay(delay, withTiming(2.8, { duration: T.ringDur, easing: easeOut }));
      opa.value = withDelay(
        delay,
        withSequence(withTiming(0.72, { duration: 50 }), withTiming(0, { duration: T.ringDur, easing: easeOut })),
      );
    });

    xpOpa.value = withDelay(700, withTiming(1, { duration: T.xpDur, easing: easeOut }));
    xpY.value = withDelay(700, withTiming(0, { duration: T.xpDur, easing: easeOut }));
  }

  const playCelebrationRef = useRef(playCelebration);
  playCelebrationRef.current = playCelebration;

  const handleBarFinished = useCallback(() => {
    finishedBars.current += 1;
    if (finishedBars.current >= exercises.length) {
      setCelebrationShown(true);
      playCelebrationRef.current();
    }
  }, [exercises.length]);

  function reset() {
    bgOpa.value = 0;
    cardY.value = 44;
    cardOpa.value = 0;
    glowPow.value = 0;
    stampSc.value = 0.15;
    stampOpa.value = 0;
    r1Sc.value = 0.3;
    r1Opa.value = 0;
    r2Sc.value = 0.3;
    r2Opa.value = 0;
    r3Sc.value = 0.3;
    r3Opa.value = 0;
    xpY.value = 18;
    xpOpa.value = 0;
    finishedBars.current = 0;
    setCelebrationShown(false);
  }

  function playEntrance() {
    bgOpa.value = withDelay(T.bgDelay, withTiming(0.88, { duration: T.bgDur, easing: easeOut }));
    cardOpa.value = withDelay(T.cardDelay, withTiming(1, { duration: T.cardDur, easing: easeOut }));
    cardY.value = withDelay(T.cardDelay, withTiming(0, { duration: T.cardDur, easing: easeOut }));
  }

  useEffect(() => {
    if (!visible) {
      hasPlayed.current = false;
      setCelebrationShown(false);
      finishedBars.current = 0;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || hasPlayed.current) return;
    reset();
    hasPlayed.current = true;
    requestAnimationFrame(() => playEntrance());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, exercises]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: bgOpa.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpa.value,
    borderColor: interpolateColor(glowPow.value, [0, 1], ['rgba(77,140,255,0.32)', 'rgba(77,140,255,0.88)']),
  }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampOpa.value,
    transform: [{ scale: stampSc.value }],
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

  const xpStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: xpY.value }],
    opacity: xpOpa.value,
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={s.container}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View style={s.ringBox} pointerEvents="none">
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r1Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r2Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r3Style]} />
        </View>

        <Animated.View style={[s.card, cardStyle]}>
          <LinearGradient
            colors={['rgba(77,140,255,0.16)', 'rgba(157,78,221,0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.header}>
            <Text style={s.questKind}>⚔ {questKind.toUpperCase()}</Text>
            <View style={s.statusRow}>
              <View style={[s.dot, celebrationShown && s.dotComplete]} />
              <Text style={[s.statusText, celebrationShown && s.statusComplete]}>
                {celebrationShown ? 'COMPLETE' : 'ACTIVE'}
              </Text>
            </View>
          </LinearGradient>

          <ScrollView style={s.bodyScroll} contentContainerStyle={s.body} bounces={false}>
            <Text style={s.title}>{questTitle}</Text>
            <Text style={s.desc}>{descText}</Text>

            {exercises.map((exercise, index) => (
              <AnimatedExerciseBar
                key={`${exercise.name}-${index}`}
                exercise={exercise}
                delay={T.barDelay + index * T.barStagger}
                duration={T.barDur}
                onFinished={handleBarFinished}
              />
            ))}
          </ScrollView>

          <Animated.View style={[StyleSheet.absoluteFill, s.stamp, stampStyle]} pointerEvents="none">
            <LinearGradient
              colors={['#4D8CFF', '#9D4EDD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.checkCircle}>
              <Text style={s.checkMark}>✓</Text>
            </LinearGradient>
            <Text style={s.completeTitle}>Goal Complete</Text>
            <Text style={s.completeSub}>{questTitle.toUpperCase()} — FULFILLED</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[s.xpPill, xpStyle]} pointerEvents="none">
          <Text style={s.xpText}>+{xpEarned} XP</Text>
          <Text style={s.xpLabel}>EARNED</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    backgroundColor: '#05070F',
  },
  ringBox: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    left: RING_L,
    top: RING_T,
    borderRadius: RING_SIZE / 2,
    zIndex: 1,
  },
  ring: {
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(77,140,255,0.72)',
    ...Platform.select({
      ios: {
        shadowColor: '#4D8CFF',
        shadowOpacity: 0.55,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  card: {
    width: CARD_W,
    maxHeight: SCREEN.height * 0.72,
    borderRadius: 18,
    backgroundColor: '#0E1524',
    borderWidth: 1,
    borderColor: 'rgba(77,140,255,0.32)',
    overflow: 'hidden',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#4D8CFF',
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
      },
      android: { elevation: 12 },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(77,140,255,0.18)',
  },
  questKind: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: '#8FB4FF',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8FB4FF' },
  dotComplete: { backgroundColor: '#2DD4BF' },
  statusText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#8FB4FF',
    letterSpacing: 1,
  },
  statusComplete: {
    color: '#2DD4BF',
  },
  bodyScroll: {
    maxHeight: SCREEN.height * 0.5,
  },
  body: {
    padding: 18,
    paddingBottom: 20,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: '#E8EDF7',
    marginBottom: 6,
    lineHeight: 30,
  },
  desc: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: '#7D8AA8',
    marginBottom: 16,
    lineHeight: 20,
  },
  exerciseBlock: {
    marginBottom: 14,
  },
  barMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
    gap: 8,
  },
  exerciseName: {
    flex: 1,
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    color: '#E8EDF7',
  },
  barVal: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
  },
  track: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#0C1322',
    overflow: 'hidden',
  },
  fillWrap: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barGradient: {
    height: '100%',
  },
  stamp: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,7,15,0.84)',
    borderRadius: 18,
  },
  checkCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  checkMark: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
  },
  completeTitle: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: '#E8EDF7',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  completeSub: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: '#7D8AA8',
    letterSpacing: 2,
  },
  xpPill: {
    position: 'absolute',
    bottom: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(77,140,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(77,140,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 11,
    zIndex: 3,
  },
  xpText: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: '#8FB4FF',
    letterSpacing: 0.5,
  },
  xpLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: '#7D8AA8',
    letterSpacing: 1.5,
  },
});
