/**
 * RewardReveal.tsx
 * React Native Reanimated 3 — GainGang "Reward Reveal"
 *
 * You OPEN a sealed rune-sigil (the entity): it charges up, runes spin faster,
 * charge particles are pulled in, cracks of light appear — then it BURSTS in a
 * white flash, and the reward is revealed emerging from the flash.
 *
 *   charge (sigil orb) → flash → reveal (banner + title + reward rows + claim)
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

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
  ImageSourcePropType,
} from 'react-native';
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

const { width: SW, height: SH } = Dimensions.get('window');
const PANEL_W = Math.min(SW - 48, 340);
const CY = SH * 0.43;        // vertical anchor of the reveal
const ORB = 118;

// ─── Timeline (seconds) ────────────────────────────────────────────────────────
const TL = {
  bgIn:      [0, 0.5],
  orbIn:     [0.2, 0.85],
  charge:    [0.85, 1.92],   // sigil spins up / pulls in / cracks
  burst:     1.92,           // <<< the flash
  flashUp:   [1.84, 1.94],
  flashDn:   [1.97, 2.47],
  reveal:    [1.94, 2.56],   // reward emerges from flash
  glow:      [2.02, 2.62],
  banner:    [2.22, 2.82],
  head:      [2.42, 2.97],   // kicker + title + subtitle
  rowsStart: 2.82,           // + i * 0.16
  rowStep:   0.16,
  claim:     [3.85, 4.25],
  END:       4.6,
};

// ─── Tier palettes ────────────────────────────────────────────────────────────
type Tier = 'aura' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
const TIERS: Record<Tier, { c: [string, string, string]; rgb: string }> = {
  aura: { c: ['#4D8CFF', '#9D4EDD', '#8FB4FF'], rgb: '77,140,255' },
  E:    { c: ['#64748B', '#94A3B8', '#B4BECE'], rgb: '100,116,139' },
  D:    { c: ['#2DD4BF', '#5EEAD4', '#99F6E4'], rgb: '45,212,191' },
  C:    { c: ['#4D8CFF', '#6FA1FF', '#8FB4FF'], rgb: '77,140,255' },
  B:    { c: ['#9D4EDD', '#B76BEB', '#C77DFF'], rgb: '157,78,221' },
  A:    { c: ['#F5A524', '#FFBD52', '#FFD27A'], rgb: '245,165,36' },
  S:    { c: ['#FF3D71', '#FF5C89', '#FF7396'], rgb: '255,61,113' },
};

export type RewardRowData = {
  label: string;
  value: string;
  icon?: string;
  /** overrides the tier accent for this row's icon + check */
  color?: string;
};

export type RewardRevealProps = {
  visible: boolean;
  onClaim?: () => void;
  tier?: Tier;
  kicker?: string;
  title: string;
  subtitle?: string;
  bannerSource?: ImageSourcePropType;
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

// ─── Converge particle (pulled INTO the sigil) ──────────────────────────────────
function ConvergeDot({ clock, i, colors }: { clock: SharedValue<number>; i: number; colors: string[] }) {
  const N = 16;
  const ang = (i / N) * Math.PI * 2 + i * 0.7;
  const startR = 120 + (i % 4) * 26;
  const s = 0.85 + (i % 5) * 0.09;
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
        { position: 'absolute', width: sz, height: sz, borderRadius: sz, backgroundColor: col, shadowColor: col, shadowRadius: sz + 4, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 } },
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
        { position: 'absolute', width: sz, height: sz, borderRadius: 1, backgroundColor: col, shadowColor: col, shadowRadius: sz + 4, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}
    />
  );
}

// ─── Reward row (cascades in after reveal) ──────────────────────────────────────
function RewardRow({ clock, row, index, accent }: { clock: SharedValue<number>; row: RewardRowData; index: number; accent: string }) {
  const s = TL.rowsStart + index * TL.rowStep;
  const color = row.color ?? accent;
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
      <View style={[styles.rowIcon, { backgroundColor: `${color}1f`, borderColor: `${color}55`, shadowColor: color }]}>
        <Text style={{ color, fontSize: 15 }}>{row.icon ?? '◆'}</Text>
      </View>
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
  rewards = [],
  claimLabel = 'CLAIM REWARD',
}: RewardRevealProps) {
  const { c, rgb } = TIERS[tier] ?? TIERS.aura;
  const [A0, A1, A2] = c;
  const partColors = [A2, '#FFBD52', A0];

  const clock = useSharedValue(0);    // master timeline, in seconds
  const pulse = useSharedValue(0);    // CTA idle pulse after reveal

  useEffect(() => {
    if (visible) {
      clock.value = 0;
      clock.value = withTiming(TL.END, { duration: TL.END * 1000, easing: Easing.linear });
      pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sine) }), -1, true);
    } else {
      cancelAnimation(clock);
      cancelAnimation(pulse);
      clock.value = 0;
      pulse.value = 0;
    }
  }, [visible]);

  // ── Sigil orb (entrance → charge → burst) ─────────────────────────────────
  const orbStyle = useAnimatedStyle(() => {
    const cc = clock.value;
    const inSc = segE(cc, TL.orbIn[0], TL.orbIn[1], outBack);
    const inOp = segE(cc, TL.orbIn[0], TL.orbIn[0] + 0.4, outCubic);
    const charge = segE(cc, TL.charge[0], TL.charge[1], inCubic);
    const shake = charge * charge * 5;
    const preSc = 1 + charge * 0.16 + Math.sin(cc * 10) * 0.02 * charge;
    const past = cc >= TL.burst;
    const burstSc = 1 + segE(cc, TL.burst, TL.burst + 0.18, outCubic) * 1.9;
    const burstOp = 1 - segE(cc, TL.burst - 0.04, TL.burst + 0.12, outCubic);
    return {
      opacity: past ? Math.max(0, burstOp) : inOp,
      transform: [
        { translateX: Math.sin(cc * 62) * shake },
        { translateY: Math.cos(cc * 71) * shake },
        { scale: inSc * (past ? burstSc : preSc) },
      ],
    };
  });
  const spinOuter = useAnimatedStyle(() => {
    const extra = segE(clock.value, TL.charge[0], TL.charge[1], inCubic) * 620;
    return { transform: [{ rotate: `${clock.value * 70 + extra}deg` }] };
  });
  const spinInner = useAnimatedStyle(() => {
    const extra = segE(clock.value, TL.charge[0], TL.charge[1], inCubic) * 620;
    return { transform: [{ rotate: `${-(clock.value * 70 + extra) * 1.5}deg` }] };
  });
  const coreGlow = useAnimatedStyle(() => {
    const charge = segE(clock.value, TL.charge[0], TL.charge[1], inCubic);
    return { shadowRadius: 18 + charge * 34, shadowOpacity: 0.6 + charge * 0.4 };
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
    return { transform: [{ translateX: p * PANEL_W }, { skewX: '-18deg' }] };
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

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * 360;
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: ORB / 2 - 0.75,
          top: 0,
          width: 1.5,
          height: 7,
          borderRadius: 1,
          backgroundColor: `rgba(${rgb},0.5)`,
          transform: [{ rotate: `${a}deg` }],
          transformOrigin: `0.75px ${ORB / 2}px`,
        }}
      />
    );
  });

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, bgStyle]} />

      {/* ── Opening entity: charge, shockwave, shards ── */}
      <View style={styles.centerLayer} pointerEvents="none">
        {/* Converge particles */}
        {Array.from({ length: 16 }, (_, i) => (
          <ConvergeDot key={`c${i}`} clock={clock} i={i} colors={partColors} />
        ))}

        {/* Shockwave */}
        <Animated.View style={[styles.shock, { borderColor: `rgb(${rgb})`, shadowColor: `rgb(${rgb})` }, shockStyle]} />

        {/* Sigil orb */}
        <Animated.View style={[styles.orb, orbStyle]}>
          {/* aura */}
          <View style={[styles.orbAura, { backgroundColor: `rgba(${rgb},0.28)` }]} />
          {/* outer rune ring */}
          <Animated.View style={[styles.ring, { borderColor: `rgba(${rgb},0.6)` }, spinOuter]}>
            {ticks}
          </Animated.View>
          {/* inner dashed ring */}
          <Animated.View style={[styles.ringInner, { borderColor: `rgba(${rgb},0.7)` }, spinInner]} />
          {/* hexagon core */}
          <Animated.View style={[styles.core, { backgroundColor: A0, shadowColor: `rgb(${rgb})` }, coreGlow]}>
            <Text style={styles.coreGlyph}>⚔</Text>
          </Animated.View>
        </Animated.View>

        {/* Shards */}
        {Array.from({ length: 12 }, (_, i) => (
          <Shard key={`s${i}`} clock={clock} i={i} accent={A2} />
        ))}
      </View>

      {/* ── The reward, revealed from the flash ── */}
      <Animated.View style={[styles.panel, panelStyle]}>
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
              <View style={[styles.emblem, { backgroundColor: A1, shadowColor: `rgb(${rgb})` }]}>
                <Text style={styles.emblemLetter}>{(title || 'R').trim().charAt(0).toUpperCase()}</Text>
              </View>
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
            <Pressable onPress={onClaim} style={[styles.claim, { backgroundColor: A0 }]}>
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
  root: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  backdrop: { backgroundColor: '#05070F' },

  centerLayer: { position: 'absolute', top: CY, left: SW / 2, width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },

  shock: {
    position: 'absolute',
    width: 200, height: 200, marginLeft: -100, marginTop: -100,
    borderRadius: 100, borderWidth: 2,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 26,
  },

  orb: { position: 'absolute', width: ORB, height: ORB, marginLeft: -ORB / 2, marginTop: -ORB / 2, alignItems: 'center', justifyContent: 'center' },
  orbAura: { position: 'absolute', width: ORB + 60, height: ORB + 60, borderRadius: (ORB + 60) / 2 },
  ring: { position: 'absolute', width: ORB, height: ORB, borderRadius: ORB / 2, borderWidth: 1.5 },
  ringInner: { position: 'absolute', width: ORB - 40, height: ORB - 40, borderRadius: (ORB - 40) / 2, borderWidth: 1.5, borderStyle: 'dashed' },
  core: {
    width: 52, height: 58, alignItems: 'center', justifyContent: 'center',
    // hexagon look: RN can't clip to a polygon without a mask lib; a rotated
    // rounded square reads as a sigil crystal. Swap for react-native-svg <Polygon>
    // or a masked <Image> for a true hexagon.
    borderRadius: 14, transform: [{ rotate: '0deg' }],
    shadowOffset: { width: 0, height: 0 },
  },
  coreGlyph: { fontFamily: DISP, fontSize: 24, color: '#fff', opacity: 0.92 },

  panel: {
    position: 'absolute',
    top: CY - 210,                 // roughly centres the ~420px panel on CY
    width: PANEL_W,
    borderRadius: 20,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 20 },
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
