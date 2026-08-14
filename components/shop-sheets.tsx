import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmeticsLeaderboardPreview } from '@/components/cosmetics-leaderboard-preview';
import { CredsPackReveal } from '@/components/creds-pack-reveal';
import { CredPlate } from '@/components/ui/cred-plate';
import {
  useCredsPackPrices,
  useIapConfigured,
  usePresentCustomerCenter,
  usePurchaseCredsPack,
} from '@/hooks/use-iap';
import { useProfile } from '@/hooks/use-profile';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { isPurchaseCancelledError } from '@/lib/iap';
import { auraGradient, fontFamily, ranks, spacing } from '@/lib/gaingang-theme';
import {
  CREDS_DEEP,
  CREDS_GOLD,
  CREDS_INK,
  CREDS_PACKS,
  cosmeticOverrideForItem,
  shopKindLabel,
  shopRarityNameUpper,
  type CredsPackId,
  type ShopListingItem,
} from '@/lib/shop';
import { gradientColors, parseBannerStyle, parseBorderStyle } from '@/lib/cosmetics';
import type { Profile } from '@/types';

const PURCHASE_SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + 0.2;
  return {
    angle,
    dist: 52 + (i % 4) * 16,
    size: 5 + (i % 3) * 2,
    delay: (i % 5) * 28,
    rotate: (i % 2 === 0 ? 1 : -1) * (18 + (i % 4) * 10),
  };
});

function schedulePurchaseSuccessHaptics(): () => void {
  if (Platform.OS === 'web') return () => {};

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  function at(ms: number, fn: () => void) {
    timeouts.push(setTimeout(fn, ms));
  }

  at(30, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });
  at(120, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
  at(220, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
  at(340, () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });
  at(480, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });
  at(560, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });
  at(640, () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });

  return () => timeouts.forEach(clearTimeout);
}

interface ShopItemDetailSheetProps {
  visible: boolean;
  item: ShopListingItem | null;
  profile: Profile | null | undefined;
  balance: number;
  onClose: () => void;
  onBuy: (item: ShopListingItem) => void;
  onTopUp: () => void;
}

export function ShopItemDetailSheet({
  visible,
  item,
  profile,
  balance,
  onClose,
  onBuy,
  onTopUp,
}: ShopItemDetailSheetProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const gold = t.isLight ? CREDS_GOLD.light : CREDS_GOLD.dark;
  const rank = ranks[item.rarity];
  const short = Math.max(0, item.price_creds - balance);
  const canBuy = !item.owned && !item.sold_out;
  const scarcity =
    item.stock_remaining != null && item.stock_remaining > 0
      ? `${item.stock_remaining} LEFT`
      : null;

  const kickerParts = [
    shopRarityNameUpper(item.rarity),
    shopKindLabel(item),
    scarcity,
    item.owned ? 'OWNED' : item.sold_out ? 'SOLD OUT' : null,
  ].filter(Boolean);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{
            ...StyleFill,
            backgroundColor: t.isLight ? 'rgba(15,20,35,0.35)' : 'rgba(5,7,15,0.72)',
          }}
          onPress={onClose}
          accessibilityLabel="Dismiss"
        />
        <View
          style={{
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: t.theme.colors.surface,
            borderTopWidth: 1.5,
            borderTopColor: `${rank.color}8c`,
            paddingHorizontal: spacing.lg,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 20) + 14,
            maxHeight: '88%',
            shadowColor: rank.color,
            shadowOpacity: 0.35,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: -10 },
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: 999,
              alignSelf: 'center',
              backgroundColor: t.buttonBorder,
              marginBottom: 16,
            }}
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
            <View style={{ alignItems: 'center', gap: 10, paddingTop: 4 }}>
              <Text
                style={{
                  fontFamily: fontFamily.mono,
                  fontSize: 9.5,
                  letterSpacing: 2.2,
                  color: rank.color,
                }}
              >
                {kickerParts.join(' · ')}
              </Text>

              <ShopHeroPreview item={item} />
            </View>

            {profile && item.product_kind === 'cosmetic' && item.cosmetic ? (
              <View style={{ gap: 9 }}>
                <Text
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 9.5,
                    letterSpacing: 2,
                    color: t.placeholder,
                  }}
                >
                  LIVE PREVIEW — YOUR LEADERBOARD ROW
                </Text>
                <CosmeticsLeaderboardPreview
                  profile={profile}
                  overrides={cosmeticOverrideForItem(item.cosmetic)}
                  hideLabel
                />
              </View>
            ) : null}

            <View style={{ gap: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 15,
                  paddingVertical: 12,
                  borderRadius: 13,
                  backgroundColor: t.isLight ? `${gold}18` : 'rgba(44,29,11,0.6)',
                  borderWidth: 1,
                  borderColor: `${gold}4d`,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 10,
                    letterSpacing: 1.8,
                    color: t.isLight ? gold : '#D9A45A',
                  }}
                >
                  YOUR BALANCE
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <CredPlate size={15} />
                  <Text
                    style={{
                      fontFamily: fontFamily.monoBold,
                      fontSize: 14,
                      color: t.heading,
                    }}
                  >
                    {balance.toLocaleString()}
                  </Text>
                </View>
              </View>

              {canBuy ? (
                <>
                  <Pressable
                    onPress={() => onBuy(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Buy for ${item.price_creds} Creds`}
                    style={{ borderRadius: 14, overflow: 'hidden' }}
                  >
                    <LinearGradient
                      colors={[...auraGradient]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{
                        paddingVertical: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                      }}
                    >
                      <CredPlate size={17} />
                      <Text
                        style={{
                          fontFamily: fontFamily.display,
                          fontSize: 16,
                          letterSpacing: 1.8,
                          color: '#FFFFFF',
                        }}
                      >
                        BUY · {item.price_creds.toLocaleString()}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                  {short > 0 ? (
                    <Pressable onPress={onTopUp} accessibilityRole="button">
                      <Text
                        style={{
                          fontFamily: fontFamily.mono,
                          fontSize: 10,
                          letterSpacing: 1.2,
                          color: '#FF5C89',
                          textAlign: 'center',
                        }}
                      >
                        {short.toLocaleString()} CREDS SHORT — TAP TO TOP UP
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <View
                  style={{
                    paddingVertical: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: t.buttonBorder,
                    alignItems: 'center',
                    opacity: 0.7,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamily.display,
                      fontSize: 15,
                      letterSpacing: 1.6,
                      color: t.placeholder,
                    }}
                  >
                    {item.owned ? 'OWNED' : 'SOLD OUT'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ShopHeroPreview({ item }: { item: ShopListingItem }) {
  const t = useThemeTokens();
  const rank = ranks[item.rarity];

  if (item.product_kind === 'crate') {
    return (
      <View
        style={{
          width: 120,
          height: 88,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${rank.color}22`,
          borderWidth: 1,
          borderColor: `${rank.color}73`,
        }}
      >
        <Ionicons name="cube-outline" size={48} color={rank.glow} />
      </View>
    );
  }

  if (item.cosmetic?.kind === 'title' || item.category === 'titles') {
    return (
      <View
        style={{
          paddingHorizontal: 26,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: `${rank.color}1c`,
          borderWidth: 1,
          borderColor: `${rank.color}73`,
          shadowColor: rank.color,
          shadowOpacity: 0.55,
          shadowRadius: 18,
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: fontFamily.display,
            fontSize: 27,
            color: rank.color,
            letterSpacing: 0.4,
          }}
        >
          {item.name}
        </Text>
      </View>
    );
  }

  if (item.cosmetic?.kind === 'avatar_border' || item.category === 'borders') {
    const border = parseBorderStyle(item.cosmetic?.style);
    const colors = gradientColors(border?.colors ?? [rank.color, rank.glow]);
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 999,
          padding: 3.5,
          shadowColor: colors[0],
          shadowOpacity: 0.55,
          shadowRadius: 14,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 999,
            backgroundColor: t.theme.colors.surface3,
          }}
        />
      </LinearGradient>
    );
  }

  const bannerColors = gradientColors(
    parseBannerStyle(item.cosmetic?.style)?.colors ?? [rank.color, rank.glow],
  );
  return (
    <LinearGradient
      colors={bannerColors}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={{
        width: 220,
        height: 56,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: `${rank.color}66`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fontFamily.display,
          fontSize: 16,
          color: '#FFFFFF',
          letterSpacing: 0.6,
        }}
      >
        {item.name}
      </Text>
    </LinearGradient>
  );
}

interface ShopConfirmModalProps {
  visible: boolean;
  item: ShopListingItem | null;
  balance: number;
  busy?: boolean;
  /** Cosmetic purchase succeeded — morphs this card into the PAID receipt. */
  success?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSuccessDismiss?: () => void;
}

function PurchaseSparkBurst({
  progress,
  gold,
  accent,
}: {
  progress: SharedValue<number>;
  gold: string;
  accent: string;
}) {
  return (
    <>
      {PURCHASE_SPARKS.map((s, i) => (
        <PurchaseSpark
          key={`spark-${i}`}
          progress={progress}
          spark={s}
          color={i % 3 === 0 ? accent : gold}
        />
      ))}
    </>
  );
}

function PurchaseSpark({
  progress,
  spark,
  color,
}: {
  progress: SharedValue<number>;
  spark: (typeof PURCHASE_SPARKS)[number];
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const local = Math.max(0, Math.min(1, (progress.value * 1000 - spark.delay) / 520));
    const eased = 1 - Math.pow(1 - local, 3);
    return {
      opacity: local > 0 && local < 1 ? Math.sin(local * Math.PI) : 0,
      transform: [
        { translateX: Math.cos(spark.angle) * spark.dist * eased },
        { translateY: Math.sin(spark.angle) * spark.dist * eased - 8 },
        { scale: 0.4 + eased * 0.9 },
        { rotate: `${spark.rotate * eased}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: '42%',
          left: '50%',
          marginLeft: -spark.size / 2,
          marginTop: -spark.size / 2,
          width: spark.size,
          height: spark.size * 0.55,
          borderRadius: 2,
          backgroundColor: color,
          zIndex: 7,
        },
        style,
      ]}
    />
  );
}

export function ShopConfirmModal({
  visible,
  item,
  balance,
  busy,
  success = false,
  onCancel,
  onConfirm,
  onSuccessDismiss,
}: ShopConfirmModalProps) {
  const t = useThemeTokens();
  const paid = useSharedValue(0);
  const paidSlam = useSharedValue(0);
  const debitPulse = useSharedValue(0);
  const actionsOut = useSharedValue(0);
  const doneIn = useSharedValue(0);
  const remainingGlow = useSharedValue(0);
  const cardPunch = useSharedValue(0);
  const flash = useSharedValue(0);
  const spark = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const itemPop = useSharedValue(0);
  const acquired = useSharedValue(0);
  const borderGlow = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (!visible || !success) {
      paid.value = 0;
      paidSlam.value = 0;
      debitPulse.value = 0;
      actionsOut.value = 0;
      doneIn.value = 0;
      remainingGlow.value = 0;
      cardPunch.value = 0;
      flash.value = 0;
      spark.value = 0;
      ring1.value = 0;
      ring2.value = 0;
      itemPop.value = 0;
      acquired.value = 0;
      borderGlow.value = 0;
      shimmer.value = 0;
      return;
    }

    const clearHaptics = schedulePurchaseSuccessHaptics();
    const ease = Easing.out(Easing.cubic);
    const punch = Easing.out(Easing.back(1.6));

    actionsOut.value = withTiming(1, { duration: 160, easing: ease });

    cardPunch.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 220, easing: ease }),
    );

    flash.value = withSequence(
      withTiming(1, { duration: 70 }),
      withTiming(0, { duration: 320, easing: ease }),
    );

    debitPulse.value = withSequence(
      withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(0.55, { duration: 180 }),
      withTiming(0, { duration: 420, easing: ease }),
    );

    // Keep stamp text at scale 1 — scale only a glow layer (avoids fuzzy glyphs).
    paidSlam.value = withDelay(
      90,
      withSequence(
        withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.4)) }),
        withDelay(300, withTiming(0, { duration: 240, easing: ease })),
      ),
    );
    paid.value = withDelay(520, withTiming(1, { duration: 240, easing: ease }));

    spark.value = withDelay(
      160,
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );

    ring1.value = withDelay(
      140,
      withTiming(1, { duration: 700, easing: ease }),
    );
    ring2.value = withDelay(
      240,
      withTiming(1, { duration: 780, easing: ease }),
    );

    itemPop.value = withDelay(
      280,
      withSequence(
        withTiming(1, { duration: 200, easing: punch }),
        withTiming(0, { duration: 260, easing: ease }),
      ),
    );

    acquired.value = withDelay(
      320,
      withTiming(1, { duration: 280, easing: ease }),
    );

    remainingGlow.value = withDelay(
      420,
      withSequence(
        withTiming(1, { duration: 180 }),
        withTiming(0.45, { duration: 360 }),
        withTiming(0.85, { duration: 220 }),
        withTiming(0.35, { duration: 500 }),
      ),
    );

    borderGlow.value = withDelay(
      100,
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.32, { duration: 520, easing: ease }),
        withRepeat(
          withSequence(
            withTiming(0.42, { duration: 900, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.26, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      ),
    );

    shimmer.value = withDelay(
      380,
      withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );

    doneIn.value = withDelay(680, withTiming(1, { duration: 280, easing: ease }));

    return clearHaptics;
  }, [
    visible,
    success,
    paid,
    paidSlam,
    debitPulse,
    actionsOut,
    doneIn,
    remainingGlow,
    cardPunch,
    flash,
    spark,
    ring1,
    ring2,
    itemPop,
    acquired,
    borderGlow,
    shimmer,
  ]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(cardPunch.value, [0, 1], [0, -6]) }],
  }));

  const cardHaloStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + borderGlow.value * 0.28,
    transform: [{ scale: 1 + borderGlow.value * 0.01 }],
  }));

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: borderGlow.value * 0.45,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.75,
  }));

  const paidHeaderStyle = useAnimatedStyle(() => ({
    opacity: paid.value,
    transform: [{ translateY: (1 - paid.value) * -8 }],
  }));

  // Opacity / slide / tilt only — never scale the glyph layer.
  const paidSlamStyle = useAnimatedStyle(() => ({
    opacity: paidSlam.value,
    transform: [
      { translateY: interpolate(paidSlam.value, [0, 1], [28, 0]) },
      { rotate: `${interpolate(paidSlam.value, [0, 1], [-10, -4])}deg` },
    ],
  }));

  const paidSlamGlowStyle = useAnimatedStyle(() => ({
    opacity: paidSlam.value * 0.9,
    transform: [{ scale: interpolate(paidSlam.value, [0, 1], [0.55, 1.35]) }],
  }));

  const debitGlowStyle = useAnimatedStyle(() => ({
    opacity: debitPulse.value,
  }));

  const confirmActionsStyle = useAnimatedStyle(() => ({
    opacity: 1 - actionsOut.value,
    transform: [{ translateY: actionsOut.value * 10 }],
  }));

  const doneActionsStyle = useAnimatedStyle(() => ({
    opacity: doneIn.value,
    transform: [{ translateY: (1 - doneIn.value) * 12 }],
  }));

  const remainingGlowBgStyle = useAnimatedStyle(() => ({
    opacity: remainingGlow.value * 0.7,
  }));

  const itemGlowStyle = useAnimatedStyle(() => ({
    opacity: itemPop.value * 0.55 + shimmer.value * 0.2,
    transform: [{ scale: 1 + itemPop.value * 0.06 }],
  }));

  const acquiredStyle = useAnimatedStyle(() => ({
    opacity: acquired.value,
    transform: [{ translateY: (1 - acquired.value) * 8 }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: (1 - ring1.value) * 0.7,
    transform: [{ scale: 0.55 + ring1.value * 1.35 }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: (1 - ring2.value) * 0.5,
    transform: [{ scale: 0.7 + ring2.value * 1.55 }],
  }));

  if (!item) return null;

  const gold = t.isLight ? CREDS_GOLD.light : CREDS_GOLD.dark;
  const rank = ranks[item.rarity];
  const remaining = balance - item.price_creds;
  const sub =
    item.product_kind === 'crate'
      ? `${item.odds_label ?? 'ONE ROLL'} · ONE ROLL`
      : `${shopRarityNameUpper(item.rarity)} · ${shopKindLabel(item)}`;

  function handleRequestClose() {
    if (success) onSuccessDismiss?.();
    else if (!busy) onCancel();
  }

  function handleDismissSuccess() {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSuccessDismiss?.();
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: t.isLight ? 'rgba(15,20,35,0.4)' : 'rgba(5,7,15,0.78)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
        onPress={success ? undefined : busy ? undefined : onCancel}
      >
        <View style={{ width: '100%', maxWidth: 330, alignItems: 'center' }}>
          {success ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    width: 220,
                    height: 220,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: gold,
                  },
                  ring1Style,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    width: 220,
                    height: 220,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: rank.color,
                  },
                  ring2Style,
                ]}
              />
            </>
          ) : null}

          <View style={{ width: '100%', position: 'relative' }}>
            {success ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    ...StyleSheet.absoluteFill,
                    margin: -6,
                    borderRadius: 26,
                    backgroundColor: gold,
                    shadowColor: gold,
                    shadowOpacity: 0.7,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                  },
                  cardHaloStyle,
                ]}
              />
            ) : null}

            <Animated.View style={[{ width: '100%', borderRadius: 22 }, cardStyle]}>
            {success ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    ...StyleSheet.absoluteFill,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: gold,
                  },
                  glowRingStyle,
                ]}
              />
            ) : null}

            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                borderRadius: 20,
                backgroundColor: t.theme.colors.surface,
                borderWidth: 1,
                borderColor: success ? `${gold}` : `${gold}b3`,
                overflow: 'hidden',
                shadowColor: gold,
                shadowOpacity: 0.35,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
              }}
            >
              {success ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      ...StyleSheet.absoluteFill,
                      backgroundColor: gold,
                      zIndex: 5,
                    },
                    flashStyle,
                  ]}
                />
              ) : null}

              {success ? (
                <View
                  pointerEvents="none"
                  style={{
                    ...StyleSheet.absoluteFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 6,
                  }}
                >
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        width: 160,
                        height: 160,
                        borderRadius: 999,
                        backgroundColor: gold,
                      },
                      paidSlamGlowStyle,
                    ]}
                  />
                  <Animated.View style={paidSlamStyle}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 22,
                        paddingVertical: 14,
                        borderRadius: 999,
                        backgroundColor: gold,
                        borderWidth: 3,
                        borderColor: '#FFF6D8',
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={28} color={CREDS_INK} />
                      <Text
                        style={{
                          fontFamily: fontFamily.display,
                          fontSize: 28,
                          letterSpacing: 3,
                          color: CREDS_INK,
                        }}
                      >
                        PAID
                      </Text>
                    </View>
                  </Animated.View>
                </View>
              ) : null}

              {success ? (
                <PurchaseSparkBurst progress={spark} gold={gold} accent={rank.color} />
              ) : null}

              <View
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 13,
                  backgroundColor: `${gold}1a`,
                  borderBottomWidth: 1,
                  borderBottomColor: `${gold}33`,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 10,
                    letterSpacing: 2,
                    color: gold,
                    flex: 1,
                  }}
                >
                  {success ? '◆ TRANSACTION COMPLETE' : '◆ CONFIRM PURCHASE'}
                </Text>
                {success ? (
                  <Animated.View
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: gold,
                      },
                      paidHeaderStyle,
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={14} color={CREDS_INK} />
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontFamily: fontFamily.monoBold,
                        fontSize: 11,
                        letterSpacing: 1.4,
                        color: CREDS_INK,
                      }}
                    >
                      PAID
                    </Text>
                  </Animated.View>
                ) : null}
              </View>

              <View style={{ padding: 22, gap: 18 }}>
                <View style={{ alignItems: 'center', gap: 8, position: 'relative' }}>
                  {success ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        {
                          ...StyleSheet.absoluteFill,
                          borderRadius: 16,
                          backgroundColor: `${rank.color}22`,
                        },
                        itemGlowStyle,
                      ]}
                    />
                  ) : null}

                  {success ? (
                    <Animated.View
                      style={[
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: `${rank.color}33`,
                          borderWidth: 1,
                          borderColor: `${rank.color}99`,
                        },
                        acquiredStyle,
                      ]}
                    >
                      <Ionicons name="sparkles" size={12} color={rank.color} />
                      <Text
                        style={{
                          fontFamily: fontFamily.monoBold,
                          fontSize: 10,
                          letterSpacing: 2,
                          color: rank.color,
                        }}
                      >
                        ACQUIRED
                      </Text>
                    </Animated.View>
                  ) : null}

                  <Text
                    style={{
                      fontFamily: fontFamily.display,
                      fontSize: success ? 26 : 22,
                      color: rank.color,
                      textAlign: 'center',
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: 9.5,
                      letterSpacing: 1.8,
                      color: t.placeholder,
                      textAlign: 'center',
                    }}
                  >
                    {sub}
                  </Text>
                </View>

                <View
                  style={{
                    borderRadius: 13,
                    backgroundColor: t.theme.colors.surface2,
                    paddingHorizontal: 15,
                    paddingVertical: 14,
                    gap: 9,
                    overflow: 'hidden',
                  }}
                >
                  <LedgerRow label="BALANCE" value={balance.toLocaleString()} color={t.heading} />
                  <View style={{ position: 'relative' }}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        {
                          ...StyleSheet.absoluteFill,
                          backgroundColor: 'rgba(255,92,137,0.28)',
                          borderRadius: 6,
                          marginHorizontal: -6,
                          marginVertical: -4,
                        },
                        debitGlowStyle,
                      ]}
                    />
                    <LedgerRow
                      label="COST"
                      value={`− ${item.price_creds.toLocaleString()}`}
                      color="#FF5C89"
                    />
                  </View>
                  <View style={{ height: 1, backgroundColor: t.buttonBorder }} />
                  <View style={{ position: 'relative' }}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        {
                          ...StyleSheet.absoluteFill,
                          backgroundColor: `${gold}33`,
                          borderRadius: 8,
                          marginHorizontal: -8,
                          marginVertical: -6,
                        },
                        remainingGlowBgStyle,
                      ]}
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fontFamily.mono,
                          fontSize: 10.5,
                          letterSpacing: 1,
                          color: t.isLight ? gold : '#D9A45A',
                        }}
                      >
                        REMAINING
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CredPlate size={14} />
                        <Text
                          style={{
                            fontFamily: fontFamily.monoBold,
                            fontSize: 16,
                            color: gold,
                          }}
                        >
                          {remaining.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={{ minHeight: 96, justifyContent: 'center' }}>
                  <Animated.View
                    pointerEvents={success ? 'none' : 'auto'}
                    style={[{ gap: 9 }, confirmActionsStyle]}
                  >
                    <Pressable
                      disabled={busy || remaining < 0 || success}
                      onPress={onConfirm}
                      accessibilityRole="button"
                      accessibilityLabel={`Spend ${item.price_creds} Creds`}
                      style={{
                        borderRadius: 13,
                        overflow: 'hidden',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      <LinearGradient
                        colors={[gold, CREDS_DEEP]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{
                          paddingVertical: 15,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 9,
                        }}
                      >
                        {busy ? (
                          <ActivityIndicator color={CREDS_INK} />
                        ) : (
                          <Ionicons name="lock-open" size={16} color={CREDS_INK} />
                        )}
                        <Text
                          style={{
                            fontFamily: fontFamily.display,
                            fontSize: 15,
                            letterSpacing: 1.8,
                            color: CREDS_INK,
                          }}
                        >
                          {busy
                            ? 'PROCESSING…'
                            : `SPEND ${item.price_creds.toLocaleString()} CREDS`}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onPress={onCancel}
                      disabled={busy || success}
                      style={{ paddingVertical: 11 }}
                    >
                      <Text
                        style={{
                          fontFamily: fontFamily.mono,
                          fontSize: 11,
                          letterSpacing: 1.6,
                          color: t.placeholder,
                          textAlign: 'center',
                        }}
                      >
                        CANCEL
                      </Text>
                    </Pressable>
                  </Animated.View>

                  {success ? (
                    <Animated.View
                      style={[
                        {
                          ...StyleSheet.absoluteFill,
                          justifyContent: 'center',
                        },
                        doneActionsStyle,
                      ]}
                    >
                      <Pressable
                        onPress={handleDismissSuccess}
                        accessibilityRole="button"
                        accessibilityLabel="Nice"
                        style={{ borderRadius: 13, overflow: 'hidden' }}
                      >
                        <LinearGradient
                          colors={[gold, CREDS_DEEP]}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={{
                            paddingVertical: 15,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <Ionicons name="flash" size={16} color={CREDS_INK} />
                          <Text
                            style={{
                              fontFamily: fontFamily.display,
                              fontSize: 15,
                              letterSpacing: 2,
                              color: CREDS_INK,
                            }}
                          >
                            NICE
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </View>
              </View>
            </Pressable>
            </Animated.View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function LedgerRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 10.5,
          letterSpacing: 1,
          color: '#7D8AA8',
        }}
      >
        {label}
      </Text>
      <Text style={{ fontFamily: fontFamily.mono, fontSize: 13, color }}>{value}</Text>
    </View>
  );
}

interface ShopCredsPacksSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface CredsTopUpReveal {
  amount: number;
  packLabel: string;
  priceLabel?: string;
  bestValue?: boolean;
  balanceBefore?: number;
  kicker?: string;
}

export function ShopCredsPacksSheet({ visible, onClose }: ShopCredsPacksSheetProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const gold = t.isLight ? CREDS_GOLD.light : CREDS_GOLD.dark;
  const iapReady = useIapConfigured();
  const { data: livePrices } = useCredsPackPrices();
  const { data: profile } = useProfile();
  const purchasePack = usePurchaseCredsPack();
  const customerCenter = usePresentCustomerCenter();
  const [buyingPackId, setBuyingPackId] = useState<CredsPackId | null>(null);
  const [topUpReveal, setTopUpReveal] = useState<CredsTopUpReveal | null>(null);
  const isBusy = purchasePack.isPending || customerCenter.isPending;

  function showTopUpReveal(reveal: CredsTopUpReveal) {
    onClose();
    // Let the packs sheet dismiss before the celebrate overlay mounts.
    setTimeout(() => setTopUpReveal(reveal), 220);
  }

  async function handlePack(packId: CredsPackId, label: string) {
    if (!iapReady) {
      Alert.alert(
        'Coming soon',
        `${label} will unlock with real-money top-ups. Keep earning Creds daily for now.`,
      );
      return;
    }

    if (isBusy) return;

    const pack = CREDS_PACKS.find((entry) => entry.id === packId);
    const balanceBefore = profile?.currency ?? 0;
    setBuyingPackId(packId);
    try {
      const result = await purchasePack.mutateAsync(packId);
      const granted =
        result.amountGranted > 0 ? result.amountGranted : (pack?.amount ?? 0);
      showTopUpReveal({
        amount: granted,
        packLabel: pack?.label ?? label,
        priceLabel: livePrices?.[packId] ?? pack?.priceLabel,
        bestValue: pack?.bestValue ?? false,
        balanceBefore,
      });
    } catch (error) {
      if (isPurchaseCancelledError(error)) return;
      const message =
        error instanceof Error ? error.message : 'Purchase could not be completed.';
      Alert.alert('Purchase failed', message);
    } finally {
      setBuyingPackId(null);
    }
  }

  async function handleCustomerCenter() {
    if (!iapReady || isBusy) return;
    try {
      await customerCenter.mutateAsync();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not open purchase support.';
      Alert.alert('Unavailable', message);
    }
  }

  return (
    <>
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{
            ...StyleFill,
            backgroundColor: t.isLight ? 'rgba(15,20,35,0.4)' : 'rgba(5,7,15,0.78)',
          }}
          onPress={onClose}
        />

        <View
          style={{
            position: 'absolute',
            top: Math.max(insets.top, 48) + 40,
            left: 0,
            right: 0,
            alignItems: 'center',
            gap: 12,
          }}
          pointerEvents="none"
        >
          <CredPlate size={70} glow />
          <Text
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 10,
              letterSpacing: 2.2,
              color: t.placeholder,
              textAlign: 'center',
            }}
          >
            CREDS ARE EARNED DAILY —
          </Text>
          <Text
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 10,
              letterSpacing: 2.2,
              color: t.placeholder,
              textAlign: 'center',
              marginTop: -8,
            }}
          >
            TOP UP IF YOU'RE IN A HURRY
          </Text>
        </View>

        <View
          style={{
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: t.theme.colors.surface,
            borderTopWidth: 1.5,
            borderTopColor: `${gold}80`,
            paddingHorizontal: spacing.lg,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 20) + 14,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: 999,
              alignSelf: 'center',
              backgroundColor: t.buttonBorder,
            }}
          />
          <View style={{ gap: 3, paddingTop: 4 }}>
            <Text
              style={{
                fontFamily: fontFamily.mono,
                fontSize: 10,
                letterSpacing: 2.2,
                color: gold,
              }}
            >
              TOP UP
            </Text>
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: 25,
                color: t.heading,
              }}
            >
              Cred Bundles
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {CREDS_PACKS.map((pack) => (
              <Pressable
                key={pack.id}
                onPress={() => void handlePack(pack.id, pack.label)}
                disabled={isBusy}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                  paddingHorizontal: 15,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: pack.bestValue
                    ? `${gold}14`
                    : t.theme.colors.surface2,
                  borderWidth: pack.bestValue ? 1.5 : 1,
                  borderColor: pack.bestValue ? `${gold}99` : t.buttonBorder,
                  position: 'relative',
                  opacity: isBusy && buyingPackId !== pack.id ? 0.55 : 1,
                }}
              >
                {pack.bestValue ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -9,
                      left: 15,
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: gold,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamily.monoBold,
                        fontSize: 8.5,
                        letterSpacing: 1.4,
                        color: CREDS_INK,
                      }}
                    >
                      BEST VALUE
                    </Text>
                  </View>
                ) : null}
                <CredPlate size={pack.bestValue ? 34 : 30} glow={pack.bestValue} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.monoBold,
                      fontSize: pack.bestValue ? 17 : 16,
                      color: pack.bestValue ? gold : t.heading,
                    }}
                  >
                    {pack.amount.toLocaleString()}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: 9.5,
                      letterSpacing: 1.4,
                      color: pack.bestValue
                        ? t.isLight
                          ? gold
                          : '#D9A45A'
                        : t.placeholder,
                    }}
                  >
                    {pack.label}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: pack.bestValue ? gold : 'transparent',
                    borderWidth: pack.bestValue ? 0 : 1,
                    borderColor: t.buttonBorder,
                  }}
                >
                  {buyingPackId === pack.id ? (
                    <ActivityIndicator
                      color={pack.bestValue ? CREDS_INK : gold}
                      size="small"
                    />
                  ) : (
                    <Text
                      style={{
                        fontFamily: fontFamily.display,
                        fontSize: 14,
                        color: pack.bestValue ? CREDS_INK : t.heading,
                      }}
                    >
                      {livePrices?.[pack.id] ?? pack.priceLabel}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          <Text
            style={{
              fontFamily: fontFamily.body,
              fontSize: 12,
              lineHeight: 18,
              color: t.placeholder,
              textAlign: 'center',
            }}
          >
            Bundles buy Creds only. Every cosmetic in the Shop is reachable by showing up.
          </Text>

          {iapReady ? (
            <View style={{ alignItems: 'center', paddingTop: 2 }}>
              <Pressable
                onPress={() => void handleCustomerCenter()}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="Purchase help"
              >
                <Text
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 10,
                    letterSpacing: 1.1,
                    color: t.placeholder,
                  }}
                >
                  {customerCenter.isPending ? 'OPENING…' : 'HELP'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>

    {topUpReveal ? (
      <CredsPackReveal
        visible
        packLabel={topUpReveal.packLabel}
        amount={topUpReveal.amount}
        priceLabel={topUpReveal.priceLabel}
        bestValue={topUpReveal.bestValue}
        balanceBefore={topUpReveal.balanceBefore}
        kicker={topUpReveal.kicker}
        onContinue={() => setTopUpReveal(null)}
      />
    ) : null}
    </>
  );
}

const StyleFill = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
