/**
 * LevelUpOverlay — GainGang level-up celebration modal
 *
 * Plays a ~3.5-second animation when a player levels up:
 *   1. Dark overlay fades in
 *   2. Level card slides up — shows current level + XP bar
 *   3. XP bar sweeps to 100% (overflow!)
 *   4. White flash bursts across the screen
 *   5. "LEVEL UP" stamp springs in with bounce (covers full card)
 *   6. Aura rings burst outward (staggered ×3)
 *
 * Haptics (expo-haptics) fire on card entrance, flash, stamp settle, and each ring.
 *
 * Peer deps (should already be in a GainGang Expo project):
 *   npx expo install react-native-reanimated expo-linear-gradient
 *
 * Usage:
 *   <LevelUpOverlay
 *     visible={justLeveledUp}
 *     fromLevel={12}
 *     toLevel={13}
 *     onDismiss={() => setJustLeveledUp(false)}
 *   />
 */
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
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { fontFamily } from '../theme/tokens';

// ─── Layout constants ─────────────────────────────────────────────────────────

const SCREEN    = Dimensions.get('window');
const CARD_W    = Math.min(SCREEN.width - 48, 340);
const RING_SIZE = 300;
const RING_L    = SCREEN.width  / 2 - RING_SIZE / 2;
const RING_T    = SCREEN.height / 2 - RING_SIZE / 2;

// ─── Fixed aura palette ───────────────────────────────────────────────────────

const ACCENT       = '#4D8CFF';
const ACCENT_GLOW  = '#8FB4FF';
const BADGE_GRAD: [string, string] = ['#13315F', '#0D1A32'];
const BORDER_DIM   = 'rgba(77,140,255,0.28)';
const BORDER_GLOW  = 'rgba(77,140,255,0.85)';

// ─── Timing (ms) ──────────────────────────────────────────────────────────────

const T = {
  bgDelay:      0,    bgDur:       420,
  cardDelay:    200,  cardDur:     580,
  barDelay:     800,  barDur:      620,
  flashDelay:   1400, flashInDur:  140, flashOutDur: 420,
  stampDelay:   1460,
  ring1:        2040,
  ring2:        2190,
  ring3:        2340,
  ringDur:      1100,
};

// Haptic beats aligned to the visual timeline (ms from play start)
const H = {
  card:  T.cardDelay,
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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LevelUpOverlayProps {
  visible: boolean;
  /** Level before the gain */
  fromLevel?: number;
  /** New level reached */
  toLevel?: number;
  /** Called when the user taps the backdrop */
  onDismiss?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LevelUpOverlay({
  visible,
  fromLevel = 12,
  toLevel   = 13,
  onDismiss,
}: LevelUpOverlayProps) {

  // ── Shared values ─────────────────────────────────────────────────────────

  const bgOpa    = useSharedValue(0);
  const cardY    = useSharedValue(50);
  const cardOpa  = useSharedValue(0);
  const barPct   = useSharedValue(0.35);
  const flashOpa = useSharedValue(0);
  const stampSc  = useSharedValue(0.1);
  const stampOpa = useSharedValue(0);
  const r1Sc     = useSharedValue(0.3);  const r1Opa = useSharedValue(0);
  const r2Sc     = useSharedValue(0.3);  const r2Opa = useSharedValue(0);
  const r3Sc     = useSharedValue(0.3);  const r3Opa = useSharedValue(0);

  // ── Easings ───────────────────────────────────────────────────────────────

  const easeOut   = Easing.out(Easing.cubic);
  const easeInOut = Easing.inOut(Easing.cubic);

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    'worklet';
    bgOpa.value    = 0;
    cardY.value    = 50;   cardOpa.value  = 0;
    barPct.value   = 0.35;
    flashOpa.value = 0;
    stampSc.value  = 0.1;  stampOpa.value = 0;
    r1Sc.value     = 0.3;  r1Opa.value   = 0;
    r2Sc.value     = 0.3;  r2Opa.value   = 0;
    r3Sc.value     = 0.3;  r3Opa.value   = 0;
  }

  // ── Play ──────────────────────────────────────────────────────────────────

  function play() {
    // 1. Backdrop
    bgOpa.value = withDelay(T.bgDelay,
      withTiming(0.92, { duration: T.bgDur, easing: easeOut }));

    // 2. Card slides up
    cardOpa.value = withDelay(T.cardDelay,
      withTiming(1, { duration: T.cardDur, easing: easeOut }));
    cardY.value   = withDelay(T.cardDelay,
      withTiming(0, { duration: T.cardDur, easing: easeOut }));

    // 3. XP bar sweeps to 100%
    barPct.value = withDelay(T.barDelay,
      withTiming(1, { duration: T.barDur, easing: easeInOut }));

    // 4. Screen flash
    flashOpa.value = withDelay(T.flashDelay,
      withSequence(
        withTiming(0.5,  { duration: T.flashInDur }),
        withTiming(0,    { duration: T.flashOutDur, easing: easeOut }),
      ));

    // 5. Stamp springs in
    stampOpa.value = withDelay(T.stampDelay,
      withTiming(1, { duration: 260, easing: easeOut }));
    stampSc.value  = withDelay(T.stampDelay,
      withSpring(1, { damping: 11, stiffness: 180, mass: 0.9 }));

    // 6. Aura rings burst
    ([
      [r1Sc, r1Opa, T.ring1],
      [r2Sc, r2Opa, T.ring2],
      [r3Sc, r3Opa, T.ring3],
    ] as const).forEach(([sc, opa, delay]) => {
      sc.value  = withDelay(delay,
        withTiming(2.9, { duration: T.ringDur, easing: easeOut }));
      opa.value = withDelay(delay,
        withSequence(
          withTiming(0.75, { duration: 50 }),
          withTiming(0,    { duration: T.ringDur, easing: easeOut }),
        ));
    });
  }

  useEffect(() => {
    if (!visible) return;

    reset();
    const cancelHaptics = scheduleLevelUpHaptics();
    const frame = requestAnimationFrame(() => play());

    return () => {
      cancelAnimationFrame(frame);
      cancelHaptics();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Animated styles ───────────────────────────────────────────────────────

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: bgOpa.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpa.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform:   [{ translateY: cardY.value }],
    opacity:     cardOpa.value,
    borderColor: interpolateColor(barPct.value, [0, 1], [BORDER_DIM, BORDER_GLOW]),
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${barPct.value * 100}%`,
  }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity:   stampOpa.value,
    transform: [{ scale: stampSc.value }],
  }));

  const r1Style = useAnimatedStyle(() => ({ transform: [{ scale: r1Sc.value }], opacity: r1Opa.value }));
  const r2Style = useAnimatedStyle(() => ({ transform: [{ scale: r2Sc.value }], opacity: r2Opa.value }));
  const r3Style = useAnimatedStyle(() => ({ transform: [{ scale: r3Sc.value }], opacity: r3Opa.value }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={s.container}>

        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}
          pointerEvents="none"
        />

        {/* Screen flash */}
        <Animated.View
          style={[StyleSheet.absoluteFill, s.flash, flashStyle]}
          pointerEvents="none"
        />

        {/* Tap to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        {/* Aura rings */}
        <View
          style={[s.ringBox, { left: RING_L, top: RING_T }]}
          pointerEvents="none"
        >
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r1Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r2Style]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, r3Style]} />
        </View>

        {/* ── Card ── */}
        <Animated.View style={[s.card, cardStyle]}>

          {/* Header */}
          <LinearGradient
            colors={['rgba(77,140,255,0.16)', 'rgba(143,180,255,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.header}
          >
            <Text style={s.headerLabel}>⚡ LEVEL UP</Text>
            <View style={s.statusRow}>
              <View style={s.statusDot} />
              <Text style={s.statusText}>ACTIVE</Text>
            </View>
          </LinearGradient>

          {/* Body — current level + XP bar */}
          <View style={s.body}>

            <View style={s.levelBlock}>
              <Text style={s.levelCap}>LEVEL</Text>
              <Text style={s.levelNum}>{fromLevel}</Text>
            </View>

            <View style={s.barSection}>
              <View style={s.barMeta}>
                <Text style={s.barLabel}>LV {fromLevel} · CLEARED</Text>
                <Text style={s.barVal}>LV {toLevel} · UNLOCKED</Text>
              </View>
              <View style={s.track}>
                <Animated.View style={[s.fillWrap, barStyle]}>
                  <LinearGradient
                    colors={[ACCENT, ACCENT_GLOW]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
            </View>

          </View>

          {/* ── Stamp — absoluteFill on card, covers header + body ── */}
          <Animated.View style={[StyleSheet.absoluteFill, s.stamp, stampStyle]}>

            <LinearGradient
              colors={BADGE_GRAD}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                s.badge,
                Platform.OS === 'ios' && {
                  shadowColor:   ACCENT,
                  shadowRadius:  30,
                  shadowOpacity: 0.9,
                  shadowOffset:  { width: 0, height: 0 },
                },
              ]}
            >
              <Text style={s.badgeIcon}>⚡</Text>
            </LinearGradient>

            <Text style={s.stampEyebrow}>LEVEL UP</Text>
            <Text style={s.stampLevel}>{toLevel}</Text>

          </Animated.View>

        </Animated.View>

      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { backgroundColor: '#05070F' },
  flash:    { backgroundColor: '#FFFFFF' },

  ringBox: {
    position:     'absolute',
    width:        RING_SIZE,
    height:       RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  ring: {
    borderRadius:  RING_SIZE / 2,
    borderWidth:   1.5,
    borderColor:   'rgba(77,140,255,0.8)',
    ...Platform.select({
      ios: {
        shadowColor:   ACCENT,
        shadowOpacity: 0.55,
        shadowRadius:  22,
        shadowOffset:  { width: 0, height: 0 },
      },
    }),
  },

  card: {
    width:           CARD_W,
    borderRadius:    18,
    backgroundColor: '#0E1524',
    borderWidth:     1,
    overflow:        'hidden',
    ...Platform.select({
      ios: {
        shadowColor:   ACCENT,
        shadowRadius:  28,
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.32,
      },
      android: { elevation: 12 },
    }),
  },

  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 18,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(77,140,255,0.14)',
  },
  headerLabel: {
    fontFamily:    fontFamily.mono,
    fontSize:      11,
    letterSpacing: 2,
    color:         ACCENT_GLOW,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  statusText: {
    fontFamily:    fontFamily.mono,
    fontSize:      10,
    letterSpacing: 1,
    color:         ACCENT,
  },

  body: { padding: 18, paddingBottom: 24 },

  levelBlock: { alignItems: 'center', marginBottom: 22 },
  levelCap: {
    fontFamily:    fontFamily.mono,
    fontSize:      11,
    letterSpacing: 2.5,
    color:         '#7D8AA8',
    marginBottom:  6,
  },
  levelNum: {
    fontFamily: fontFamily.display,
    fontSize:   72,
    lineHeight: 72,
    color:      '#AEB8D0',
  },

  barSection: { marginBottom: 0 },
  barMeta:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  barLabel: {
    fontFamily:    fontFamily.mono,
    fontSize:      11,
    color:         '#7D8AA8',
    letterSpacing: 1,
  },
  barVal: {
    fontFamily: fontFamily.mono,
    fontSize:   11,
    color:      ACCENT_GLOW,
  },
  track: {
    height:          9,
    borderRadius:    999,
    backgroundColor: '#0C1322',
    overflow:        'hidden',
  },
  fillWrap: {
    height:       '100%',
    borderRadius: 999,
    overflow:     'hidden',
  },

  // Stamp covers the full card (absoluteFill + overflow:hidden on card clips it)
  stamp: {
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(5,7,15,0.90)',
    borderRadius:    18,
    gap:             10,
  },

  badge: {
    width:          82,
    height:         82,
    borderRadius:   41,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   6,
  },
  badgeIcon: {
    fontSize:   36,
    lineHeight: 40,
  },

  stampEyebrow: {
    fontFamily:    fontFamily.mono,
    fontSize:      12,
    letterSpacing: 5,
    color:         '#AEB8D0',
  },
  stampLevel: {
    fontFamily: fontFamily.display,
    fontSize:   72,
    lineHeight: 72,
    color:      ACCENT_GLOW,
  },
});
