/**
 * RewardReveal.tsx
 * React Native Reanimated 3 — GainGang "Reward Reveal"
 *
 * You OPEN a sealed rune-sigil (the entity): it charges up, runes spin faster,
 * charge particles are pulled in, cracks of light appear — then it BURSTS in a
 * white flash, and the reward is revealed emerging from the flash.
 *
 * During charge the orb scrambles through rarity colors so the final tier stays
 * hidden until the burst locks the palette and the reveal panel appears.
 *
 *   charge (color scramble) → flash → reveal (banner + title + reward rows + claim)
 *
 * Everything is data-driven so you can drop in ANY reward:
 *   - a banner image (bannerSource) OR the auto emblem fallback
 *   - a title + kicker + subtitle
 *   - any number of reward rows (XP, rank, titles, items…)
 *   - a rank tier that recolours the whole reveal ('aura' = signature blue→violet)
 *
 * The whole timeline is driven by ONE clock shared value (seconds), so it maps
 * 1:1 to the design timeline and is easy to retune. Timings live in TL below.
 *
 * Dependencies:  react-native-reanimated >= 3
 * Optional:      expo-linear-gradient (nicer gradients; flat fallback used here)
 *
 * Usage:
 *   const [show, setShow] = useState(false);
 *   <RewardReveal
 *     visible={show}
 *     tier="A"
 *     title="Shadow Sovereign's Gauntlets"
 *     subtitle="Awarded for completing the 30-day Iron Oath."
 *     bannerSource={require('./assets/gauntlets.png')}
 *     rewards={[
 *       { label: 'XP EARNED',      value: '+540',          icon: '✦', color: '#FFBD52' },
 *       { label: 'RANK PROGRESS',  value: 'B → A',         icon: '▲' },
 *       { label: 'TITLE UNLOCKED', value: 'Iron Disciple', icon: '❖', color: '#8FB4FF' },
 *     ]}
 *     onClaim={() => setShow(false)}
 *   />
 */

import React, { useEffect, useId, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolation,
  Easing,
  cancelAnimation,
  SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Polygon,
  Stop,
} from 'react-native-svg';

import { LevelBadge } from '@/components/ui';

const ORB = 118;
const INNER_RING = ORB - 40;
const CORE_SIZE = 56;

// ─── Timeline (seconds) ────────────────────────────────────────────────────────
// Charge is intentionally long so color scramble can build slow → frantic.
const TL = {
  bgIn:      [0, 0.55],
  orbIn:     [0.25, 1.15],
  charge:    [1.15, 4.35],   // long spin-up / color scramble buildup
  burst:     4.35,           // <<< the flash
  flashUp:   [4.27, 4.37],
  flashDn:   [4.4, 4.9],
  reveal:    [4.37, 5.0],    // reward emerges from flash
  glow:      [4.45, 5.05],
  banner:    [4.65, 5.25],
  head:      [4.85, 5.4],    // kicker + title + subtitle
  rowsStart: 5.25,           // + i * 0.16
  rowStep:   0.16,
  claim:     [6.3, 6.7],
  END:       7.05,
};

/** Color scramble: slow at first, eases into a frantic finish. */
const SCRAMBLE = {
  startMs: 420, // first rarity hold
  endMs: 32,    // peak frenzy just before burst
};

/** Haptic cues aligned to TL (ms). */
const H = {
  orbIn: TL.orbIn[0] * 1000,
  charge: TL.charge[0] * 1000,
  burst: TL.burst * 1000,
  reveal: TL.reveal[0] * 1000 + 120,
  banner: TL.banner[0] * 1000,
  claim: TL.claim[0] * 1000,
} as const;

function scheduleRewardRevealHaptics(rowCount = 0): () => void {
  if (Platform.OS === 'web') return () => {};

  const timeouts: ReturnType<typeof setTimeout>[] = [];

  function at(ms: number, fn: () => void) {
    timeouts.push(setTimeout(fn, ms));
  }

  at(H.orbIn, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });

  at(H.charge, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });

  // Accelerating charge ticks — spaced out early, dense near the burst.
  const chargeStart = TL.charge[0];
  const chargeDur = TL.burst - TL.charge[0];
  const pulseFracs = [0.12, 0.28, 0.44, 0.58, 0.7, 0.8, 0.88, 0.93, 0.97];
  for (const frac of pulseFracs) {
    at((chargeStart + chargeDur * frac) * 1000, () => {
      void Haptics.impactAsync(
        frac < 0.7
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      );
    });
  }

  at(H.burst, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });

  at(H.reveal, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });

  at(H.banner, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });

  for (let i = 0; i < Math.min(rowCount, 4); i += 1) {
    at((TL.rowsStart + i * TL.rowStep) * 1000, () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  }

  at(H.claim, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });

  return () => timeouts.forEach(clearTimeout);
}

function claimPressHaptic() {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

// ─── Tier palettes ────────────────────────────────────────────────────────────
export type Tier = 'aura' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
const TIERS: Record<Tier, { c: [string, string, string]; rgb: string }> = {
  aura: { c: ['#4D8CFF', '#9D4EDD', '#8FB4FF'], rgb: '77,140,255' },
  E:    { c: ['#64748B', '#94A3B8', '#B4BECE'], rgb: '100,116,139' },
  D:    { c: ['#2DD4BF', '#5EEAD4', '#99F6E4'], rgb: '45,212,191' },
  C:    { c: ['#4D8CFF', '#6FA1FF', '#8FB4FF'], rgb: '77,140,255' },
  B:    { c: ['#9D4EDD', '#B76BEB', '#C77DFF'], rgb: '157,78,221' },
  A:    { c: ['#F5A524', '#FFBD52', '#FFD27A'], rgb: '245,165,36' },
  S:    { c: ['#FF3D71', '#FF5C89', '#FF7396'], rgb: '255,61,113' },
};

/** Colors cycled during the charge so the final rarity stays hidden until burst. */
const SCRAMBLE_TIERS: Tier[] = ['E', 'D', 'C', 'B', 'A', 'S', 'aura'];

function tierPalette(tier: Tier) {
  return TIERS[tier] ?? TIERS.aura;
}

export type RewardRowData = {
  label: string;
  value: string;
  icon?: string;
  /** overrides the tier accent for this row's icon + check */
  color?: string;
  /** When set, renders a LevelBadge (used for XP rarity tiers). */
  badgeLevel?: number;
};

export type RewardRevealProps = {
  visible: boolean;
  onClaim?: () => void;
  tier?: Tier;
  kicker?: string;
  title: string;
  subtitle?: string;
  bannerSource?: ImageSourcePropType;
  /**
   * When set (and no bannerSource), shows a LevelBadge in the banner
   * instead of the letter emblem — ideal for XP rarity reveals.
   */
  emblemLevel?: number;
  rewards?: RewardRowData[];
  claimLabel?: string;
};

// ─── worklet easing helpers ─────────────────────────────────────────────────────
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
/** eased segment: clock c mapped from [a,b] → 0..1 then eased */
function segE(c: number, a: number, b: number, ease: (p: number) => number) {
  'worklet';
  const p = Math.min(1, Math.max(0, (c - a) / (b - a)));
  return ease(p);
}

function hexPoints(size: number, inset = 0): string {
  const s = size - inset * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = s / 2;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

/** Geometric rune crystal for the sealed sigil core. */
function SigilRune({ accent, glow }: { accent: string; glow: string }) {
  const gradId = `sigil-${useId().replace(/:/g, '')}`;
  const s = CORE_SIZE;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={glow} stopOpacity={1} />
          <Stop offset="0.55" stopColor={accent} stopOpacity={1} />
          <Stop offset="1" stopColor="#0B1120" stopOpacity={0.9} />
        </SvgGradient>
      </Defs>

      {/* Outer hex crystal */}
      <Polygon
        points={hexPoints(s, 1)}
        fill={`url(#${gradId})`}
        stroke={glow}
        strokeWidth={1.5}
        strokeOpacity={0.95}
      />
      <Polygon
        points={hexPoints(s, 7)}
        fill="rgba(5,7,15,0.35)"
        stroke={glow}
        strokeWidth={1}
        strokeOpacity={0.55}
      />

      {/* Inner diamond */}
      <Polygon
        points={`${s / 2},${s * 0.28} ${s * 0.72},${s / 2} ${s / 2},${s * 0.72} ${s * 0.28},${s / 2}`}
        fill="rgba(255,255,255,0.14)"
        stroke="#FFFFFF"
        strokeWidth={1.25}
        strokeOpacity={0.9}
      />

      {/* Rune cross + eye */}
      <Line x1={s / 2} y1={s * 0.34} x2={s / 2} y2={s * 0.66} stroke="#FFFFFF" strokeWidth={1.4} strokeOpacity={0.85} />
      <Line x1={s * 0.34} y1={s / 2} x2={s * 0.66} y2={s / 2} stroke="#FFFFFF" strokeWidth={1.4} strokeOpacity={0.85} />
      <Circle cx={s / 2} cy={s / 2} r={3.2} fill="#FFFFFF" opacity={0.95} />
      <Circle cx={s / 2} cy={s / 2} r={6.5} fill="none" stroke={glow} strokeWidth={1} strokeOpacity={0.7} />
    </Svg>
  );
}

// ─── Converge particle (pulled INTO the sigil) ──────────────────────────────────
function ConvergeDot({ clock, i, colors }: { clock: SharedValue<number>; i: number; colors: string[] }) {
  const N = 16;
  const ang = (i / N) * Math.PI * 2 + i * 0.7;
  const startR = 120 + (i % 4) * 26;
  // Stagger particles across the charge window so they keep arriving as it builds.
  const s = TL.charge[0] + (i % 7) * ((TL.burst - TL.charge[0]) * 0.11);
  const sz = 3 + (i % 3);
  const col = colors[i % colors.length];
  const style = useAnimatedStyle(() => {
    const c = clock.value;
    const p = segE(c, s, TL.burst, inCubic);
    const r = (1 - p) * startR;
    const op = c > TL.burst ? 0 : Math.sin(Math.min(1, (c - s) / (TL.burst - s)) * Math.PI) * 0.9;
    return {
      opacity: c < s ? 0 : op,
      transform: [{ translateX: Math.cos(ang) * r }, { translateY: Math.sin(ang) * r }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: ORB / 2 - sz / 2,
          top: ORB / 2 - sz / 2,
          width: sz,
          height: sz,
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

// ─── Burst shard (flies out at the flash) ───────────────────────────────────────
function Shard({ clock, i, accent }: { clock: SharedValue<number>; i: number; accent: string }) {
  const N = 12;
  const ang = (i / N) * Math.PI * 2 + 0.3;
  const sz = 5 + (i % 3) * 3;
  const col = i % 2 === 0 ? accent : '#ffffff';
  const style = useAnimatedStyle(() => {
    const p = segE(clock.value, TL.burst, TL.burst + 0.7, outCubic);
    const dist = 60 + (i % 4) * 40 + p * (150 + (i % 3) * 60);
    return {
      opacity: p <= 0 ? 0 : (1 - p) * 0.95,
      transform: [
        { translateX: Math.cos(ang) * dist },
        { translateY: Math.sin(ang) * dist },
        { rotate: `${ang * 57 + p * 180}deg` },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: ORB / 2 - sz / 2,
          top: ORB / 2 - sz / 2,
          width: sz,
          height: sz,
          borderRadius: 1,
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

// ─── Reward row (cascades in after reveal) ──────────────────────────────────────
function RewardRow({ clock, row, index, accent }: { clock: SharedValue<number>; row: RewardRowData; index: number; accent: string }) {
  const s = TL.rowsStart + index * TL.rowStep;
  const color = row.color ?? accent;
  const hasBadge = typeof row.badgeLevel === 'number' && row.badgeLevel > 0;
  const rowStyle = useAnimatedStyle(() => ({
    opacity: segE(clock.value, s, s + 0.34, outCubic),
    transform: [{ translateX: (1 - segE(clock.value, s, s + 0.44, outBack)) * 22 }],
  }));
  const checkStyle = useAnimatedStyle(() => {
    const p = segE(clock.value, s + 0.14, s + 0.5, outCubic);
    return { opacity: p, transform: [{ scale: 0.6 + p * 0.4 }] };
  });
  return (
    <Animated.View style={[styles.row, rowStyle]}>
      {hasBadge ? (
        <View style={styles.rowBadge}>
          <LevelBadge level={row.badgeLevel!} size={34} centerLabel="XP" />
        </View>
      ) : (
        <View style={[styles.rowIcon, { backgroundColor: `${color}1f`, borderColor: `${color}55`, shadowColor: color }]}>
          <Text style={{ color, fontSize: 15 }}>{row.icon ?? '◆'}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <Text style={styles.rowValue}>{row.value}</Text>
      </View>
      <Animated.Text style={[styles.rowCheck, { color, textShadowColor: color }, checkStyle]}>✓</Animated.Text>
    </Animated.View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────────
export function RewardReveal({
  visible,
  onClaim,
  tier = 'aura',
  kicker = 'NEW REWARD UNLOCKED',
  title,
  subtitle,
  bannerSource,
  emblemLevel,
  rewards = [],
  claimLabel = 'CLAIM REWARD',
}: RewardRevealProps) {
  const { width: windowWidth } = useWindowDimensions();
  const panelW = Math.min(windowWidth - 48, 340);
  const [stage, setStage] = useState({ width: windowWidth, height: 0 });
  /** Charge-phase palette — scrambles until burst, then locks to `tier`. */
  const [chargeTier, setChargeTier] = useState<Tier>('aura');

  const final = tierPalette(tier);
  const [A0, A1, A2] = final.c;
  const rgb = final.rgb;

  const charge = tierPalette(chargeTier);
  const [C0, C1, C2] = charge.c;
  const chargeRgb = charge.rgb;
  const partColors = [C2, A2, C0, '#FFBD52', C1];

  const clock = useSharedValue(0);    // master timeline, in seconds
  const pulse = useSharedValue(0);    // CTA idle pulse after reveal

  function handleRootLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setStage((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }

  useEffect(() => {
    if (visible) {
      clock.value = 0;
      clock.value = withTiming(TL.END, { duration: TL.END * 1000, easing: Easing.linear });
      pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
      const clearHaptics = scheduleRewardRevealHaptics(rewards.length);
      return () => {
        clearHaptics();
        cancelAnimation(clock);
        cancelAnimation(pulse);
      };
    }

    cancelAnimation(clock);
    cancelAnimation(pulse);
    clock.value = 0;
    pulse.value = 0;
  }, [visible, rewards.length]);

  // Scramble rarity colors through the charge; reveal the real tier at the burst.
  useEffect(() => {
    if (!visible) {
      setChargeTier('aura');
      return;
    }

    setChargeTier('aura');
    const start = Date.now();
    const scrambleStartMs = TL.charge[0] * 1000;
    const burstMs = TL.burst * 1000;
    const scrambleDur = Math.max(1, burstMs - scrambleStartMs);
    let lastSwitch = scrambleStartMs;
    let idx = Math.floor(Math.random() * SCRAMBLE_TIERS.length);
    let raf = 0;
    let locked = false;
    let started = false;

    function tick() {
      const elapsed = Date.now() - start;
      if (elapsed >= burstMs) {
        if (!locked) {
          locked = true;
          setChargeTier(tier);
        }
        return;
      }

      // Hold the neutral aura until charge begins, then ease into a frenzy.
      if (elapsed < scrambleStartMs) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // Ease-in cubic: long holds early → rapid flashes into the burst.
      const p = Math.min(1, Math.max(0, (elapsed - scrambleStartMs) / scrambleDur));
      const ease = p * p * p;
      const stepMs = SCRAMBLE.startMs + (SCRAMBLE.endMs - SCRAMBLE.startMs) * ease;

      if (!started || elapsed - lastSwitch >= stepMs) {
        started = true;
        lastSwitch = elapsed;
        idx = (idx + 1) % SCRAMBLE_TIERS.length;
        // Skip landing on the final tier mid-scramble so it feels earned at burst.
        let next = SCRAMBLE_TIERS[idx];
        if (next === tier) {
          idx = (idx + 1) % SCRAMBLE_TIERS.length;
          next = SCRAMBLE_TIERS[idx];
        }
        setChargeTier(next);
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, tier]);

  function handleClaim() {
    claimPressHaptic();
    onClaim?.();
  }

  // ── Sigil orb (entrance → charge → burst) ─────────────────────────────────
  const orbStyle = useAnimatedStyle(() => {
    const cc = clock.value;
    const inSc = segE(cc, TL.orbIn[0], TL.orbIn[1], outBack);
    const inOp = segE(cc, TL.orbIn[0], TL.orbIn[0] + 0.45, outCubic);
    const charge = segE(cc, TL.charge[0], TL.charge[1], inCubic);
    // Slow continuous wobble — swells through charge, then settles to dead center
    // just before the burst so the reveal fires from a clean lock.
    const early = segE(cc, TL.orbIn[0] + 0.2, TL.charge[0], outCubic);
    const settle = 1 - segE(cc, TL.burst - 0.35, TL.burst - 0.02, inCubic);
    const shake = (early * 1.4 + charge * charge * 11) * settle;
    const preSc = 1 + charge * 0.14;
    const past = cc >= TL.burst;
    const burstSc = 1 + segE(cc, TL.burst, TL.burst + 0.18, outCubic) * 1.9;
    const burstOp = 1 - segE(cc, TL.burst - 0.04, TL.burst + 0.12, outCubic);
    return {
      opacity: past ? Math.max(0, burstOp) : inOp,
      transform: [
        { translateX: Math.sin(cc * 9) * shake },
        { translateY: Math.cos(cc * 11) * shake },
        { scale: inSc * (past ? burstSc : preSc) },
      ],
    };
  });
  const spinOuter = useAnimatedStyle(() => {
    const charge = segE(clock.value, TL.charge[0], TL.charge[1], inCubic);
    const extra = charge * charge * 980;
    return { transform: [{ rotate: `${clock.value * 55 + extra}deg` }] };
  });
  const spinInner = useAnimatedStyle(() => {
    const charge = segE(clock.value, TL.charge[0], TL.charge[1], inCubic);
    const extra = charge * charge * 980;
    return { transform: [{ rotate: `${-(clock.value * 55 + extra) * 1.55}deg` }] };
  });
  const coreGlow = useAnimatedStyle(() => {
    const charge = segE(clock.value, TL.charge[0], TL.charge[1], inCubic);
    return {
      shadowRadius: 16 + charge * charge * 48,
      shadowOpacity: 0.45 + charge * 0.55,
    };
  });

  // ── Shockwave ──────────────────────────────────────────────────────────────
  const shockStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (clock.value - TL.burst) / 0.55));
    return {
      opacity: p <= 0 || p >= 1 ? 0 : 1 - p,
      transform: [{ scale: 0.2 + outCubic(p) * 3.2 }],
    };
  });

  // ── Flash ────────────────────────────────────────────────────────────────────
  const flashStyle = useAnimatedStyle(() => {
    const up = segE(clock.value, TL.flashUp[0], TL.flashUp[1], outCubic);
    const dn = segE(clock.value, TL.flashDn[0], TL.flashDn[1], outCubic);
    return { opacity: Math.max(0, Math.min(1, up - dn)) };
  });

  // ── Backdrop ───────────────────────────────────────────────────────────────
  const bgStyle = useAnimatedStyle(() => ({ opacity: segE(clock.value, TL.bgIn[0], TL.bgIn[1], outCubic) * 0.94 }));

  // ── Reveal panel ─────────────────────────────────────────────────────────────
  const panelStyle = useAnimatedStyle(() => {
    const r = segE(clock.value, TL.reveal[0], TL.reveal[1], outCubic);
    const g = 0.4 + segE(clock.value, TL.glow[0], TL.glow[1], outCubic) * 0.6;
    return {
      opacity: Math.min(1, r * 2.2),
      transform: [{ scale: 0.74 + r * 0.26 }],
      borderColor: `rgba(${rgb},${0.3 + g * 0.45})`,
      shadowColor: `rgb(${rgb})`,
      shadowRadius: 44 * g,
      shadowOpacity: g * 0.5,
    };
  });
  const bannerStyle = useAnimatedStyle(() => {
    const p = segE(clock.value, TL.banner[0], TL.banner[1], outCubic);
    return { opacity: p, transform: [{ scale: 1.1 - p * 0.1 }] };
  });
  const sweepStyle = useAnimatedStyle(() => {
    const p = interpolate(clock.value, [TL.banner[0] + 0.3, TL.banner[1] + 0.45], [-1.2, 1.6], Extrapolation.CLAMP);
    return { transform: [{ translateX: p * panelW }, { skewX: '-18deg' }] };
  });
  const headStyle = useAnimatedStyle(() => {
    const p = segE(clock.value, TL.head[0], TL.head[1], outCubic);
    return { opacity: p, transform: [{ translateY: (1 - p) * 12 }] };
  });
  const btnStyle = useAnimatedStyle(() => {
    const p = segE(clock.value, TL.claim[0], TL.claim[1], outCubic);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 14 }],
      shadowColor: `rgb(${rgb})`,
      shadowRadius: 18 + pulse.value * 20,
      shadowOpacity: 0.3 + pulse.value * 0.35,
    };
  });

  if (!visible) return null;

  const stageH = stage.height || 1;
  const anchorY = stageH * 0.43;

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * 360;
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          width: ORB,
          height: ORB,
          transform: [{ rotate: `${a}deg` }],
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: ORB / 2 - 0.75,
            top: 0,
            width: 1.5,
            height: 7,
            borderRadius: 1,
            backgroundColor: `rgba(${chargeRgb},0.5)`,
          }}
        />
      </View>
    );
  });

  return (
    <View style={styles.root} pointerEvents="box-none" onLayout={handleRootLayout}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, bgStyle]} />

      {/* ── Opening entity: charge, shockwave, shards ── */}
      <View style={styles.centerLayer} pointerEvents="none">
        <View style={[styles.sigilStage, { marginTop: anchorY - stageH / 2 }]}>
          {/* Converge particles */}
          {Array.from({ length: 16 }, (_, i) => (
            <ConvergeDot key={`c${i}`} clock={clock} i={i} colors={partColors} />
          ))}

          {/* Shockwave — final rarity color at the burst */}
          <Animated.View
            style={[
              styles.shock,
              { borderColor: `rgb(${rgb})`, shadowColor: `rgb(${rgb})` },
              shockStyle,
            ]}
          />

          {/* Sigil orb — scrambled colors until burst */}
          <Animated.View style={[styles.orb, orbStyle]}>
            <View style={[styles.orbAura, { backgroundColor: `rgba(${chargeRgb},0.28)` }]} />
            <Animated.View style={[styles.ring, { borderColor: `rgba(${chargeRgb},0.6)` }, spinOuter]}>
              {ticks}
            </Animated.View>
            <Animated.View style={[styles.ringInner, { borderColor: `rgba(${chargeRgb},0.7)` }, spinInner]} />
            <Animated.View style={[styles.core, { shadowColor: `rgb(${chargeRgb})` }, coreGlow]}>
              <SigilRune accent={C0} glow={C2} />
            </Animated.View>
          </Animated.View>

          {/* Shards — lock to final rarity as the reward pops */}
          {Array.from({ length: 12 }, (_, i) => (
            <Shard key={`s${i}`} clock={clock} i={i} accent={A2} />
          ))}
        </View>
      </View>

      {/* ── The reward, revealed from the flash ── */}
      <Animated.View style={[styles.panel, { width: panelW, top: anchorY - 210 }, panelStyle]}>
        <View style={[styles.topEdge, { backgroundColor: A1, shadowColor: A1 }]} />

        <View style={[styles.header, { borderBottomColor: `rgba(${rgb},0.16)`, backgroundColor: `rgba(${rgb},0.08)` }]}>
          <Text style={[styles.headerLeft, { color: A2 }]}>◈ SYSTEM</Text>
          <View style={styles.headerRight}>
            <View style={[styles.dot, { backgroundColor: A0, shadowColor: A0 }]} />
            <Text style={[styles.headerTag, { color: A0 }]}>REWARD</Text>
          </View>
        </View>

        {/* Banner */}
        <Animated.View style={[styles.banner, { borderColor: `rgba(${rgb},0.28)` }, bannerStyle]}>
          {bannerSource ? (
            <Image source={bannerSource} style={styles.bannerImg} resizeMode="cover" />
          ) : (
            <View style={[styles.bannerFallback, { backgroundColor: `rgba(${rgb},0.14)` }]}>
              {typeof emblemLevel === 'number' && emblemLevel > 0 ? (
                <LevelBadge level={emblemLevel} size={72} centerLabel="XP" />
              ) : (
                <View style={[styles.emblem, { backgroundColor: A1, shadowColor: `rgb(${rgb})` }]}>
                  <Text style={styles.emblemLetter}>{(title || 'R').trim().charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          )}
          <Animated.View style={[styles.sweep, sweepStyle]} pointerEvents="none" />
        </Animated.View>

        {/* Text + rewards */}
        <View style={styles.body}>
          <Animated.View style={headStyle}>
            <Text style={[styles.kicker, { color: A2 }]}>{kicker}</Text>
            <Text style={[styles.title, { textShadowColor: `rgba(${rgb},0.4)` }]}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </Animated.View>

          {rewards.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: `rgba(${rgb},0.22)` }]} />
              <View style={{ gap: 8 }}>
                {rewards.map((r, i) => (
                  <RewardRow key={i} clock={clock} row={r} index={i} accent={A2} />
                ))}
              </View>
            </>
          )}

          <Animated.View style={btnStyle}>
            <Pressable onPress={handleClaim} style={[styles.claim, { backgroundColor: A0 }]}>
              <View style={[StyleSheet.absoluteFill, styles.claimGrad, { backgroundColor: A1, opacity: 0.55 }]} />
              <Text style={styles.claimText}>{claimLabel}</Text>
              <Text style={styles.claimArrow}>→</Text>
            </Pressable>
          </Animated.View>
        </View>

        {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
          <View key={k} style={[styles.bracket, styles[`bracket_${k}`], { borderColor: `rgba(${rgb},0.4)` }]} />
        ))}
      </Animated.View>

      {/* ── The flash (above everything) ── */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const MONO = 'JetBrainsMono_500Medium';
const DISP = 'ChakraPetch_700Bold';
const BODY = 'HankenGrotesk_500Medium';

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { backgroundColor: '#05070F' },

  centerLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilStage: {
    width: ORB,
    height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shock: {
    position: 'absolute',
    width: 200,
    height: 200,
    left: ORB / 2 - 100,
    top: ORB / 2 - 100,
    borderRadius: 100,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
  },

  orb: {
    width: ORB,
    height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbAura: {
    position: 'absolute',
    left: -30,
    top: -30,
    width: ORB + 60,
    height: ORB + 60,
    borderRadius: (ORB + 60) / 2,
  },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 1.5,
  },
  ringInner: {
    position: 'absolute',
    left: (ORB - INNER_RING) / 2,
    top: (ORB - INNER_RING) / 2,
    width: INNER_RING,
    height: INNER_RING,
    borderRadius: INNER_RING / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  core: {
    width: CORE_SIZE,
    height: CORE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
  },

  panel: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 20,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 20 },
    // Prevent a one-frame Reanimated flash before the clock drives opacity.
    opacity: 0,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 12 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
  headerLeft: { fontFamily: MONO, fontSize: 10, letterSpacing: 2.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4 },
  headerTag: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.5 },

  banner: { marginHorizontal: 14, marginTop: 14, height: 132, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  bannerImg: { width: '100%', height: '100%' },
  bannerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emblem: { width: 68, height: 76, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 26 },
  emblemLetter: { fontFamily: DISP, fontSize: 30, color: '#fff' },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '55%', backgroundColor: 'rgba(255,255,255,0.18)' },

  body: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  kicker: { fontFamily: MONO, fontSize: 10, letterSpacing: 2.5, marginBottom: 7 },
  title: { fontFamily: DISP, fontSize: 25, lineHeight: 30, color: '#E8EDF7', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  subtitle: { fontFamily: BODY, fontSize: 13, lineHeight: 19, color: '#AEB8D0', marginTop: 8 },

  divider: { height: 1, marginVertical: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: 12, backgroundColor: 'rgba(19,28,48,0.6)', borderWidth: 1, borderColor: 'rgba(125,165,255,0.12)' },
  rowIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 },
  rowBadge: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.6, color: '#7D8AA8' },
  rowValue: { fontFamily: DISP, fontSize: 15, color: '#E8EDF7', marginTop: 2 },
  rowCheck: { fontSize: 13, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },

  claim: { marginTop: 18, height: 50, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, overflow: 'hidden', shadowOffset: { width: 0, height: 8 } },
  claimGrad: { alignItems: 'flex-end' },
  claimText: { fontFamily: DISP, fontSize: 15, letterSpacing: 1.5, color: '#fff' },
  claimArrow: { fontSize: 15, color: '#fff' },

  bracket: { position: 'absolute', width: 15, height: 15 },
  bracket_tl: { top: 8, left: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  bracket_tr: { top: 8, right: 8, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  bracket_bl: { bottom: 8, left: 8, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  bracket_br: { bottom: 8, right: 8, borderBottomWidth: 1.5, borderRightWidth: 1.5 },

  flash: { backgroundColor: '#ffffff', zIndex: 20 },
});

export default RewardReveal;
