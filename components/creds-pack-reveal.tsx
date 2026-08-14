/**
 * CredsPackReveal.tsx
 * React Native Reanimated 3 — GainGang "Creds Pack Purchase" celebration
 *
 * Drop-in replacement for the generic <RewardReveal> currently used for the
 * Creds top-up (IAP) success moment in components/shop-sheets.tsx. Where
 * RewardReveal is for loot/rank rewards, this is bespoke to buying Creds:
 * the CredPlate charges up, bursts, coin/aura confetti falls, then a system
 * panel counts up the Creds granted and the new wallet balance before a
 * pulsing aura CONTINUE button appears.
 *
 * One master clock (seconds) drives the whole timeline — see TL below to
 * retune. Mirrors the structure/conventions of components/reward-reveal/RewardReveal.tsx.
 *
 * Dependencies: react-native-reanimated >= 3, react-native-svg (via CredPlate),
 * expo-linear-gradient.
 *
 * Usage (replaces the <RewardReveal> block in ShopCredsPacksSheet):
 *   <CredsPackReveal
 *     visible={!!topUpReveal}
 *     packLabel={topUpReveal.title}        // e.g. pack.label, "BEAST BUNDLE"
 *     amount={topUpReveal.amount}
 *     priceLabel={pack.priceLabel}         // e.g. "$9.99"
 *     bestValue={pack.bestValue}
 *     balanceBefore={balanceBeforePurchase}
 *     onContinue={() => setTopUpReveal(null)}
 *   />
 */

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CredPlate } from '@/components/ui/cred-plate';
import { useCelebrationGate } from '@/hooks/use-celebration-gate';
import { fontFamily } from '@/lib/gaingang-theme';
import { CREDS_GOLD } from '@/lib/shop';

const GOLD = CREDS_GOLD.dark; // #F5A524
const GOLD_RGB = '245,165,36';
const AURA0 = '#4D8CFF';
const AURA1 = '#9D4EDD';
const BACKDROP = '#05070F';

const PANEL_W = 322;
const STAGE = 108;
/** Keep the master clock advancing so confetti can idle until dismiss. */
const CLOCK_HOLD = 86_400;

// ─── Timeline (seconds) ──────────────────────────────────────────────────────
const BURST = 1.7;
const TL = {
  bgIn: [0, 0.45],
  coinIn: [0.1, 0.7],
  charge: [0.7, BURST],
  burst: BURST,
  flashUp: [BURST - 0.06, BURST + 0.02],
  flashDn: [BURST + 0.05, BURST + 0.5],
  reveal: [BURST + 0.02, BURST + 0.6],
  glow: [BURST + 0.1, BURST + 0.7],
  kicker: [BURST + 0.3, BURST + 0.7],
  title: [BURST + 0.4, BURST + 0.85],
  badge: [BURST + 0.7, BURST + 1.05],
  amountStart: BURST + 1.0,
  amountEnd: BURST + 1.9,
  balanceGap: 0.15,
  balanceDur: 0.95,
  ctaGap: 0.35,
  ctaDur: 0.4,
  confettiFrom: BURST + 0.15,
  END: BURST + 4.2,
} as const;

// ─── worklet easing helpers (match RewardReveal.tsx) ────────────────────────
function outCubic(p: number) {
  'worklet';
  const s = p - 1;
  return s * s * s + 1;
}
function inCubic(p: number) {
  'worklet';
  return p * p * p;
}
function outBack(p: number) {
  'worklet';
  const c1 = 1.6, c3 = c1 + 1, s = p - 1;
  return 1 + c3 * s * s * s + c1 * s * s;
}
function segE(c: number, a: number, b: number, ease: (p: number) => number) {
  'worklet';
  const p = Math.min(1, Math.max(0, (c - a) / (b - a)));
  return ease(p);
}

export type CredsPackRevealProps = {
  visible: boolean;
  /** e.g. "BEAST BUNDLE" (CREDS_PACKS[n].label) */
  packLabel: string;
  /** Creds granted (CREDS_PACKS[n].amount or the server's amountGranted) */
  amount: number;
  /** e.g. "$9.99" (CREDS_PACKS[n].priceLabel). Omit for restores. */
  priceLabel?: string;
  /** shows the "BEST VALUE" badge instead of the price when true */
  bestValue?: boolean;
  /** wallet balance immediately before the debit/credit — omit to hide the ledger row */
  balanceBefore?: number;
  /** defaults to PACK UNLOCKED; use PURCHASE RESTORED for restore flows */
  kicker?: string;
  continueLabel?: string;
  onContinue: () => void;
};

export function CredsPackReveal({
  visible,
  packLabel,
  amount,
  priceLabel,
  bestValue = false,
  balanceBefore,
  kicker = 'PACK UNLOCKED',
  continueLabel = 'CONTINUE',
  onContinue,
}: CredsPackRevealProps) {
  useCelebrationGate(visible);
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [panelH, setPanelH] = useState(0);
  const clock = useSharedValue(0);
  const pulse = useSharedValue(0);
  const panelHeightSV = useSharedValue(0);
  const hasLedger = typeof balanceBefore === 'number';
  const showBadge = bestValue || Boolean(priceLabel);
  const amountSub = priceLabel ? `CREDS · ${priceLabel}` : 'CREDS';

  // True visual center of the usable screen (same anchor for coin + card).
  const anchorX = winW / 2;
  const anchorY = insets.top + (winH - insets.top - insets.bottom) / 2;
  const panelW = Math.min(winW - 48, PANEL_W);

  useEffect(() => {
    if (visible) {
      clock.value = 0;
      panelHeightSV.value = panelH;
      // Run past TL.END so confetti keeps looping until dismiss.
      // Narrative styles clamp via segE, so holding past END is idle-safe.
      clock.value = withTiming(CLOCK_HOLD, {
        duration: CLOCK_HOLD * 1000,
        easing: Easing.linear,
      });
      pulse.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(clock);
      cancelAnimation(pulse);
      clock.value = 0;
      pulse.value = 0;
    }
  }, [visible, clock, pulse, panelH, panelHeightSV]);

  const bgStyle = useAnimatedStyle(() => ({
    opacity: segE(clock.value, TL.bgIn[0], TL.bgIn[1], outCubic) * 0.95,
  }));

  const flashStyle = useAnimatedStyle(() => {
    const up = segE(clock.value, TL.flashUp[0], TL.flashUp[1], outCubic);
    const dn = segE(clock.value, TL.flashDn[0], TL.flashDn[1], outCubic);
    return { opacity: Math.max(0, Math.min(1, up - dn)) };
  });

  const shockStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (clock.value - BURST) / 0.55));
    return { opacity: p <= 0 || p >= 1 ? 0 : 1 - p, transform: [{ scale: 0.2 + outCubic(p) * 3.6 }] };
  });

  const panelStyle = useAnimatedStyle(() => {
    const r = segE(clock.value, TL.reveal[0], TL.reveal[1], outCubic);
    const g = segE(clock.value, TL.glow[0], TL.glow[1], outCubic);
    return {
      opacity: Math.min(1, r * 2.2),
      transform: [
        { translateY: -panelHeightSV.value / 2 },
        { scale: 0.74 + r * 0.26 },
      ],
      borderColor: `rgba(${GOLD_RGB},${0.3 + g * 0.45})`,
      shadowOpacity: g * 0.55,
      shadowRadius: 44 * g,
    };
  });

  const kickerStyle = useAnimatedStyle(() => ({ opacity: segE(clock.value, TL.kicker[0], TL.kicker[1], outCubic) }));
  const titleStyle = useAnimatedStyle(() => {
    const p = segE(clock.value, TL.title[0], TL.title[1], outCubic);
    return { opacity: p, transform: [{ translateY: (1 - p) * 12 }] };
  });
  const badgeStyle = useAnimatedStyle(() => {
    const p = segE(clock.value, TL.badge[0], TL.badge[1], outBack);
    return { opacity: segE(clock.value, TL.badge[0], TL.badge[1], outCubic), transform: [{ scale: 0.7 + p * 0.3 }] };
  });
  const amountStyle = useAnimatedStyle(() => ({
    opacity: segE(clock.value, TL.amountStart, TL.amountStart + 0.3, outCubic),
  }));

  const balanceStart = TL.amountEnd + TL.balanceGap;
  const balanceEnd = balanceStart + TL.balanceDur;
  const balanceStyle = useAnimatedStyle(() => ({
    opacity: segE(clock.value, balanceStart, balanceStart + 0.3, outCubic),
  }));

  const ctaStart = balanceEnd + TL.ctaGap;
  const ctaStyle = useAnimatedStyle(() => {
    const p = segE(clock.value, ctaStart, ctaStart + TL.ctaDur, outCubic);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 14 }],
      shadowOpacity: 0.3 + pulse.value * 0.35,
      shadowRadius: 18 + pulse.value * 22,
    };
  });

  const amountText = useCountUpText(clock, 0, amount, TL.amountStart, TL.amountEnd);
  const balanceText = useCountUpText(
    clock,
    balanceBefore ?? 0,
    (balanceBefore ?? 0) + amount,
    balanceStart,
    balanceEnd,
  );

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onContinue}
    >
      <View style={styles.root}>
        {/* Solid scrim — same treatment as RewardReveal / LevelUp modal hosts */}
        <View style={styles.scrim} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdrop,
            { width: winW, height: winH },
            bgStyle,
          ]}
        />
        <View style={styles.grid} pointerEvents="none" />

        <View
          pointerEvents="none"
          style={[
            styles.stage,
            {
              left: anchorX - STAGE / 2,
              top: anchorY - STAGE / 2,
            },
          ]}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <ConvergeDot key={`c${i}`} clock={clock} i={i} />
          ))}
          <Animated.View style={[styles.shock, shockStyle]} />
          <ChargingCoin clock={clock} />
          {Array.from({ length: 14 }, (_, i) => (
            <Shard key={`s${i}`} clock={clock} i={i} />
          ))}
        </View>

        <Confetti clock={clock} fallDistance={winH + 80} />

        <Animated.View
          style={[
            styles.panel,
            {
              width: panelW,
              left: anchorX - panelW / 2,
              top: anchorY,
            },
            panelStyle,
          ]}
          onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.height);
            if (next > 0 && next !== panelH) {
              setPanelH(next);
              panelHeightSV.value = next;
            }
          }}
        >
          <View style={styles.topEdge} />
          <View style={styles.header}>
            <Text style={styles.headerLeft}>◈ SYSTEM</Text>
            <View style={styles.headerRight}>
              <View style={styles.dot} />
              <Text style={styles.headerTag}>PURCHASE</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Animated.Text style={[styles.kicker, kickerStyle]}>{kicker}</Animated.Text>
            <Animated.Text style={[styles.title, titleStyle]} numberOfLines={2}>
              {packLabel}
            </Animated.Text>
            {showBadge ? (
              <Animated.View style={[styles.badge, badgeStyle]}>
                <Text style={styles.badgeText}>{bestValue ? 'BEST VALUE' : priceLabel}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.divider} />

            <Animated.View style={[styles.amountRow, amountStyle]}>
              <CredPlate size={34} glow />
              <Text style={styles.amountText}>+{amountText}</Text>
            </Animated.View>
            <Animated.Text style={[styles.amountSub, amountStyle]}>
              {amountSub}
            </Animated.Text>

            {hasLedger ? (
              <Animated.View style={[styles.ledgerRow, balanceStyle]}>
                <Text style={styles.ledgerLabel}>NEW BALANCE</Text>
                <View style={styles.ledgerValueRow}>
                  <CredPlate size={16} />
                  <Text style={styles.ledgerValue}>{balanceText}</Text>
                </View>
              </Animated.View>
            ) : null}

            <Animated.View style={[styles.ctaWrap, ctaStyle]}>
              <Pressable onPress={onContinue} accessibilityRole="button" style={styles.ctaHit}>
                <LinearGradient
                  colors={[AURA0, AURA1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.cta}
                >
                  <Text style={styles.ctaLabel}>{continueLabel}</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>

          {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
            <View key={k} style={[styles.bracket, styles[`bracket_${k}`]]} />
          ))}
        </Animated.View>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      </View>
    </Modal>
  );
}

// ─── Count-up: bridges a worklet clock to plain JS text via useAnimatedReaction ──
function useCountUpText(
  clock: SharedValue<number>,
  from: number,
  to: number,
  start: number,
  end: number,
) {
  const [text, setText] = useState(Math.round(from).toLocaleString());
  useAnimatedReaction(
    () => {
      const p = segE(clock.value, start, end, outCubic);
      return Math.round(from + (to - from) * p);
    },
    (val, prev) => {
      if (val !== prev) runOnJS(setText)(val.toLocaleString());
    },
  );
  return text;
}

// ─── Converge particle (pulled INTO the coin) ───────────────────────────────
function ConvergeDot({ clock, i }: { clock: SharedValue<number>; i: number }) {
  const N = 18;
  const ang = (i / N) * Math.PI * 2 + i * 0.6;
  const startR = 128 + (i % 4) * 24;
  const s = 0.6 + (i % 6) * 0.11;
  const sz = 3 + (i % 3);
  const col = i % 2 === 0 ? '#FFD787' : AURA0;
  const style = useAnimatedStyle(() => {
    const c = clock.value;
    const p = segE(c, s, BURST, inCubic);
    const r = (1 - p) * startR;
    const op = c > BURST ? 0 : Math.sin(Math.min(1, (c - s) / (BURST - s)) * Math.PI) * 0.9;
    return { opacity: c < s ? 0 : op, transform: [{ translateX: Math.cos(ang) * r }, { translateY: Math.sin(ang) * r }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: STAGE / 2,
          top: STAGE / 2,
          width: sz,
          height: sz,
          marginLeft: -sz / 2,
          marginTop: -sz / 2,
          borderRadius: sz,
          backgroundColor: col,
          shadowColor: col,
          shadowRadius: sz + 4,
          shadowOpacity: 1,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

// ─── Coin shard (flies out at the burst) ────────────────────────────────────
function Shard({ clock, i }: { clock: SharedValue<number>; i: number }) {
  const N = 14;
  const ang = (i / N) * Math.PI * 2 + 0.4;
  const sz = 12 + (i % 3) * 4;
  const style = useAnimatedStyle(() => {
    const p = segE(clock.value, BURST, BURST + 0.8, outCubic);
    const dist = 60 + (i % 4) * 40 + p * (160 + (i % 3) * 60);
    const rot = p * 500 * (i % 2 === 0 ? 1 : -1);
    return {
      opacity: p <= 0 ? 0 : (1 - p) * 0.95,
      transform: [{ translateX: Math.cos(ang) * dist }, { translateY: Math.sin(ang) * dist }, { rotate: `${rot}deg` }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: STAGE / 2, top: STAGE / 2 }, style]}
    >
      <View style={{ marginLeft: -sz / 2, marginTop: -sz / 2 }}>
        <CredPlate size={sz} />
      </View>
    </Animated.View>
  );
}

// ─── Charging coin core (build-up → burst) ──────────────────────────────────
function ChargingCoin({ clock }: { clock: SharedValue<number> }) {
  const coinStyle = useAnimatedStyle(() => {
    const cc = clock.value;
    const inSc = segE(cc, TL.coinIn[0], TL.coinIn[1], outBack);
    const inOp = segE(cc, TL.coinIn[0], TL.coinIn[0] + 0.35, outCubic);
    const charge = segE(cc, TL.charge[0], TL.charge[1], inCubic);
    const shake = charge * charge * 6;
    const preSc = 1 + charge * 0.2 + Math.sin(cc * 11) * 0.025 * charge;
    const past = cc >= BURST;
    const burstSc = 1 + segE(cc, BURST, BURST + 0.16, outCubic) * 2.1;
    const burstOp = 1 - segE(cc, BURST - 0.03, BURST + 0.1, outCubic);
    return {
      opacity: past ? Math.max(0, burstOp) : inOp,
      transform: [
        { translateX: Math.sin(cc * 66) * shake },
        { translateY: Math.cos(cc * 74) * shake },
        { scale: inSc * (past ? burstSc : preSc) },
      ],
    };
  });
  const spinOuter = useAnimatedStyle(() => {
    const extra = segE(clock.value, TL.charge[0], TL.charge[1], inCubic) * 720;
    return { transform: [{ rotate: `${clock.value * 60 + extra}deg` }] };
  });
  const spinInner = useAnimatedStyle(() => {
    const extra = segE(clock.value, TL.charge[0], TL.charge[1], inCubic) * 720;
    return { transform: [{ rotate: `${-(clock.value * 60 + extra) * 1.4}deg` }] };
  });
  const auraStyle = useAnimatedStyle(() => {
    const charge = segE(clock.value, TL.charge[0], TL.charge[1], inCubic);
    return { opacity: 0.36 * (0.4 + charge * 0.6) };
  });

  const ticks = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * 360;
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          width: STAGE + 12,
          height: STAGE + 12,
          transform: [{ rotate: `${a}deg` }],
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: (STAGE + 12) / 2 - 0.75,
            top: 0,
            width: 1.5,
            height: 7,
            borderRadius: 1,
            backgroundColor: `rgba(${GOLD_RGB},0.55)`,
          }}
        />
      </View>
    );
  });

  return (
    <Animated.View style={[styles.coin, coinStyle]}>
      <Animated.View style={[styles.coinAura, auraStyle]} />
      <Animated.View style={[styles.coinRingOuter, spinOuter]}>{ticks}</Animated.View>
      <Animated.View style={[styles.coinRingInner, spinInner]} />
      <CredPlate size={STAGE * 0.72} glow />
    </Animated.View>
  );
}

// ─── Falling coin / aura confetti — continuous celebration after the burst ──
function Confetti({
  clock,
  fallDistance,
}: {
  clock: SharedValue<number>;
  fallDistance: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 20 }, (_, i) => (
        <ConfettiPiece key={i} clock={clock} i={i} fallDistance={fallDistance} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  clock,
  i,
  fallDistance,
}: {
  clock: SharedValue<number>;
  i: number;
  fallDistance: number;
}) {
  const seedX = (i * 53) % 100;
  const speed = 0.55 + (i % 5) * 0.09;
  const cycle = 4.2 / speed;
  const delay = (i * 0.19) % cycle;
  const isCoin = i % 3 !== 0;
  const style = useAnimatedStyle(() => {
    const t = clock.value;
    if (t < TL.confettiFrom) return { opacity: 0 };
    const lt = t - TL.confettiFrom;
    const lp = ((lt + delay) % cycle) / cycle;
    const y = interpolate(lp, [0, 1], [-40, fallDistance], Extrapolation.CLAMP);
    const sway = Math.sin(lp * 10 + i) * 16;
    const rot = lp * 360 * (i % 2 === 0 ? 1 : -1) + i * 12;
    const fadeIn = Math.min(1, lp / 0.06);
    const fadeOut = Math.min(1, (1 - lp) / 0.08);
    return {
      opacity: 0.85 * Math.min(fadeIn, fadeOut),
      transform: [{ translateY: y }, { translateX: sway }, { rotate: `${rot}deg` }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: `${seedX}%`, top: 0 }, style]}>
      {isCoin ? (
        <CredPlate size={12 + (i % 3) * 3} />
      ) : (
        <View style={{ width: 8, height: 12, borderRadius: 2, backgroundColor: i % 2 === 0 ? AURA0 : AURA1 }} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,7,15,0.92)',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: BACKDROP,
  },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.04 },

  stage: {
    position: 'absolute',
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shock: {
    position: 'absolute',
    width: 200,
    height: 200,
    left: STAGE / 2 - 100,
    top: STAGE / 2 - 100,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },

  coin: {
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinAura: {
    position: 'absolute',
    width: STAGE + 68,
    height: STAGE + 68,
    borderRadius: (STAGE + 68) / 2,
    backgroundColor: GOLD,
  },
  coinRingOuter: {
    position: 'absolute',
    width: STAGE + 12,
    height: STAGE + 12,
    borderRadius: (STAGE + 12) / 2,
    borderWidth: 1.5,
    borderColor: `rgba(${GOLD_RGB},0.5)`,
  },
  coinRingInner: {
    position: 'absolute',
    width: STAGE - 14,
    height: STAGE - 14,
    borderRadius: (STAGE - 14) / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: `rgba(${GOLD_RGB},0.6)`,
  },

  panel: {
    position: 'absolute',
    borderRadius: 20,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 20 },
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#FFD787', shadowColor: '#FFD787', shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, zIndex: 2 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 11,
    backgroundColor: `rgba(${GOLD_RGB},0.1)`,
    borderBottomWidth: 1, borderBottomColor: `rgba(${GOLD_RGB},0.16)`,
  },
  headerLeft: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 2.5, color: GOLD },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD, shadowColor: GOLD, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  headerTag: { fontFamily: fontFamily.mono, fontSize: 9, letterSpacing: 1.5, color: GOLD },

  body: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 22, alignItems: 'center', gap: 8 },
  kicker: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 2.5, color: GOLD },
  title: { fontFamily: fontFamily.display, fontSize: 21, color: '#E8EDF7', textAlign: 'center' },
  badge: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, backgroundColor: `rgba(${GOLD_RGB},0.13)`, borderWidth: 1, borderColor: `rgba(${GOLD_RGB},0.4)` },
  badgeText: { fontFamily: fontFamily.mono, fontSize: 10.5, letterSpacing: 1.6, color: GOLD },

  divider: { height: 1, width: '100%', backgroundColor: `rgba(${GOLD_RGB},0.22)`, marginVertical: 6 },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  amountText: { fontFamily: fontFamily.display, fontSize: 38, color: GOLD, textShadowColor: `rgba(${GOLD_RGB},0.6)`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  amountSub: { fontFamily: fontFamily.mono, fontSize: 9.5, letterSpacing: 2, color: '#7D8AA8' },

  ledgerRow: {
    marginTop: 12, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12,
    backgroundColor: 'rgba(19,28,48,0.65)', borderWidth: 1, borderColor: 'rgba(125,165,255,0.14)',
  },
  ledgerLabel: { fontFamily: fontFamily.mono, fontSize: 9.5, letterSpacing: 1.6, color: '#7D8AA8' },
  ledgerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ledgerValue: { fontFamily: fontFamily.monoBold, fontSize: 15, color: '#E8EDF7' },

  ctaWrap: { width: '100%', marginTop: 8, paddingTop: 8 },
  ctaHit: {
    width: '100%',
    borderRadius: 13,
    overflow: 'hidden',
    shadowColor: AURA1,
    shadowOffset: { width: 0, height: 8 },
  },
  cta: { height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  ctaLabel: { fontFamily: fontFamily.display, fontSize: 15, letterSpacing: 1.5, color: '#fff' },

  bracket: { position: 'absolute', width: 15, height: 15, borderColor: `rgba(${GOLD_RGB},0.4)` },
  bracket_tl: { top: 8, left: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  bracket_tr: { top: 8, right: 8, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  bracket_bl: { bottom: 8, left: 8, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  bracket_br: { bottom: 8, right: 8, borderBottomWidth: 1.5, borderRightWidth: 1.5 },

  flash: { backgroundColor: '#ffffff', zIndex: 20 },
});

export default CredsPackReveal;
