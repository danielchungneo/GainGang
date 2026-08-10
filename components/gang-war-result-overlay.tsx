import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
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
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GangBannerWithDivisionBorder } from '@/components/gang-banner-with-division-border';
import { fontFamily } from '@/lib/gaingang-theme';
import {
  demoteWarDivision,
  isWarDivision,
  promoteWarDivision,
  WAR_DIVISION_CRATE_TIERS,
  WAR_DIVISION_LABELS,
} from '@/lib/gang-wars/divisions';
import { rarityDef } from '@/lib/rewards';
import type { WarDivision } from '@/types';

const SCREEN = Dimensions.get('window');
const BANNER = 132;
const HERO = BANNER + 48;

/** Shared timeline (ms) — loss runs slightly slower / quieter. */
const T = {
  appearAt: 1000,
  morphAt: 1950,
  ctaAt: 4000,
} as const;

const T_LOSS = {
  appearAt: 1200,
  morphAt: 2300,
  dismissAt: 4200,
} as const;

interface GangWarResultOverlayProps {
  won: boolean;
  /** Division fought last week (before promote/demote). */
  division: WarDivision | string;
  ourScore: number;
  theirScore: number;
  ourName?: string;
  ourBannerUrl?: string | null;
  onDismiss: () => void;
  /** Win path: claim CTA. Defaults to onDismiss. */
  onClaimReward?: () => void;
}

function asDivision(value: WarDivision | string): WarDivision {
  return isWarDivision(value) ? value : 'iron';
}

function DivisionMorphBanner({
  uri,
  name,
  fromDivision,
  toDivision,
  morph,
  shimmer = null,
  somber = false,
}: {
  uri?: string | null;
  name?: string;
  fromDivision: WarDivision;
  toDivision: WarDivision;
  morph: SharedValue<number>;
  shimmer?: SharedValue<number> | null;
  somber?: boolean;
}) {
  const fromStyle = useAnimatedStyle(() => {
    if (somber) {
      return {
        opacity: interpolate(morph.value, [0, 0.45, 0.85, 1], [1, 0.7, 0.15, 0]),
        transform: [
          { scale: interpolate(morph.value, [0, 0.6, 1], [1, 0.94, 0.88]) },
          { rotate: `${interpolate(morph.value, [0, 1], [0, -4])}deg` },
        ],
      };
    }
    const shake =
      Math.sin(morph.value * Math.PI * 6) *
      interpolate(morph.value, [0, 0.4, 0.75, 1], [0, 5, 3, 0]);
    return {
      opacity: interpolate(morph.value, [0, 0.35, 0.7, 1], [1, 1, 0.2, 0]),
      transform: [
        { scale: interpolate(morph.value, [0, 0.45, 0.7, 1], [1, 1.12, 0.82, 0.7]) },
        { rotate: `${interpolate(morph.value, [0, 0.5, 1], [0, -6, -12])}deg` },
        { translateX: shake },
      ],
    };
  });

  const toStyle = useAnimatedStyle(() => {
    if (somber) {
      return {
        opacity: interpolate(morph.value, [0, 0.4, 0.75, 1], [0, 0.1, 0.55, 1]),
        transform: [
          { scale: interpolate(morph.value, [0, 0.5, 1], [0.9, 0.96, 1]) },
          { rotate: `${interpolate(morph.value, [0, 1], [3, 0])}deg` },
        ],
      };
    }
    return {
      opacity: interpolate(morph.value, [0, 0.4, 0.65, 1], [0, 0, 0.35, 1]),
      transform: [
        { scale: interpolate(morph.value, [0, 0.45, 0.72, 0.88, 1], [0.55, 0.7, 1.28, 0.94, 1]) },
        { rotate: `${interpolate(morph.value, [0, 0.55, 0.85, 1], [14, 8, -3, 0])}deg` },
      ],
    };
  });

  const flashStyle = useAnimatedStyle(() => ({
    opacity: somber
      ? interpolate(morph.value, [0.4, 0.55, 0.75], [0, 0.35, 0])
      : interpolate(morph.value, [0.42, 0.52, 0.62, 0.72, 0.82], [0, 1, 0.15, 0.7, 0]),
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: somber
      ? interpolate(morph.value, [0.35, 0.55, 0.95], [0, 0.35, 0])
      : interpolate(morph.value, [0.35, 0.55, 0.9], [0, 0.85, 0]),
    transform: [{ scale: interpolate(morph.value, [0.35, 1], [0.75, somber ? 1.45 : 1.85]) }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: somber
      ? interpolate(morph.value, [0.45, 0.65, 1], [0, 0.25, 0])
      : interpolate(morph.value, [0.45, 0.65, 1], [0, 0.7, 0]),
    transform: [{ scale: interpolate(morph.value, [0.45, 1], [0.8, somber ? 1.7 : 2.2]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: somber
      ? interpolate(morph.value, [0.3, 0.55, 0.9, 1], [0, 0.35, 0.12, 0])
      : interpolate(morph.value, [0.3, 0.55, 0.8, 1], [0, 0.9, 0.35, 0]),
    transform: [{ scale: interpolate(morph.value, [0.3, 0.7, 1], [0.9, somber ? 1.15 : 1.35, 1.1]) }],
  }));

  return (
    <View style={styles.morphWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.morphGlow, somber && styles.morphGlowSomber, glowStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.morphRing, styles.morphRingOuter, somber && styles.morphRingSomberOuter, ring2Style]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.morphRing, somber && styles.morphRingSomber, ring1Style]}
      />
      <Animated.View style={[styles.morphLayer, fromStyle]}>
        <GangBannerWithDivisionBorder
          uri={uri}
          name={name}
          division={fromDivision}
          size={BANNER}
        />
      </Animated.View>
      <Animated.View style={[styles.morphLayer, toStyle]}>
        <GangBannerWithDivisionBorder
          uri={uri}
          name={name}
          division={toDivision}
          size={BANNER}
          shimmer={shimmer}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.morphFlash, somber && styles.morphFlashSomber, flashStyle]}
      />
    </View>
  );
}

function scheduleWinHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  timeouts.push(
    setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 40),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, T.appearAt + 200),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, T.morphAt + 720),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, T.morphAt + 1100),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, T.ctaAt),
  );
  return () => timeouts.forEach(clearTimeout);
}

function scheduleLossHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  timeouts.push(
    setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }, 60),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, T_LOSS.appearAt + 240),
  );
  timeouts.push(
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, T_LOSS.morphAt + 800),
  );
  return () => timeouts.forEach(clearTimeout);
}

/** Win / loss reveal after Monday resolve (always plays, including Iron/Onyx holds). */
export function GangWarResultOverlay({
  won,
  division,
  ourScore,
  theirScore,
  ourName = 'Your Gang',
  ourBannerUrl,
  onDismiss,
  onClaimReward,
}: GangWarResultOverlayProps) {
  const insets = useSafeAreaInsets();
  const fought = asDivision(division);
  const nextDivision = won ? promoteWarDivision(fought) : demoteWarDivision(fought);
  const held = fought === nextDivision;
  const crateTier = WAR_DIVISION_CRATE_TIERS[fought];
  const crateDef = rarityDef(crateTier);

  const [ctaReady, setCtaReady] = useState(false);
  const [dismissReady, setDismissReady] = useState(false);

  const titlePop = useSharedValue(0);
  const scorePop = useSharedValue(0);
  const heroIcon = useSharedValue(0);
  const bannerAppear = useSharedValue(0);
  const morph = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const promoPop = useSharedValue(0);
  const claimPop = useSharedValue(0);
  const pulse = useSharedValue(0);

  const our = Math.round(ourScore);
  const their = Math.round(theirScore);

  const copy = useMemo(() => {
    if (won) {
      return {
        title: 'VICTORY!',
        scoreSub: 'Your gang crushed the war',
        promoEyebrow: 'BANNER UPGRADE',
        promoTitle: held ? 'Division Held' : 'Promoted',
        promoSub: held
          ? `${WAR_DIVISION_LABELS[fought]} stays on top`
          : `${WAR_DIVISION_LABELS[fought]} → ${WAR_DIVISION_LABELS[nextDivision]}`,
        promoAccent: '#fde68a',
      };
    }
    return {
      title: 'DEFEAT',
      scoreSub: 'The other gang took this war',
      promoEyebrow: 'BANNER FALLEN',
      promoTitle: held ? 'Division Held' : 'Demoted',
      promoSub: held
        ? `Still ${WAR_DIVISION_LABELS[fought]}`
        : `${WAR_DIVISION_LABELS[fought]} → ${WAR_DIVISION_LABELS[nextDivision]}`,
      promoAccent: 'rgba(252,165,165,0.85)',
    };
  }, [fought, held, nextDivision, won]);

  useEffect(() => {
    if (!won) {
      const clearHaptics = scheduleLossHaptics();

      heroIcon.value = withSequence(
        withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
        withDelay(
          Math.max(0, T_LOSS.appearAt - 700),
          withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        ),
      );
      titlePop.value = withDelay(120, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
      scorePop.value = withDelay(280, withTiming(1, { duration: 580, easing: Easing.out(Easing.cubic) }));

      bannerAppear.value = withDelay(
        T_LOSS.appearAt + 100,
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
      );

      morph.value = withDelay(
        T_LOSS.morphAt,
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
      );
      promoPop.value = withDelay(
        T_LOSS.morphAt + 1100,
        withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
      );

      claimPop.value = withDelay(
        T_LOSS.dismissAt,
        withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }),
      );

      const dismissTimer = setTimeout(() => setDismissReady(true), T_LOSS.dismissAt);
      return () => {
        clearHaptics();
        clearTimeout(dismissTimer);
      };
    }

    const clearHaptics = scheduleWinHaptics();

    // 1) Victory + scores — trophy holds, then crossfades out as banner fades in
    heroIcon.value = withSequence(
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withDelay(
        Math.max(0, T.appearAt - 520),
        withTiming(0, { duration: 480, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    titlePop.value = withDelay(80, withSpring(1, { damping: 11, stiffness: 160 }));
    scorePop.value = withDelay(220, withSpring(1, { damping: 12, stiffness: 150 }));

    // 2) Banner dramatically fades into the hero slot (overlaps trophy fade-out)
    bannerAppear.value = withDelay(
      T.appearAt + 60,
      withTiming(1, { duration: 820, easing: Easing.out(Easing.cubic) }),
    );

    // 3) Banner upgrade — longer, punchier morph, then idle border shimmer
    morph.value = withDelay(
      T.morphAt,
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }),
    );
    promoPop.value = withDelay(
      T.morphAt + 950,
      withSpring(1, { damping: 12, stiffness: 140 }),
    );
    shimmer.value = withDelay(
      T.morphAt + 1550,
      withRepeat(
        withTiming(1, { duration: 2100, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    // 4) CTA at bottom
    claimPop.value = withDelay(
      T.ctaAt,
      withSpring(1, { damping: 12, stiffness: 140 }),
    );
    pulse.value = withDelay(
      T.ctaAt,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    const ctaTimer = setTimeout(() => setCtaReady(true), T.ctaAt);
    return () => {
      clearHaptics();
      clearTimeout(ctaTimer);
    };
  }, [
    bannerAppear,
    claimPop,
    heroIcon,
    morph,
    promoPop,
    pulse,
    scorePop,
    shimmer,
    titlePop,
    won,
  ]);

  const heroIconStyle = useAnimatedStyle(() => ({
    opacity: heroIcon.value,
    transform: [
      { scale: interpolate(heroIcon.value, [0, 1], [won ? 0.55 : 0.7, 1]) },
      { translateY: interpolate(heroIcon.value, [0, 1], [won ? 24 : 10, 0]) },
    ],
  }));

  const bannerStyle = useAnimatedStyle(() => {
    const p = bannerAppear.value;
    if (!won) {
      return {
        opacity: interpolate(p, [0, 0.5, 1], [0, 0.45, 1], Extrapolation.CLAMP),
        transform: [
          {
            scale: interpolate(p, [0, 1], [0.88, 1], Extrapolation.CLAMP),
          },
        ],
      };
    }
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 0.7, 1], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(p, [0, 0.55, 1], [0.55, 1.12, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titlePop.value,
    transform: [
      { scale: interpolate(titlePop.value, [0, 1], [won ? 0.7 : 0.92, 1]) },
      { translateY: interpolate(titlePop.value, [0, 1], [won ? 18 : 8, 0]) },
    ],
  }));

  const scoreStyle = useAnimatedStyle(() => ({
    opacity: scorePop.value,
    transform: [{ scale: interpolate(scorePop.value, [0, 1], [won ? 0.85 : 0.96, 1]) }],
  }));

  const promoStyle = useAnimatedStyle(() => ({
    opacity: promoPop.value,
    transform: [{ translateY: interpolate(promoPop.value, [0, 1], [12, 0]) }],
  }));

  const claimStyle = useAnimatedStyle(() => ({
    opacity: claimPop.value,
    transform: [
      {
        translateY: interpolate(claimPop.value, [0, 1], [36, 0]),
      },
      {
        scale:
          interpolate(claimPop.value, [0, 1], [0.94, 1]) *
          (won ? interpolate(pulse.value, [0, 1], [1, 1.03]) : 1),
      },
    ],
  }));

  function handleClaim() {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    (onClaimReward ?? onDismiss)();
  }

  function handleDismiss() {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onDismiss();
  }

  if (!won) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
        <View style={styles.root}>
          <LinearGradient
            colors={['#1c0a0c', '#0c0709', '#060405']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(127,29,29,0.28)', 'transparent', 'rgba(30,30,30,0.35)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.winBody, { paddingBottom: 120 + insets.bottom }]}>
            <View style={styles.heroSlot}>
              <Animated.View style={[styles.heroLayer, heroIconStyle]}>
                <Ionicons name="skull-outline" size={68} color="#9f9f9f" />
              </Animated.View>
              <Animated.View style={[styles.heroLayer, bannerStyle]}>
                <DivisionMorphBanner
                  uri={ourBannerUrl}
                  name={ourName}
                  fromDivision={fought}
                  toDivision={nextDivision}
                  morph={morph}
                  somber
                />
              </Animated.View>
            </View>

            <Animated.View style={[styles.centerGap, styles.victoryBlock, titleStyle]}>
              <Text style={[styles.title, styles.defeatTitle]}>{copy.title}</Text>
              <Text style={[styles.sub, styles.defeatSub]}>{copy.scoreSub}</Text>
            </Animated.View>

            <Animated.View style={[styles.scoreCard, styles.defeatScoreCard, scoreStyle]}>
              <View style={styles.scoreCol}>
                <Text style={[styles.scoreCaption, styles.defeatMuted]}>Us</Text>
                <Text style={[styles.scoreUs, styles.defeatScoreUs]}>{our}</Text>
              </View>
              <Text style={[styles.scoreDash, styles.defeatMuted]}>–</Text>
              <View style={styles.scoreCol}>
                <Text style={[styles.scoreCaption, styles.defeatMuted]}>Them</Text>
                <Text style={styles.scoreThem}>{their}</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.promoBlock, promoStyle]}>
              <Text style={[styles.phaseEyebrow, styles.defeatEyebrow]}>{copy.promoEyebrow}</Text>
              <Text style={[styles.promoTitle, styles.defeatPromoTitle]}>{copy.promoTitle}</Text>
              <Text style={[styles.sub, { color: copy.promoAccent }]}>{copy.promoSub}</Text>
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.ctaDock,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
              claimStyle,
            ]}
            pointerEvents={dismissReady ? 'auto' : 'none'}
          >
            <Pressable
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              style={({ pressed }) => [
                { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <View style={styles.defeatCta}>
                <Text style={styles.defeatCtaLabel}>CONTINUE</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <LinearGradient
          colors={['#052e16', '#0a1628', '#070b14']}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(234,179,8,0.18)', 'transparent', 'rgba(52,211,153,0.16)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.winBody, { paddingBottom: 120 + insets.bottom }]}>
          <View style={styles.heroSlot}>
            <Animated.View style={[styles.heroLayer, heroIconStyle]}>
              <Ionicons name="trophy" size={72} color="#fbbf24" />
            </Animated.View>
            <Animated.View style={[styles.heroLayer, bannerStyle]}>
              <DivisionMorphBanner
                uri={ourBannerUrl}
                name={ourName}
                fromDivision={fought}
                toDivision={nextDivision}
                morph={morph}
                shimmer={shimmer}
              />
            </Animated.View>
          </View>

          <Animated.View style={[styles.centerGap, styles.victoryBlock, titleStyle]}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.sub}>{copy.scoreSub}</Text>
          </Animated.View>

          <Animated.View style={[styles.scoreCard, scoreStyle]}>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreCaption}>Us</Text>
              <Text style={styles.scoreUs}>{our}</Text>
            </View>
            <Text style={styles.scoreDash}>–</Text>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreCaption}>Them</Text>
              <Text style={styles.scoreThem}>{their}</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.promoBlock, promoStyle]}>
            <Text style={styles.phaseEyebrow}>{copy.promoEyebrow}</Text>
            <Text style={styles.promoTitle}>{copy.promoTitle}</Text>
            <Text style={[styles.sub, { color: copy.promoAccent }]}>{copy.promoSub}</Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.ctaDock,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            claimStyle,
          ]}
          pointerEvents={ctaReady ? 'auto' : 'none'}
        >
          <Pressable
            onPress={handleClaim}
            accessibilityRole="button"
            accessibilityLabel="Claim your reward"
            style={({ pressed }) => [
              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={[crateDef.fill[0], crateDef.color, crateDef.fill[1]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.cta, { borderColor: crateDef.glow, shadowColor: crateDef.glow }]}
            >
              <Text style={styles.ctaLabel}>CLAIM YOUR REWARD</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  lossBg: {
    backgroundColor: '#450a0a',
  },
  defeatTitle: {
    color: '#d4d4d4',
    fontSize: 40,
  },
  defeatSub: {
    color: 'rgba(212,212,212,0.62)',
  },
  defeatScoreCard: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  defeatScoreUs: {
    color: 'rgba(252,165,165,0.75)',
  },
  defeatMuted: {
    color: 'rgba(255,255,255,0.35)',
  },
  defeatEyebrow: {
    color: 'rgba(252,165,165,0.55)',
  },
  defeatPromoTitle: {
    color: '#e5e5e5',
  },
  defeatCta: {
    minWidth: Math.min(SCREEN.width - 48, 320),
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  defeatCtaLabel: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1.2,
  },
  winBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: SCREEN.height * 0.1,
    gap: 10,
  },
  heroSlot: {
    width: HERO,
    height: HERO,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  centerGap: {
    alignItems: 'center',
    gap: 8,
  },
  victoryBlock: {
    marginTop: 28,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 44,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  phaseEyebrow: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(253,230,138,0.85)',
    marginBottom: 4,
    textAlign: 'center',
  },
  promoBlock: {
    marginTop: 8,
    alignItems: 'center',
    minHeight: 72,
  },
  promoTitle: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scoreCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  scoreCol: {
    alignItems: 'center',
    minWidth: 72,
  },
  scoreCaption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 4,
    fontFamily: fontFamily.bodySemi,
  },
  scoreUs: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    color: '#86efac',
  },
  scoreThem: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    color: '#fca5a5',
  },
  scoreDash: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 12,
  },
  morphWrap: {
    width: BANNER + 56,
    height: BANNER + 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morphLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  morphGlow: {
    position: 'absolute',
    width: BANNER + 36,
    height: BANNER + 36,
    borderRadius: 28,
    backgroundColor: 'rgba(253, 224, 71, 0.45)',
  },
  morphGlowSomber: {
    backgroundColor: 'rgba(127, 29, 29, 0.35)',
  },
  morphRing: {
    position: 'absolute',
    width: BANNER + 20,
    height: BANNER + 20,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(253, 224, 71, 0.95)',
  },
  morphRingSomber: {
    borderColor: 'rgba(161, 161, 170, 0.55)',
  },
  morphRingOuter: {
    borderColor: 'rgba(167, 243, 208, 0.85)',
    borderWidth: 2,
  },
  morphRingSomberOuter: {
    borderColor: 'rgba(113, 113, 122, 0.4)',
  },
  morphFlash: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  morphFlashSomber: {
    backgroundColor: 'rgba(127, 29, 29, 0.55)',
  },
  hint: {
    marginTop: 28,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  ctaDock: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    alignItems: 'center',
    gap: 12,
  },
  cta: {
    minWidth: Math.min(SCREEN.width - 48, 320),
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctaLabel: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
