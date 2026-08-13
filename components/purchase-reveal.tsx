/**
 * PurchaseReveal — transactional Armory buy overlay.
 *
 * Feels like a completed payment, not a loot open:
 *   receipt card in → item line → ledger debit (−Creds) → PAID seal → continue
 */

import { Ionicons } from '@expo/vector-icons';
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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CredPlate } from '@/components/ui/cred-plate';
import { useCelebrationGate } from '@/hooks/use-celebration-gate';
import { gradientColors, parseBannerStyle, parseBorderStyle } from '@/lib/cosmetics';
import { fontFamily, ranks, type RankTier } from '@/lib/gaingang-theme';
import { CREDS_DEEP, CREDS_GOLD, CREDS_INK, shopRarityNameUpper } from '@/lib/shop';
import type { CosmeticItem } from '@/types';

const SCREEN = Dimensions.get('window');
const CARD_W = Math.min(SCREEN.width - 40, 330);

const T = {
  bgDur: 280,
  cardDelay: 60,
  cardDur: 420,
  itemDelay: 280,
  costDelay: 520,
  debitDelay: 720,
  paidDelay: 980,
  remainingDelay: 1180,
  ctaDelay: 1420,
} as const;

function schedulePurchaseHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  function at(ms: number, fn: () => void) {
    timeouts.push(setTimeout(fn, ms));
  }

  at(T.cardDelay + 40, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });
  at(T.costDelay, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });
  at(T.debitDelay, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
  at(T.paidDelay, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });

  return () => timeouts.forEach(clearTimeout);
}

export interface PurchaseRevealProps {
  visible: boolean;
  name: string;
  rarity: RankTier;
  kindLabel: string;
  priceCreds: number;
  /** Wallet balance before the debit — enables the full ledger. */
  balanceBefore?: number;
  cosmetic?: CosmeticItem | null;
  onDismiss: () => void;
}

/** Full-screen Armory purchase receipt — cosmetics only (crates keep RewardReveal). */
export function PurchaseReveal({
  visible,
  name,
  rarity,
  kindLabel,
  priceCreds,
  balanceBefore,
  cosmetic,
  onDismiss,
}: PurchaseRevealProps) {
  useCelebrationGate(visible);

  const bg = useSharedValue(0);
  const card = useSharedValue(0);
  const itemIn = useSharedValue(0);
  const costIn = useSharedValue(0);
  const debitPulse = useSharedValue(0);
  const paid = useSharedValue(0);
  const remainingIn = useSharedValue(0);
  const cta = useSharedValue(0);
  const coinFly = useSharedValue(0);

  const rank = ranks[rarity];
  const gold = CREDS_GOLD.dark;
  const hasLedger = typeof balanceBefore === 'number';
  const remaining =
    hasLedger ? Math.max(0, balanceBefore - priceCreds) : null;

  useEffect(() => {
    if (!visible) {
      bg.value = 0;
      card.value = 0;
      itemIn.value = 0;
      costIn.value = 0;
      debitPulse.value = 0;
      paid.value = 0;
      remainingIn.value = 0;
      cta.value = 0;
      coinFly.value = 0;
      return;
    }

    const clearHaptics = schedulePurchaseHaptics();
    const ease = Easing.out(Easing.cubic);

    bg.value = withTiming(1, { duration: T.bgDur, easing: ease });
    card.value = withDelay(
      T.cardDelay,
      withSpring(1, { damping: 16, stiffness: 170, mass: 0.85 }),
    );
    itemIn.value = withDelay(
      T.itemDelay,
      withTiming(1, { duration: 360, easing: ease }),
    );
    costIn.value = withDelay(
      T.costDelay,
      withTiming(1, { duration: 320, easing: ease }),
    );
    debitPulse.value = withDelay(
      T.debitDelay,
      withSequence(
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 280, easing: ease }),
      ),
    );
    coinFly.value = withDelay(
      T.debitDelay,
      withSequence(
        withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) }),
        withTiming(0, { duration: 1 }),
      ),
    );
    paid.value = withDelay(
      T.paidDelay,
      withSpring(1, { damping: 11, stiffness: 200 }),
    );
    remainingIn.value = withDelay(
      T.remainingDelay,
      withTiming(1, { duration: 340, easing: ease }),
    );
    cta.value = withDelay(
      T.ctaDelay,
      withTiming(1, { duration: 320, easing: ease }),
    );

    return clearHaptics;
  }, [
    visible,
    bg,
    card,
    itemIn,
    costIn,
    debitPulse,
    paid,
    remainingIn,
    cta,
    coinFly,
  ]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [
      { translateY: (1 - card.value) * 36 },
      { scale: 0.94 + card.value * 0.06 },
    ],
  }));
  const itemStyle = useAnimatedStyle(() => ({
    opacity: itemIn.value,
    transform: [{ translateX: (1 - itemIn.value) * -14 }],
  }));
  const costStyle = useAnimatedStyle(() => ({
    opacity: costIn.value,
    transform: [{ translateX: (1 - costIn.value) * 14 }],
  }));
  const debitGlowStyle = useAnimatedStyle(() => ({
    opacity: debitPulse.value,
    transform: [{ scale: 1 + debitPulse.value * 0.04 }],
  }));
  const paidStyle = useAnimatedStyle(() => ({
    opacity: paid.value,
    transform: [
      { scale: 1.4 - paid.value * 0.4 },
      { rotate: `${(1 - paid.value) * -12}deg` },
    ],
  }));
  const remainingStyle = useAnimatedStyle(() => ({
    opacity: remainingIn.value,
    transform: [{ translateY: (1 - remainingIn.value) * 10 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: cta.value,
    transform: [{ translateY: (1 - cta.value) * 12 }],
  }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinFly.value > 0.05 && coinFly.value < 0.95 ? 1 : 0,
    transform: [
      { translateY: coinFly.value * 48 },
      { scale: 1 - coinFly.value * 0.35 },
    ],
  }));

  function handleDismiss() {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onDismiss();
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, bgStyle]} />

        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.header}>
            <Text style={styles.headerKicker}>◆ TRANSACTION</Text>
            <View style={styles.headerPaidSlot}>
              <Animated.View style={[styles.paidBadge, paidStyle]}>
                <Ionicons name="checkmark-circle" size={14} color={CREDS_INK} />
                <Text style={styles.paidBadgeText}>PAID</Text>
              </Animated.View>
            </View>
          </View>

          <View style={styles.body}>
            <Animated.View style={[styles.itemRow, itemStyle]}>
              <PurchaseItemHero name={name} rarity={rarity} cosmetic={cosmetic ?? null} />
              <View style={styles.itemCopy}>
                <Text style={styles.itemKind}>
                  {shopRarityNameUpper(rarity)} · {kindLabel}
                </Text>
                <Text style={[styles.itemName, { color: rank.color }]} numberOfLines={2}>
                  {name}
                </Text>
              </View>
            </Animated.View>

            <View style={styles.ledger}>
              {hasLedger ? (
                <Animated.View style={[styles.ledgerRow, itemStyle]}>
                  <Text style={styles.ledgerLabel}>BALANCE</Text>
                  <Text style={styles.ledgerValue}>
                    {balanceBefore!.toLocaleString()}
                  </Text>
                </Animated.View>
              ) : null}

              <Animated.View style={[styles.costBlock, costStyle]}>
                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerLabel}>COST</Text>
                  <View style={styles.costValueRow}>
                    <Animated.View style={[styles.debitGlow, debitGlowStyle]} />
                    <Text style={styles.costValue}>
                      − {priceCreds.toLocaleString()}
                    </Text>
                  </View>
                </View>
                <Animated.View style={[styles.coinFly, coinStyle]} pointerEvents="none">
                  <CredPlate size={22} />
                </Animated.View>
              </Animated.View>

              <View style={styles.divider} />

              <Animated.View style={[styles.ledgerRow, remainingStyle]}>
                <Text style={[styles.ledgerLabel, { color: '#D9A45A' }]}>
                  {hasLedger ? 'REMAINING' : 'SPENT'}
                </Text>
                <View style={styles.remainingRow}>
                  <CredPlate size={15} />
                  <Text style={styles.remainingValue}>
                    {(remaining ?? priceCreds).toLocaleString()}
                  </Text>
                </View>
              </Animated.View>
            </View>

            <Animated.View style={ctaStyle}>
              <Pressable
                onPress={handleDismiss}
                accessibilityRole="button"
                accessibilityLabel="Done"
                style={styles.ctaHit}
              >
                <LinearGradient
                  colors={[gold, CREDS_DEEP]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.cta}
                >
                  <Text style={styles.ctaLabel}>DONE</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PurchaseItemHero({
  name,
  rarity,
  cosmetic,
}: {
  name: string;
  rarity: RankTier;
  cosmetic: CosmeticItem | null;
}) {
  const rank = ranks[rarity];

  if (cosmetic?.kind === 'avatar_border') {
    const border = parseBorderStyle(cosmetic.style);
    const colors = gradientColors(border?.colors ?? [rank.color, rank.glow]);
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.borderRing}
      >
        <View style={styles.borderInner} />
      </LinearGradient>
    );
  }

  if (cosmetic?.kind === 'banner') {
    const colors = gradientColors(
      parseBannerStyle(cosmetic.style)?.colors ?? [rank.color, rank.glow],
    );
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bannerThumb}
      />
    );
  }

  return (
    <View
      style={[
        styles.titleThumb,
        {
          backgroundColor: `${rank.color}22`,
          borderColor: `${rank.color}80`,
        },
      ]}
    >
      <Text style={[styles.titleThumbText, { color: rank.color }]} numberOfLines={1}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,7,15,0.88)',
  },
  card: {
    width: CARD_W,
    borderRadius: 20,
    backgroundColor: '#0E1524',
    borderWidth: 1,
    borderColor: `${CREDS_GOLD.dark}b3`,
    overflow: 'hidden',
    shadowColor: CREDS_GOLD.dark,
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: `${CREDS_GOLD.dark}1a`,
    borderBottomWidth: 1,
    borderBottomColor: `${CREDS_GOLD.dark}33`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerKicker: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: CREDS_GOLD.dark,
  },
  headerPaidSlot: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: CREDS_GOLD.dark,
  },
  paidBadgeText: {
    fontFamily: fontFamily.monoBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: CREDS_INK,
  },
  body: {
    padding: 20,
    gap: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  itemCopy: {
    flex: 1,
    gap: 4,
  },
  itemKind: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: '#7D8AA8',
  },
  itemName: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    letterSpacing: 0.4,
  },
  ledger: {
    borderRadius: 13,
    backgroundColor: '#131C30',
    paddingHorizontal: 15,
    paddingVertical: 14,
    gap: 11,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ledgerLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    color: '#7D8AA8',
  },
  ledgerValue: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: '#E8EDF7',
  },
  costBlock: {
    position: 'relative',
  },
  costValueRow: {
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  debitGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,92,137,0.22)',
    borderRadius: 6,
    marginHorizontal: -6,
    marginVertical: -4,
  },
  costValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: 15,
    color: '#FF5C89',
  },
  coinFly: {
    position: 'absolute',
    right: 8,
    top: -6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(125,165,255,0.14)',
  },
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  remainingValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: 15,
    color: CREDS_GOLD.dark,
  },
  titleThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleThumbText: {
    fontFamily: fontFamily.display,
    fontSize: 22,
  },
  borderRing: {
    width: 52,
    height: 52,
    borderRadius: 999,
    padding: 3,
  },
  borderInner: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#1D2840',
  },
  bannerThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  ctaHit: {
    borderRadius: 13,
    overflow: 'hidden',
  },
  cta: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: fontFamily.display,
    fontSize: 15,
    letterSpacing: 2,
    color: CREDS_INK,
  },
});
