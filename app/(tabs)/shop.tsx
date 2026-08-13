import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RewardReveal, type RewardRowData } from '@/components/reward-reveal';
import {
  ShopConfirmModal,
  ShopCredsPacksSheet,
  ShopItemDetailSheet,
} from '@/components/shop-sheets';
import { CredPlate, ScreenBackground } from '@/components/ui';
import { useProfile } from '@/hooks/use-profile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { usePurchaseShopListing, useShopStock } from '@/hooks/use-shop';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { HUD_CONTENT_TOP_PAD } from '@/lib/app-hud';
import { gradientColors, parseBannerStyle, parseBorderStyle } from '@/lib/cosmetics';
import { fontFamily, ranks, spacing } from '@/lib/gaingang-theme';
import {
  emblemLevelFromRewards,
  raritySubtitle,
  revealTierFromCrate,
  rewardAccentColor,
  type CrateReward,
} from '@/lib/rewards';
import {
  CREDS_DEEP,
  CREDS_GOLD,
  CREDS_INK,
  formatCountdown,
  formatRestockLabel,
  shopRarityNameUpper,
  type ShopListingItem,
} from '@/lib/shop';

function rewardsToRevealRows(rewards: CrateReward[]): RewardRowData[] {
  return rewards.map((reward) => {
    if (reward.kind === 'creds') {
      return {
        label: reward.label,
        value: reward.value,
        color: rewardAccentColor(reward),
        mark: 'creds' as const,
      };
    }
    return {
      label: reward.label,
      value: reward.value,
      color: rewardAccentColor(reward),
      badgeLevel: reward.kind === 'xp' ? reward.badgeLevel : undefined,
      badgeLabel: reward.kind === 'xp' ? 'XP' : undefined,
    };
  });
}

/** Shop storefront — spend Creds on rotating cosmetics and crates. */
export default function ShopScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { data: stock, isLoading, error, refetch } = useShopStock();
  const purchase = usePurchaseShopListing();
  const { isRefreshing, onRefresh } = usePullToRefresh(refetch);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selected, setSelected] = useState<ShopListingItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<ShopListingItem | null>(null);
  const [confirmBalance, setConfirmBalance] = useState(0);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [packsVisible, setPacksVisible] = useState(false);
  const [revealVisible, setRevealVisible] = useState(false);
  const [revealRewards, setRevealRewards] = useState<CrateReward[]>([]);
  const [revealTitle, setRevealTitle] = useState('');
  const [revealSubtitle, setRevealSubtitle] = useState('');
  const [revealFloor, setRevealFloor] = useState<ShopListingItem['rarity']>('C');
  const [actionError, setActionError] = useState<string | null>(null);

  const gold = t.isLight ? CREDS_GOLD.light : CREDS_GOLD.dark;
  const balance = profile?.currency ?? 0;
  const endsAtMs = stock ? new Date(stock.rotation_ends_at).getTime() : 0;
  const resetCountdown = endsAtMs ? formatCountdown(endsAtMs, nowMs) : '—';

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!stock || !endsAtMs) return;
    if (nowMs < endsAtMs) return;
    void refetch();
  }, [nowMs, endsAtMs, stock, refetch]);

  const featured = useMemo(
    () => stock?.items.find((item) => item.is_featured) ?? null,
    [stock],
  );
  const crates = useMemo(
    () =>
      (stock?.items ?? []).filter((item) => item.category === 'crates' && !item.is_featured),
    [stock],
  );
  const titles = useMemo(
    () =>
      (stock?.items ?? []).filter((item) => item.category === 'titles' && !item.is_featured),
    [stock],
  );
  const borders = useMemo(
    () =>
      (stock?.items ?? []).filter((item) => item.category === 'borders' && !item.is_featured),
    [stock],
  );
  const banners = useMemo(
    () =>
      (stock?.items ?? []).filter((item) => item.category === 'banners' && !item.is_featured),
    [stock],
  );

  async function handleConfirmPurchase() {
    if (!confirmItem) return;
    setActionError(null);
    const bought = confirmItem;
    try {
      const result = await purchase.mutateAsync(bought.id);
      setSelected(null);

      if (bought.product_kind === 'crate') {
        setConfirmItem(null);
        setPurchaseSuccess(false);
        setRevealTitle(bought.name);
        setRevealSubtitle(
          raritySubtitle(result.rewards) ??
            bought.odds_label ??
            'Purchase complete',
        );
        setRevealFloor(bought.crate_min_rarity ?? bought.rarity);
        setRevealRewards(result.rewards);
        setRevealVisible(true);
      } else {
        setPurchaseSuccess(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Purchase failed';
      setActionError(message);
      setPurchaseSuccess(false);
      setConfirmItem(null);
    }
  }

  function openConfirm(item: ShopListingItem) {
    setPurchaseSuccess(false);
    setConfirmBalance(balance);
    setConfirmItem(item);
  }

  function closeConfirm() {
    setConfirmItem(null);
    setPurchaseSuccess(false);
  }

  return (
    <ScreenBackground>
      <View style={{ flex: 1, paddingTop: HUD_CONTENT_TOP_PAD }}>
        {(error || actionError) && (
          <Text
            style={{
              paddingHorizontal: spacing.lg,
              paddingBottom: 8,
              fontFamily: fontFamily.mono,
              fontSize: 11,
              color: '#FF5C89',
            }}
          >
            {actionError ?? (error instanceof Error ? error.message : 'Failed to load shop')}
          </Text>
        )}

        {isLoading && !stock ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              gap: spacing.md,
              paddingBottom: insets.bottom + 28,
            }}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={t.accent} />
            }
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingBottom: 2,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 32,
                  lineHeight: 34,
                  color: t.heading,
                }}
              >
                Shop
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: `${gold}18`,
                  borderWidth: 1,
                  borderColor: `${gold}55`,
                }}
              >
                <Ionicons name="time-outline" size={13} color={gold} />
                <Text
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    color: gold,
                  }}
                >
                  RESETS IN {resetCountdown}
                </Text>
              </View>
            </View>

            {featured ? (
              <FeaturedDrop
                item={featured}
                countdown={resetCountdown}
                onPress={() => setSelected(featured)}
              />
            ) : null}

            <CategoryRow
              title="Crates"
              meta={formatRestockLabel(endsAtMs, nowMs)}
              items={crates}
              onPress={setSelected}
            />
            <CategoryRow
              title="Titles"
              meta={`${titles.filter((i) => !i.owned && !i.sold_out).length || titles.length} IN STOCK`}
              items={titles}
              onPress={setSelected}
            />
            <CategoryRow
              title="Borders"
              meta={`${borders.filter((i) => !i.owned && !i.sold_out).length || borders.length} IN STOCK`}
              items={borders}
              onPress={setSelected}
            />
            <CategoryRow
              title="Banners"
              meta={`${banners.filter((i) => !i.owned && !i.sold_out).length || banners.length} IN STOCK`}
              items={banners}
              onPress={setSelected}
            />

            <CompanionsTeaser />
          </ScrollView>
        )}
      </View>

      <ShopItemDetailSheet
        visible={!!selected && !confirmItem && !revealVisible}
        item={selected}
        profile={profile}
        balance={balance}
        onClose={() => setSelected(null)}
        onBuy={(item) => openConfirm(item)}
        onTopUp={() => {
          setSelected(null);
          setPacksVisible(true);
        }}
      />

      <ShopConfirmModal
        visible={!!confirmItem}
        item={confirmItem}
        balance={confirmBalance}
        busy={purchase.isPending}
        success={purchaseSuccess}
        onCancel={closeConfirm}
        onConfirm={() => {
          void handleConfirmPurchase();
        }}
        onSuccessDismiss={closeConfirm}
      />

      <ShopCredsPacksSheet visible={packsVisible} onClose={() => setPacksVisible(false)} />

      <Modal
        transparent
        visible={revealVisible}
        animationType="fade"
        onRequestClose={() => setRevealVisible(false)}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(5,7,15,0.92)',
            justifyContent: 'center',
          }}
        >
          <RewardReveal
            visible={revealVisible}
            kicker="PURCHASED"
            title={revealTitle}
            subtitle={revealSubtitle}
            tier={revealTierFromCrate(revealFloor, revealRewards)}
            emblemLevel={emblemLevelFromRewards(revealRewards)}
            rewards={rewardsToRevealRows(revealRewards)}
            onClaim={() => {
              setRevealVisible(false);
              setRevealRewards([]);
            }}
          />
        </View>
      </Modal>
    </ScreenBackground>
  );
}

function FeaturedDrop({
  item,
  countdown,
  onPress,
}: {
  item: ShopListingItem;
  countdown: string;
  onPress: () => void;
}) {
  const t = useThemeTokens();
  const gold = t.isLight ? CREDS_GOLD.light : CREDS_GOLD.dark;
  const rank = ranks[item.rarity];

  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 10,
            letterSpacing: 2.2,
            color: gold,
          }}
        >
          ◆ FEATURED DROP
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 10,
            letterSpacing: 1.4,
            color: t.placeholder,
          }}
        >
          {countdown} LEFT
        </Text>
      </View>

      <View
        style={{
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: `${gold}99`,
          backgroundColor: t.theme.colors.surface,
          shadowColor: gold,
          shadowOpacity: 0.4,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
        }}
      >
        <LinearGradient
          colors={[`${rank.color}55`, '#1A1526', t.theme.colors.surface]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 120,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 18,
            paddingHorizontal: 16,
            gap: 12,
          }}
        >
          <FeaturedItemPreview item={item} />
        </LinearGradient>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 14,
            backgroundColor: `${gold}12`,
          }}
        >
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={
              item.owned
                ? 'Owned — preview'
                : item.sold_out
                  ? 'Sold out — preview'
                  : `Preview for ${item.price_creds} Creds`
            }
            style={{
              borderRadius: 13,
              overflow: 'hidden',
              opacity: item.owned || item.sold_out ? 0.55 : 1,
            }}
          >
            <LinearGradient
              colors={[gold, CREDS_DEEP]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <CredPlate size={16} />
              <Text
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 15,
                  letterSpacing: 1.2,
                  color: CREDS_INK,
                }}
              >
                {item.owned
                  ? 'OWNED'
                  : item.sold_out
                    ? 'SOLD OUT'
                    : `${item.price_creds.toLocaleString()} CREDS`}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FeaturedItemPreview({ item }: { item: ShopListingItem }) {
  const t = useThemeTokens();
  const rank = ranks[item.rarity];

  if (item.cosmetic?.kind === 'avatar_border' || item.category === 'borders') {
    const border = parseBorderStyle(item.cosmetic?.style);
    const colors = gradientColors(border?.colors ?? [rank.color, rank.glow]);
    return (
      <View style={{ alignItems: 'center', gap: 10 }}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            padding: 3.5,
            shadowColor: colors[0],
            shadowOpacity: 0.6,
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
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: fontFamily.display,
            fontSize: 19,
            letterSpacing: 1,
            color: rank.color,
          }}
        >
          {item.name.toUpperCase()}
        </Text>
      </View>
    );
  }

  if (item.cosmetic?.kind === 'banner' || item.category === 'banners') {
    const colors = gradientColors(
      parseBannerStyle(item.cosmetic?.style)?.colors ?? [rank.color, rank.glow],
    );
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          minWidth: 220,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: `${rank.color}88`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: fontFamily.display,
            fontSize: 19,
            letterSpacing: 1,
            color: '#FFFFFF',
          }}
        >
          {item.name.toUpperCase()}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: `${rank.color}22`,
        borderWidth: 1,
        borderColor: `${rank.color}80`,
        shadowColor: rank.color,
        shadowOpacity: 0.55,
        shadowRadius: 14,
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontFamily: fontFamily.display,
          fontSize: 19,
          letterSpacing: 1,
          color: rank.color,
        }}
      >
        {item.name.toUpperCase()}
      </Text>
    </View>
  );
}

function CategoryRow({
  title,
  meta,
  items,
  onPress,
}: {
  title: string;
  meta: string;
  items: ShopListingItem[];
  onPress: (item: ShopListingItem) => void;
}) {
  const t = useThemeTokens();
  if (items.length === 0) return null;

  return (
    <View style={{ gap: 11 }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamily.displaySemi,
            fontSize: 19,
            color: t.heading,
            flex: 1,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 9.5,
            letterSpacing: 1.6,
            color: t.placeholder,
          }}
        >
          {meta}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.lg }}
      >
        {items.map((item) => (
          <ShopCard key={item.id} item={item} onPress={() => onPress(item)} />
        ))}
      </ScrollView>
    </View>
  );
}

function ShopCard({
  item,
  onPress,
}: {
  item: ShopListingItem;
  onPress: () => void;
}) {
  if (item.category === 'crates') return <CrateCard item={item} onPress={onPress} />;
  if (item.category === 'titles') return <TitleCard item={item} onPress={onPress} />;
  if (item.category === 'borders') return <BorderCard item={item} onPress={onPress} />;
  return <BannerCard item={item} onPress={onPress} />;
}

function CrateCard({ item, onPress }: { item: ShopListingItem; onPress: () => void }) {
  const t = useThemeTokens();
  const rank = ranks[item.rarity];
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 150,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: `${rank.color}80`,
        backgroundColor: t.theme.colors.surface,
        overflow: 'hidden',
        opacity: item.sold_out ? 0.5 : 1,
      }}
    >
      <LinearGradient
        colors={[`${rank.color}4d`, `${t.theme.colors.surface}33`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 70, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="cube-outline" size={46} color={rank.glow} />
      </LinearGradient>
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 7 }}>
        <Text
          style={{
            fontFamily: fontFamily.bodySemi,
            fontSize: 13.5,
            color: t.heading,
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <PriceOrOwned item={item} />
      </View>
    </Pressable>
  );
}

function TitleCard({ item, onPress }: { item: ShopListingItem; onPress: () => void }) {
  const t = useThemeTokens();
  const rank = ranks[item.rarity];
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 168,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: `${rank.color}6b`,
        backgroundColor: t.theme.colors.surface,
        padding: 13,
        gap: 10,
        opacity: item.owned || item.sold_out ? 0.5 : 1,
      }}
    >
      {item.stock_remaining === 1 && !item.owned && !item.sold_out ? (
        <View
          style={{
            position: 'absolute',
            top: -8,
            right: 10,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: rank.color,
            zIndex: 2,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.monoBold,
              fontSize: 8.5,
              letterSpacing: 1.2,
              color: '#20060F',
            }}
          >
            1 LEFT
          </Text>
        </View>
      ) : null}
      <View
        style={{
          height: 44,
          borderRadius: 10,
          backgroundColor: `${rank.color}1a`,
          borderWidth: 1,
          borderColor: `${rank.color}4d`,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: fontFamily.display,
            fontSize: 15,
            color: rank.color,
            letterSpacing: 0.5,
          }}
        >
          {item.name}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 9,
            letterSpacing: 1.4,
            color: rank.color,
          }}
        >
          {shopRarityNameUpper(item.rarity)}
        </Text>
        <PriceOrOwned item={item} compact />
      </View>
    </Pressable>
  );
}

function BorderCard({ item, onPress }: { item: ShopListingItem; onPress: () => void }) {
  const t = useThemeTokens();
  const rank = ranks[item.rarity];
  const border = parseBorderStyle(item.cosmetic?.style);
  const colors = gradientColors(border?.colors ?? [rank.color, rank.glow]);

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 118,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: `${rank.color}6b`,
        backgroundColor: t.theme.colors.surface,
        padding: 13,
        alignItems: 'center',
        gap: 9,
        opacity: item.owned || item.sold_out ? 0.5 : 1,
      }}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 46,
          height: 46,
          borderRadius: 999,
          padding: 3,
          shadowColor: colors[0],
          shadowOpacity: 0.55,
          shadowRadius: 10,
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
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fontFamily.bodySemi,
          fontSize: 12.5,
          color: t.heading,
          textAlign: 'center',
        }}
      >
        {item.name}
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 9,
          letterSpacing: 1.2,
          color: rank.color,
        }}
      >
        {shopRarityNameUpper(item.rarity)}
      </Text>
      <PriceOrOwned item={item} compact />
    </Pressable>
  );
}

function BannerCard({ item, onPress }: { item: ShopListingItem; onPress: () => void }) {
  const t = useThemeTokens();
  const rank = ranks[item.rarity];
  const colors = gradientColors(
    parseBannerStyle(item.cosmetic?.style)?.colors ?? [rank.color, rank.glow],
  );
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 150,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: `${rank.color}66`,
        backgroundColor: t.theme.colors.surface,
        padding: 12,
        gap: 10,
        opacity: item.owned || item.sold_out ? 0.5 : 1,
      }}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          height: 44,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fontFamily.display,
            fontSize: 13,
            color: '#FFFFFF',
          }}
        >
          {item.name}
        </Text>
      </LinearGradient>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 9,
            letterSpacing: 1.2,
            color: rank.color,
          }}
        >
          {shopRarityNameUpper(item.rarity)}
        </Text>
        <PriceOrOwned item={item} compact />
      </View>
    </Pressable>
  );
}

function PriceOrOwned({
  item,
  compact,
}: {
  item: ShopListingItem;
  compact?: boolean;
}) {
  const t = useThemeTokens();
  if (item.owned) {
    return (
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: compact ? 10 : 10,
          letterSpacing: 1.4,
          color: t.placeholder,
        }}
      >
        OWNED
      </Text>
    );
  }
  if (item.sold_out) {
    return (
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 10,
          letterSpacing: 1.4,
          color: t.placeholder,
        }}
      >
        SOLD OUT
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 5 : 6 }}>
      <CredPlate size={compact ? 12 : 14} />
      <Text
        style={{
          fontFamily: fontFamily.monoBold,
          fontSize: compact ? 12.5 : 13,
          color: t.heading,
        }}
      >
        {item.price_creds.toLocaleString()}
      </Text>
    </View>
  );
}

function CompanionsTeaser() {
  const t = useThemeTokens();
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: 4 }}>
      <View
        style={{
          borderRadius: 15,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: 'rgba(125,165,255,0.24)',
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${t.accent}22`,
            borderWidth: 1,
            borderColor: `${t.accent}44`,
          }}
        >
          <Ionicons name="paw-outline" size={22} color={t.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 9.5,
              letterSpacing: 1.8,
              color: t.accent,
            }}
          >
            FORGING
          </Text>
          <Text style={{ fontFamily: fontFamily.body, fontSize: 13, color: t.body, lineHeight: 18 }}>
            Companions are still in the forge. Keep grinding — the kennel opens later.
          </Text>
        </View>
      </View>
    </View>
  );
}
