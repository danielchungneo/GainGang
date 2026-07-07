import * as Haptics from 'expo-haptics';
import React, { useEffect, useId, type ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withSequence,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Polygon, Rect, Stop } from 'react-native-svg';

import { LevelBadge } from '@/components/ui';
import { fontFamily, levelBadgeForLevel } from '@/lib/gaingang-theme';

const SCREEN = Dimensions.get('window');
const STAMP_BADGE_SIZE = 124;
const CARD_W_BASE = Math.min(SCREEN.width - 48, 340);
const STAMP_FRAME_W = STAMP_BADGE_SIZE + 40;
const STAMP_FRAME_H = Math.ceil(STAMP_BADGE_SIZE * 1.09) + 40;
const CARD_W_STAMP = Math.min(
  SCREEN.width - 24,
  Math.max(CARD_W_BASE + 72, STAMP_FRAME_W + 100),
);
const CARD_H_STAMP = STAMP_FRAME_H + 100;
const RING_SIZE = 300;
const RING_L = SCREEN.width / 2 - RING_SIZE / 2;
const RING_T = SCREEN.height / 2 - RING_SIZE / 2;

const ACCENT = '#4D8CFF';
const ACCENT_GLOW = '#8FB4FF';
const BORDER_DIM = 'rgba(77,140,255,0.28)';
const BORDER_GLOW = 'rgba(77,140,255,0.85)';

function hexPoints(w: number, h: number, inset = 0): string {
  const x = inset;
  const y = inset;
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  return `${x + iw * 0.5},${y} ${x + iw},${y + ih * 0.25} ${x + iw},${y + ih * 0.75} ${x + iw * 0.5},${y + ih} ${x},${y + ih * 0.75} ${x},${y + ih * 0.25}`;
}

function StampLevelFrame({ level }: { level: number }) {
  const badge = levelBadgeForLevel(level);
  const badgeH = STAMP_BADGE_SIZE * 1.09;
  const pad = 20;
  const frameW = STAMP_BADGE_SIZE + pad * 2;
  const frameH = badgeH + pad * 2;
  const ringId = useId().replace(/:/g, '');

  return (
    <View style={[s.levelFrame, { width: frameW, height: frameH }]}>
      <Svg width={frameW} height={frameH} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={badge.color} stopOpacity={0.95} />
            <Stop offset="1" stopColor={badge.glow} stopOpacity={0.45} />
          </SvgGradient>
        </Defs>
        <Polygon
          points={hexPoints(frameW, frameH, 1)}
          fill="none"
          stroke={`url(#${ringId})`}
          strokeWidth={2.5}
        />
        <Polygon
          points={hexPoints(frameW, frameH, 8)}
          fill="none"
          stroke={badge.glow}
          strokeOpacity={0.22}
          strokeWidth={1}
        />
      </Svg>
      <View
        style={[
          s.levelFrameInner,
          Platform.OS === 'ios' && {
            shadowColor: badge.color,
            shadowOpacity: 0.85,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}>
        <LevelBadge level={level} size={STAMP_BADGE_SIZE} />
      </View>
    </View>
  );
}

const T = {
  bgDelay: 0,
  bgDur: 420,
  cardDelay: 200,
  cardDur: 580,
  barDelay: 800,
  barDur: 620,
  flashDelay: 1400,
  flashInDur: 140,
  flashOutDur: 420,
  stampDelay: 1460,
  ring1: 2040,
  ring2: 2190,
  ring3: 2340,
  ringDur: 1100,
};

const H = {
  card: T.cardDelay,
  flash: T.flashDelay,
  stamp: T.stampDelay + 160,
  ring1: T.ring1,
  ring2: T.ring2,
  ring3: T.ring3,
} as const;

function scheduleLevelUpHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};

  const timeouts: ReturnType<typeof setTimeout>[] = [];

  function at(ms: number, fn: () => void) {
    timeouts.push(setTimeout(fn, ms));
  }

  at(H.card, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });

  at(H.flash, () => {
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

interface SvgGradientFillProps {
  colors: readonly [string, string];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

function SvgGradientFill({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  style,
  children,
}: SvgGradientFillProps) {
  const gradId = useId().replace(/:/g, '');

  return (
    <View style={style}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgGradient
            id={gradId}
            x1={`${start.x * 100}%`}
            y1={`${start.y * 100}%`}
            x2={`${end.x * 100}%`}
            y2={`${end.y * 100}%`}>
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </SvgGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradId})`} />
      </Svg>
      {children}
    </View>
  );
}

export interface LevelUpOverlayProps {
  visible: boolean;
  /** Level before the gain */
  fromLevel?: number;
  /** New level reached */
  toLevel?: number;
  /** Called when the user taps the backdrop */
  onDismiss?: () => void;
}

export function LevelUpOverlay({
  visible,
  fromLevel = 12,
  toLevel = 13,
  onDismiss,
}: LevelUpOverlayProps) {
  const bgOpa = useSharedValue(0);
  const cardY = useSharedValue(50);
  const cardOpa = useSharedValue(0);
  const cardW = useSharedValue(CARD_W_BASE);
  const cardH = useSharedValue(0);
  const cardHBase = useSharedValue(0);
  const barPct = useSharedValue(0.35);
  const trackWidth = useSharedValue(0);
  const flashOpa = useSharedValue(0);
  const stampSc = useSharedValue(0.1);
  const stampOpa = useSharedValue(0);
  const bodyOpa = useSharedValue(1);
  const r1Sc = useSharedValue(0.3);
  const r1Opa = useSharedValue(0);
  const r2Sc = useSharedValue(0.3);
  const r2Opa = useSharedValue(0);
  const r3Sc = useSharedValue(0.3);
  const r3Opa = useSharedValue(0);

  const easeOut = Easing.out(Easing.cubic);
  const easeInOut = Easing.inOut(Easing.cubic);

  function reset() {
    'worklet';
    bgOpa.value = 0;
    cardY.value = 50;
    cardOpa.value = 0;
    cardW.value = CARD_W_BASE;
    cardH.value = 0;
    cardHBase.value = 0;
    barPct.value = 0.35;
    flashOpa.value = 0;
    stampSc.value = 0.1;
    stampOpa.value = 0;
    bodyOpa.value = 1;
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

    barPct.value = withDelay(T.barDelay, withTiming(1, { duration: T.barDur, easing: easeInOut }));

    flashOpa.value = withDelay(
      T.flashDelay,
      withSequence(
        withTiming(0.5, { duration: T.flashInDur }),
        withTiming(0, { duration: T.flashOutDur, easing: easeOut }),
      ),
    );

    stampOpa.value = withDelay(T.stampDelay, withTiming(1, { duration: 260, easing: easeOut }));
    stampSc.value = withDelay(T.stampDelay, withSpring(1, { damping: 11, stiffness: 180, mass: 0.9 }));
    bodyOpa.value = withDelay(T.stampDelay, withTiming(0, { duration: 220, easing: easeOut }));
    const expandSpring = { damping: 14, stiffness: 150, mass: 0.9 };
    const stampHeight = Math.max(CARD_H_STAMP, cardHBase.value);
    cardW.value = withDelay(T.stampDelay, withSpring(CARD_W_STAMP, expandSpring));
    cardH.value = withDelay(T.stampDelay, withSpring(stampHeight, expandSpring));

    (
      [
        [r1Sc, r1Opa, T.ring1],
        [r2Sc, r2Opa, T.ring2],
        [r3Sc, r3Opa, T.ring3],
      ] as const
    ).forEach(([sc, opa, delay]) => {
      sc.value = withDelay(delay, withTiming(2.9, { duration: T.ringDur, easing: easeOut }));
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
    if (!visible) return;

    reset();
    const cancelHaptics = scheduleLevelUpHaptics();
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => play());
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelHaptics();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: bgOpa.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpa.value,
  }));

  const cardStyle = useAnimatedStyle(() => {
    const style: {
      width: number;
      height?: number;
      transform: { translateY: number }[];
      opacity: number;
      borderColor: string;
    } = {
      width: cardW.value,
      transform: [{ translateY: cardY.value }],
      opacity: cardOpa.value,
      borderColor: interpolateColor(barPct.value, [0, 1], [BORDER_DIM, BORDER_GLOW]),
    };
    if (cardH.value > 0) style.height = cardH.value;
    return style;
  });

  const barStyle = useAnimatedStyle(() => {
    const w = trackWidth.value;
    if (w <= 0) return { width: 0 };
    return { width: Math.max(barPct.value > 0 ? 2 : 0, w * barPct.value) };
  });

  const barGradientStyle = useAnimatedStyle(() => ({
    width: trackWidth.value,
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpa.value,
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

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent>
      <View style={s.container}>
        <Animated.View
          style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}
          pointerEvents="none"
        />

        <Animated.View
          style={[StyleSheet.absoluteFill, s.flash, flashStyle]}
          pointerEvents="none"
        />

        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View style={[s.ringBox, { left: RING_L, top: RING_T }]} pointerEvents="none">
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r1Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r2Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r3Style]} />
        </View>

        <Pressable onPress={onDismiss}>
          <Animated.View
            style={[s.card, cardStyle]}
            onLayout={(e: LayoutChangeEvent) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0 && cardHBase.value === 0) {
                cardHBase.value = h;
                cardH.value = h;
              }
            }}>
          <Animated.View style={[s.body, bodyStyle]}>
            <View style={s.levelBlock}>
              <Text style={s.levelCap}>LEVEL</Text>
              <Text style={s.levelNum}>{fromLevel}</Text>
            </View>

            <View style={s.barSection}>
              <View style={s.barMeta}>
                <Text style={s.barLabel}>LV {fromLevel} · CLEARED</Text>
                <Text style={s.barVal}>LV {toLevel} · UNLOCKED</Text>
              </View>
              <View
                style={s.track}
                onLayout={(e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) trackWidth.value = w;
                }}>
                <Animated.View style={[s.fillWrap, barStyle]}>
                  <Animated.View style={[s.barGradient, barGradientStyle]}>
                    <SvgGradientFill colors={[ACCENT, ACCENT_GLOW]} style={StyleSheet.absoluteFill} />
                  </Animated.View>
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, s.stamp, stampStyle]} pointerEvents="none">
            <View style={s.stampContent}>
              <Text style={s.stampEyebrow}>LEVEL UP</Text>
              <StampLevelFrame level={toLevel} />
            </View>
          </Animated.View>
          </Animated.View>
        </Pressable>
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
  backdrop: { backgroundColor: '#05070F' },
  flash: { backgroundColor: '#FFFFFF' },

  ringBox: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  ring: {
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(77,140,255,0.8)',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOpacity: 0.55,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },

  card: {
    borderRadius: 18,
    backgroundColor: '#0E1524',
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
      },
      android: { elevation: 12 },
    }),
  },

  body: { padding: 18, paddingTop: 24, paddingBottom: 24 },

  levelBlock: { alignItems: 'center', marginBottom: 22 },
  levelCap: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 2.5,
    color: '#7D8AA8',
    marginBottom: 6,
  },
  levelNum: {
    fontFamily: fontFamily.display,
    fontSize: 72,
    lineHeight: 72,
    color: '#AEB8D0',
  },

  barSection: { marginBottom: 0 },
  barMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  barLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: '#7D8AA8',
    letterSpacing: 1,
  },
  barVal: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: ACCENT_GLOW,
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
    backgroundColor: '#0E1524',
    borderRadius: 18,
  },
  stampContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },

  stampEyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 5,
    color: '#AEB8D0',
    textAlign: 'center',
    width: '100%',
  },
  levelFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelFrameInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
