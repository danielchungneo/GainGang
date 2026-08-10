import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GangBannerWithDivisionBorder } from '@/components/gang-banner-with-division-border';
import { WAR_DIVISION_LABELS, isWarDivision } from '@/lib/gang-wars/divisions';
import { fontFamily } from '@/lib/gaingang-theme';

const SCREEN = Dimensions.get('window');
const BANNER = 118;
const CLASH_AT = 520;
const SETTLE_AT = 720;

const PARTICLES = [
  { side: 'left' as const, x: 0.12, delay: 0, size: 7, rise: 90, dur: 2200 },
  { side: 'left' as const, x: 0.22, delay: 180, size: 5, rise: 120, dur: 2600 },
  { side: 'left' as const, x: 0.3, delay: 90, size: 9, rise: 100, dur: 2400 },
  { side: 'left' as const, x: 0.18, delay: 320, size: 6, rise: 140, dur: 2800 },
  { side: 'left' as const, x: 0.26, delay: 480, size: 4, rise: 110, dur: 2100 },
  { side: 'right' as const, x: 0.7, delay: 60, size: 7, rise: 95, dur: 2300 },
  { side: 'right' as const, x: 0.78, delay: 210, size: 5, rise: 125, dur: 2700 },
  { side: 'right' as const, x: 0.86, delay: 120, size: 8, rise: 105, dur: 2500 },
  { side: 'right' as const, x: 0.74, delay: 360, size: 6, rise: 135, dur: 2900 },
  { side: 'right' as const, x: 0.82, delay: 440, size: 4, rise: 115, dur: 2200 },
];

interface GangWarMatchupOverlayProps {
  ourName: string;
  ourBannerUrl?: string | null;
  ourDivision?: string | null;
  theirName: string;
  theirBannerUrl?: string | null;
  theirDivision?: string | null;
  onDismiss: () => void;
}

function divisionLabel(value?: string | null): string {
  return isWarDivision(value) ? WAR_DIVISION_LABELS[value] : 'Iron';
}

function scheduleClashHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 180),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, CLASH_AT),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, CLASH_AT + 80),
  );
  return () => timeouts.forEach(clearTimeout);
}

function RisingParticle({
  x,
  delay,
  size,
  rise,
  dur,
  color,
}: {
  x: number;
  delay: number;
  size: number;
  rise: number;
  dur: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      SETTLE_AT + delay,
      withRepeat(
        withTiming(1, { duration: dur, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [delay, dur, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.12, 0.65, 1], [0, 0.95, 0.4, 0]),
      transform: [
        { translateY: interpolate(p, [0, 1], [0, -rise]) },
        { translateX: interpolate(p, [0, 0.5, 1], [0, size * 0.45, -size * 0.25]) },
        { scale: interpolate(p, [0, 0.25, 1], [0.55, 1.2, 0.35]) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: SCREEN.width * x,
          bottom: SCREEN.height * 0.28,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/** Cinematic VS reveal: banners clash, then idle with particles. */
export function GangWarMatchupOverlay({
  ourName,
  ourBannerUrl,
  ourDivision,
  theirName,
  theirBannerUrl,
  theirDivision,
  onDismiss,
}: GangWarMatchupOverlayProps) {
  const leftX = useSharedValue(-SCREEN.width * 0.55);
  const rightX = useSharedValue(SCREEN.width * 0.55);
  const leftRot = useSharedValue(-14);
  const rightRot = useSharedValue(14);
  const vsScale = useSharedValue(0);
  const vsGlow = useSharedValue(0);
  const flash = useSharedValue(0);
  const bg = useSharedValue(0);
  const hint = useSharedValue(0);
  const idle = useSharedValue(0);

  useEffect(() => {
    const clearHaptics = scheduleClashHaptics();

    bg.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });

    leftX.value = withSequence(
      withTiming(18, { duration: CLASH_AT, easing: Easing.in(Easing.cubic) }),
      withSpring(-8, { damping: 12, stiffness: 180 }),
    );
    rightX.value = withSequence(
      withTiming(-18, { duration: CLASH_AT, easing: Easing.in(Easing.cubic) }),
      withSpring(8, { damping: 12, stiffness: 180 }),
    );
    leftRot.value = withSequence(
      withTiming(6, { duration: CLASH_AT, easing: Easing.in(Easing.quad) }),
      withSpring(-2, { damping: 14, stiffness: 160 }),
    );
    rightRot.value = withSequence(
      withTiming(-6, { duration: CLASH_AT, easing: Easing.in(Easing.quad) }),
      withSpring(2, { damping: 14, stiffness: 160 }),
    );

    vsScale.value = withDelay(
      CLASH_AT - 40,
      withSequence(
        withSpring(1.28, { damping: 8, stiffness: 220 }),
        withSpring(1, { damping: 12, stiffness: 180 }),
      ),
    );
    vsGlow.value = withDelay(
      CLASH_AT,
      withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0.55, { duration: 420 }),
      ),
    );
    flash.value = withDelay(
      CLASH_AT,
      withSequence(
        withTiming(0.75, { duration: 70 }),
        withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) }),
      ),
    );

    hint.value = withDelay(SETTLE_AT + 280, withTiming(1, { duration: 420 }));

    idle.value = withDelay(
      SETTLE_AT + 120,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    return clearHaptics;
  }, [
    bg,
    flash,
    hint,
    idle,
    leftRot,
    leftX,
    rightRot,
    rightX,
    vsGlow,
    vsScale,
  ]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bg.value,
  }));

  const leftStyle = useAnimatedStyle(() => {
    const bob = interpolate(idle.value, [0, 1], [0, -7]);
    return {
      transform: [
        { translateX: leftX.value },
        { translateY: bob },
        { rotate: `${leftRot.value}deg` },
      ],
    };
  });

  const rightStyle = useAnimatedStyle(() => {
    const bob = interpolate(idle.value, [0, 1], [0, -7]);
    return {
      transform: [
        { translateX: rightX.value },
        { translateY: bob },
        { rotate: `${rightRot.value}deg` },
      ],
    };
  });

  const vsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(vsScale.value, [0, 0.4, 1], [0, 1, 1]),
    transform: [
      { scale: vsScale.value },
      { rotate: `${interpolate(idle.value, [0, 1], [-1.5, 1.5])}deg` },
    ],
  }));

  const vsAuraStyle = useAnimatedStyle(() => ({
    opacity: interpolate(vsGlow.value, [0, 1], [0, 1]) *
      interpolate(idle.value, [0, 1], [0.72, 1]),
    transform: [{ scale: interpolate(idle.value, [0, 1], [0.94, 1.06]) }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: hint.value,
    transform: [
      {
        scale: interpolate(hint.value, [0, 1], [0.86, 1]) *
          interpolate(idle.value, [0, 1], [1, 1.04]),
      },
      { translateY: interpolate(idle.value, [0, 1], [6, 0]) },
    ],
  }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]} pointerEvents="none">
          <LinearGradient
            colors={['#140208', '#070b16', '#04060f']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(220,38,38,0.38)', 'transparent', 'rgba(37,99,235,0.38)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {PARTICLES.map((p, i) => (
          <RisingParticle
            key={`${p.side}-${i}`}
            x={p.x}
            delay={p.delay}
            size={p.size}
            rise={p.rise}
            dur={p.dur}
            color={p.side === 'left' ? 'rgba(248,113,113,0.9)' : 'rgba(96,165,250,0.9)'}
          />
        ))}

        <View style={styles.row} pointerEvents="none">
          <Animated.View style={[styles.side, leftStyle]}>
            <GangBannerWithDivisionBorder
              uri={ourBannerUrl}
              name={ourName}
              division={ourDivision}
              size={BANNER}
            />
            <Text style={styles.name} numberOfLines={2}>
              {ourName}
            </Text>
            <Text style={[styles.meta, { color: 'rgba(252,165,165,0.9)' }]}>
              {divisionLabel(ourDivision)}
            </Text>
          </Animated.View>

          <View style={styles.vsWrap}>
            <Animated.View style={[styles.vsAura, vsAuraStyle]} />
            <Animated.Text style={[styles.vs, vsStyle]}>VS</Animated.Text>
          </View>

          <Animated.View style={[styles.side, rightStyle]}>
            <GangBannerWithDivisionBorder
              uri={theirBannerUrl}
              name={theirName}
              division={theirDivision}
              size={BANNER}
            />
            <Text style={styles.name} numberOfLines={2}>
              {theirName}
            </Text>
            <Text style={[styles.meta, { color: 'rgba(147,197,253,0.95)' }]}>
              {divisionLabel(theirDivision)}
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.ctaWrap, ctaStyle]}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }
              onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel="Go to war"
            style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <LinearGradient
              colors={['#F43F5E', '#A855F7', '#2563EB']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}
            >
              <Text style={styles.ctaLabel}>Go To War!</Text>
              <Text style={styles.ctaSub}>Crush {theirName}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  particle: {
    position: 'absolute',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  vsWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  vsAura: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: 'rgba(168, 85, 247, 0.45)',
    borderWidth: 2,
    borderColor: 'rgba(192, 132, 252, 0.7)',
  },
  name: {
    fontFamily: fontFamily.bodySemi,
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
  meta: {
    fontSize: 12,
    fontFamily: fontFamily.bodySemi,
    letterSpacing: 0.4,
  },
  vs: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    color: '#F3E8FF',
  },
  ctaWrap: {
    marginTop: 36,
    alignItems: 'center',
    zIndex: 4,
  },
  cta: {
    minWidth: Math.min(SCREEN.width - 48, 320),
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaLabel: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  ctaSub: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
  },
  flash: {
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
});
