import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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

import { CosmeticsEquipPanel } from '@/components/cosmetics-equip-panel';
import { CosmeticsLeaderboardPreview } from '@/components/cosmetics-leaderboard-preview';
import { LevelUpWithRewardClaim } from '@/components/level-up-with-reward-claim';
import { RewardReveal, type RewardRowData } from '@/components/reward-reveal';
import { GlassSurface, LevelBadge, ScreenBackground } from '@/components/ui';
import {
  useOpenStarterCosmeticCrate,
  useStarterCosmeticCrates,
  type StarterCosmeticCrateCategory,
} from '@/hooks/use-cosmetics';
import { useProfile } from '@/hooks/use-profile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useOpenRewardCrate, useRewardCrates } from '@/hooks/use-reward-crates';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import {
  emblemLevelFromRewards,
  parseCrateContents,
  rarityDef,
  raritySubtitle,
  revealTierFromCrate,
  rewardAccentColor,
  type CrateReward,
} from '@/lib/rewards';
import { getLevelUpInfo, type CosmeticItem, type EquippedCosmeticSlots, type UserRewardCrate } from '@/types';

type InventoryTab = 'crates' | 'banners' | 'titles' | 'borders' | 'companions';

function godModeOverrideForItem(
  item: CosmeticItem | null,
): Partial<EquippedCosmeticSlots> | null {
  if (!item) return null;
  switch (item.kind) {
    case 'title':
      return { title: item };
    case 'avatar_border':
      return { avatarBorder: item };
    case 'level_border':
      return { levelBorder: item };
    case 'banner':
      return { banner: item };
  }
}

interface StarterReveal {
  category: StarterCosmeticCrateCategory;
  rewards: CrateReward[];
  title: string;
  subtitle: string;
}

interface InventoryTabDef {
  id: InventoryTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const INVENTORY_TABS: InventoryTabDef[] = [
  { id: 'crates', label: 'Crates', icon: 'cube-outline', iconActive: 'cube' },
  { id: 'banners', label: 'Banners', icon: 'image-outline', iconActive: 'image' },
  { id: 'titles', label: 'Titles', icon: 'text-outline', iconActive: 'text' },
  {
    id: 'borders',
    label: 'Borders',
    icon: 'ellipse-outline',
    iconActive: 'ellipse',
  },
  {
    id: 'companions',
    label: 'Companions',
    icon: 'paw-outline',
    iconActive: 'paw',
  },
];

function starterCategoryLabel(category: StarterCosmeticCrateCategory): string {
  switch (category) {
    case 'banner':
      return 'Banner';
    case 'title':
      return 'Title';
    case 'icon_border':
      return 'Icon Border';
    case 'level_border':
      return 'Level Border';
  }
}

function rewardsToRevealRows(rewards: CrateReward[]): RewardRowData[] {
  return rewards.map((reward) => ({
    label: reward.label,
    value: reward.value,
    color: rewardAccentColor(reward),
    badgeLevel: reward.kind === 'xp' ? reward.badgeLevel : undefined,
  }));
}

function xpAmountFromRewards(rewards: CrateReward[]): number {
  return rewards.reduce((sum, reward) => {
    if (reward.kind === 'xp') return sum + reward.amount;
    return sum;
  }, 0);
}

/** Keep the list from spoiling loot while the reveal is on screen. */
function asSealedSpoiler(crate: UserRewardCrate): UserRewardCrate {
  return {
    ...crate,
    status: 'sealed',
    contents: null,
    tier: 'D',
    title: 'Daily Reward Crate',
    subtitle: 'Earned by clearing every exercise for the day.',
    opened_at: null,
  };
}

export default function InventoryScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { data: crates, isLoading, refetch } = useRewardCrates();
  const { data: starterCrates } = useStarterCosmeticCrates();
  const { isRefreshing, onRefresh } = usePullToRefresh(refetch);
  const openCrate = useOpenRewardCrate();
  const openStarterCrate = useOpenStarterCosmeticCrate();

  const [activeTab, setActiveTab] = useState<InventoryTab>('crates');
  const [godMode, setGodMode] = useState(false);
  const [previewItem, setPreviewItem] = useState<CosmeticItem | null>(null);
  const [openingCrate, setOpeningCrate] = useState<UserRewardCrate | null>(null);
  const [starterReveal, setStarterReveal] = useState<StarterReveal | null>(null);
  const [revealVisible, setRevealVisible] = useState(false);
  const [spoilerCrateId, setSpoilerCrateId] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [pendingLevelUp, setPendingLevelUp] = useState<{
    fromLevel: number;
    toLevel: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sealed = (crates ?? []).filter((c) => c.status === 'sealed' || c.id === spoilerCrateId);

  const dailyRevealRewards = openingCrate
    ? (parseCrateContents(openingCrate.contents)?.rewards ?? [])
    : [];
  const revealRewards = starterReveal?.rewards ?? dailyRevealRewards;
  const revealTitle = starterReveal?.title ?? openingCrate?.title ?? '';
  const revealSubtitle =
    starterReveal?.subtitle ??
    raritySubtitle(revealRewards) ??
    openingCrate?.subtitle ??
    'Opening your reward…';
  const revealKey =
    openingCrate?.id ?? starterReveal?.category ?? 'reveal';

  function hasOpenedStarter(category: StarterCosmeticCrateCategory): boolean {
    return (starterCrates ?? []).some((crate) => crate.category === category);
  }

  async function handleOpen(crate: UserRewardCrate) {
    setError(null);
    setPendingLevelUp(null);
    setStarterReveal(null);

    const xpBefore = profile?.xp ?? 0;
    setSpoilerCrateId(crate.id);
    setOpeningCrate(null);
    setRevealVisible(true);

    try {
      const openedCrate = await openCrate.mutateAsync(crate.id);
      const rewards = parseCrateContents(openedCrate.contents)?.rewards ?? [];
      const xpGained = xpAmountFromRewards(rewards);
      setPendingLevelUp(getLevelUpInfo(xpBefore, xpGained));
      setOpeningCrate(openedCrate);
    } catch (e) {
      setRevealVisible(false);
      setSpoilerCrateId(null);
      setOpeningCrate(null);
      setPendingLevelUp(null);
      setError(e instanceof Error ? e.message : 'Could not open reward');
    }
  }

  async function handleOpenStarter(category: StarterCosmeticCrateCategory) {
    setError(null);
    setPendingLevelUp(null);
    setOpeningCrate(null);
    setStarterReveal(null);
    setRevealVisible(true);

    try {
      const rewards = await openStarterCrate.mutateAsync(category);
      const categoryName = starterCategoryLabel(category);
      setStarterReveal({
        category,
        rewards,
        title: `${categoryName} Starter Crate`,
        subtitle: `Guaranteed new ${categoryName.toLowerCase()}`,
      });
    } catch (e) {
      setRevealVisible(false);
      setError(e instanceof Error ? e.message : 'Could not open starter crate');
    }
  }

  function handleRevealClaim() {
    setRevealVisible(false);
    setOpeningCrate(null);
    setStarterReveal(null);
    setSpoilerCrateId(null);

    if (pendingLevelUp) {
      setLevelUp(pendingLevelUp);
      setPendingLevelUp(null);
      setLevelUpKey((k) => k + 1);
    }
  }

  const headerCopy: Record<InventoryTab, string> = {
    crates:
      'Sealed crates wait here until you open them. Daily clears grant Uncommon crates; level-ups grant Common, Rare (every 5), or Epic (every 10).',
    banners: 'Equip a profile banner. Unlock more from daily crates.',
    titles: 'Equip a title next to your username. Unlock more from daily crates.',
    borders: 'Equip an icon border around your avatar. Unlock more from daily crates.',
    companions: 'Equippable companions that boost XP are on the way.',
  };

  const previewOverrides = useMemo(
    () => (godMode ? godModeOverrideForItem(previewItem) : null),
    [godMode, previewItem],
  );

  function handleGodModeToggle() {
    setGodMode((prev) => {
      if (prev) setPreviewItem(null);
      return !prev;
    });
  }

  function handlePreviewItem(item: CosmeticItem | null) {
    setPreviewItem(item);
  }

  function handleTabChange(tab: InventoryTab) {
    setActiveTab(tab);
    setPreviewItem(null);
  }

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={26} color={t.heading} />
            </Pressable>
            <Text style={[type.heading, { color: t.heading, flex: 1 }]}>Inventory</Text>
            {__DEV__ ? (
              <Pressable
                onPress={handleGodModeToggle}
                accessibilityRole="switch"
                accessibilityState={{ checked: godMode }}
                accessibilityLabel="Toggle god mode catalog preview"
                hitSlop={8}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: godMode ? '#F5A524' : t.buttonBorder,
                  backgroundColor: godMode ? 'rgba(245,165,36,0.18)' : t.buttonBg,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemi,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    color: godMode ? '#F5A524' : t.body,
                  }}
                >
                  GOD MODE
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[type.bodySm, { color: t.body }]}>
            {godMode && activeTab !== 'crates' && activeTab !== 'companions'
              ? 'God mode on — full catalog. Tap an item to preview it on the leaderboard row.'
              : headerCopy[activeTab]}
          </Text>
          {error ? (
            <Text style={[type.bodySm, { color: '#FF5C89' }]}>{error}</Text>
          ) : null}
        </View>

        {profile &&
        (activeTab === 'banners' ||
          activeTab === 'titles' ||
          activeTab === 'borders') ? (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: t.buttonBorder,
            }}
          >
            <CosmeticsLeaderboardPreview
              profile={profile}
              overrides={previewOverrides}
            />
          </View>
        ) : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.md,
            gap: spacing.md,
            paddingBottom: 24,
          }}
          refreshControl={
            activeTab === 'crates' ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={t.accent}
              />
            ) : undefined
          }
        >
          {activeTab === 'crates' ? (
            <CratesTab
              sealed={sealed}
              spoilerCrateId={spoilerCrateId}
              isLoading={isLoading}
              isOpening={openCrate.isPending || revealVisible}
              onOpen={handleOpen}
            />
          ) : null}

          {activeTab === 'banners' && profile ? (
            <>
              {!godMode && !hasOpenedStarter('banner') ? (
                <StarterCosmeticCrateCard
                  category="banner"
                  title="Banner Starter Crate"
                  description="Guaranteed to unlock one banner you don't already own."
                  isOpening={
                    openStarterCrate.isPending &&
                    openStarterCrate.variables === 'banner'
                  }
                  onOpen={() => void handleOpenStarter('banner')}
                />
              ) : null}
              <CosmeticsEquipPanel
                userId={profile.id}
                profile={profile}
                canEquip
                kinds={['banner']}
                godMode={godMode}
                onPreviewItem={handlePreviewItem}
                previewItemId={previewItem?.id ?? null}
                emptyTitle="No banners yet"
                emptyBody="Open your starter crate above or earn banners from daily reward crates."
              />
            </>
          ) : null}

          {activeTab === 'titles' && profile ? (
            <>
              {!godMode && !hasOpenedStarter('title') ? (
                <StarterCosmeticCrateCard
                  category="title"
                  title="Title Starter Crate"
                  description="Guaranteed to unlock one title you don't already own."
                  isOpening={
                    openStarterCrate.isPending &&
                    openStarterCrate.variables === 'title'
                  }
                  onOpen={() => void handleOpenStarter('title')}
                />
              ) : null}
              <CosmeticsEquipPanel
                userId={profile.id}
                profile={profile}
                canEquip
                kinds={['title']}
                godMode={godMode}
                onPreviewItem={handlePreviewItem}
                previewItemId={previewItem?.id ?? null}
                emptyTitle="No titles yet"
                emptyBody="Open your starter crate above or earn titles from daily reward crates."
              />
            </>
          ) : null}

          {activeTab === 'borders' && profile ? (
            <>
              {!godMode && !hasOpenedStarter('icon_border') ? (
                <StarterCosmeticCrateCard
                  category="icon_border"
                  title="Icon Border Starter Crate"
                  description="Guaranteed to unlock one icon border you don't already own."
                  isOpening={
                    openStarterCrate.isPending &&
                    openStarterCrate.variables === 'icon_border'
                  }
                  onOpen={() => void handleOpenStarter('icon_border')}
                />
              ) : null}
              <CosmeticsEquipPanel
                userId={profile.id}
                profile={profile}
                canEquip
                kinds={['avatar_border']}
                godMode={godMode}
                onPreviewItem={handlePreviewItem}
                previewItemId={previewItem?.id ?? null}
                emptyTitle="No icon borders yet"
                emptyBody="Open your starter crate above or earn icon borders from daily reward crates."
              />
            </>
          ) : null}

          {activeTab === 'companions' ? <CompanionsComingSoon /> : null}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: t.buttonBorder,
            backgroundColor: t.buttonBg,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
            paddingHorizontal: 4,
          }}
        >
          {INVENTORY_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const color = isActive ? t.accent : t.body;
            return (
              <Pressable
                key={tab.id}
                onPress={() => handleTabChange(tab.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 6,
                }}
              >
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={22}
                  color={color}
                />
                <Text
                  style={{
                    fontFamily: isActive ? fontFamily.bodySemi : fontFamily.body,
                    fontSize: 10,
                    color,
                  }}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Modal
        visible={revealVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleRevealClaim}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,15,0.92)' }}>
          {openingCrate || starterReveal ? (
            <RewardReveal
              key={revealKey}
              visible
              onClaim={handleRevealClaim}
              tier={revealTierFromCrate(openingCrate?.tier, revealRewards)}
              title={revealTitle}
              subtitle={revealSubtitle}
              kicker={
                starterReveal ? 'STARTER CRATE OPENED' : 'REWARD CRATE OPENED'
              }
              claimLabel="CONTINUE"
              emblemLevel={emblemLevelFromRewards(revealRewards)}
              rewards={rewardsToRevealRows(revealRewards)}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#8FB4FF" />
            </View>
          )}
        </View>
      </Modal>

      {levelUp ? (
        <LevelUpWithRewardClaim
          key={levelUpKey}
          visible
          fromLevel={levelUp.fromLevel}
          toLevel={levelUp.toLevel}
          onDismiss={() => setLevelUp(null)}
        />
      ) : null}
    </ScreenBackground>
  );
}

function StarterCosmeticCrateCard({
  category,
  title,
  description,
  isOpening,
  onOpen,
}: {
  category: StarterCosmeticCrateCategory;
  title: string;
  description: string;
  isOpening: boolean;
  onOpen: () => void;
}) {
  const t = useThemeTokens();
  const icon: keyof typeof Ionicons.glyphMap =
    category === 'banner'
      ? 'image'
      : category === 'title'
        ? 'text'
        : category === 'level_border'
          ? 'shield'
          : 'person-circle';

  return (
    <GlassSurface
      style={{
        padding: 16,
        gap: 12,
        borderWidth: 1.5,
        borderColor: `${t.accent}88`,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${t.accent}22`,
            borderWidth: 1,
            borderColor: `${t.accent}66`,
          }}
        >
          <Ionicons name={icon} size={24} color={t.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              fontFamily: fontFamily.displaySemi,
              fontSize: 17,
              color: t.heading,
            }}
          >
            {title}
          </Text>
          <Text style={[type.labelSm, { color: t.accent }]}>
            FREE · GUARANTEED NEW
          </Text>
        </View>
      </View>

      <Text style={[type.bodySm, { color: t.body }]}>{description}</Text>

      <Pressable
        onPress={onOpen}
        disabled={isOpening}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        style={({ pressed }) => ({
          opacity: pressed || isOpening ? 0.7 : 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: t.accent,
        })}
      >
        {isOpening ? (
          <ActivityIndicator color={t.accentOnPrimary} />
        ) : (
          <Text
            style={{
              fontFamily: fontFamily.display,
              fontSize: 14,
              letterSpacing: 1.3,
              color: t.accentOnPrimary,
            }}
          >
            OPEN STARTER CRATE
          </Text>
        )}
      </Pressable>
    </GlassSurface>
  );
}

function CratesTab({
  sealed,
  spoilerCrateId,
  isLoading,
  isOpening,
  onOpen,
}: {
  sealed: UserRewardCrate[];
  spoilerCrateId: string | null;
  isLoading: boolean;
  isOpening: boolean;
  onOpen: (crate: UserRewardCrate) => void;
}) {
  const t = useThemeTokens();

  if (isLoading) {
    return <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />;
  }

  if (sealed.length === 0) {
    return (
      <GlassSurface style={{ padding: 20, gap: 8 }}>
        <Text
          style={{
            fontFamily: fontFamily.displaySemi,
            fontSize: 18,
            color: t.heading,
          }}
        >
          No unopened crates
        </Text>
        <Text style={[type.bodySm, { color: t.body }]}>
          Clear every daily exercise to earn a sealed crate in your inventory.
        </Text>
      </GlassSurface>
    );
  }

  return (
    <View className="gap-3">
      <Text style={[type.label, { color: t.placeholder }]}>Sealed</Text>
      {sealed.map((crate) => {
        const display = crate.id === spoilerCrateId ? asSealedSpoiler(crate) : crate;
        return (
          <CrateCard
            key={crate.id}
            crate={display}
            onOpen={() => onOpen(crate)}
            isOpening={isOpening && spoilerCrateId === crate.id}
          />
        );
      })}
    </View>
  );
}

function CompanionsComingSoon() {
  const t = useThemeTokens();

  return (
    <GlassSurface style={{ padding: 24, gap: 12, alignItems: 'center' }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${t.accent}22`,
          borderWidth: 1,
          borderColor: `${t.accent}55`,
        }}
      >
        <Ionicons name="paw" size={30} color={t.accent} />
      </View>
      <Text
        style={{
          fontFamily: fontFamily.bodySemi,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: t.accent,
        }}
      >
        Coming soon
      </Text>
      <Text
        style={{
          fontFamily: fontFamily.displaySemi,
          fontSize: 20,
          color: t.heading,
          textAlign: 'center',
        }}
      >
        Companions
      </Text>
      <Text
        style={[
          type.bodySm,
          { color: t.body, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
        ]}
      >
        Animal and mythical companions you can equip for XP boosts are forging next. Keep opening
        crates — they&apos;ll hatch here.
      </Text>
    </GlassSurface>
  );
}

interface CrateCardProps {
  crate: UserRewardCrate;
  onOpen: () => void;
  isOpening: boolean;
}

function CrateCard({ crate, onOpen, isOpening }: CrateCardProps) {
  const t = useThemeTokens();
  const isSealed = crate.status === 'sealed';
  const rewards = parseCrateContents(crate.contents)?.rewards ?? [];
  const xpReward = rewards.find((r) => r.kind === 'xp');
  const crateTier =
    crate.tier === 'E' ||
    crate.tier === 'D' ||
    crate.tier === 'C' ||
    crate.tier === 'B' ||
    crate.tier === 'A' ||
    crate.tier === 'S'
      ? rarityDef(crate.tier)
      : null;
  const accent = xpReward
    ? rarityDef(xpReward.rarity).color
    : (crateTier?.color ?? t.accent);

  return (
    <GlassSurface style={{ padding: 16, gap: 12 }}>
      <View className="flex-row items-start gap-3">
        {xpReward ? (
          <LevelBadge level={xpReward.badgeLevel} size={44} centerLabel="XP" />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: crateTier ? `${crateTier.color}22` : 'rgba(77,140,255,0.12)',
              borderWidth: 1,
              borderColor: crateTier ? `${crateTier.color}66` : 'rgba(77,140,255,0.35)',
            }}
          >
            <Ionicons
              name={isSealed ? 'cube' : 'cube-outline'}
              size={22}
              color={crateTier?.color ?? t.accent}
            />
          </View>
        )}

        <View className="flex-1 gap-1">
          <Text
            style={{
              fontFamily: fontFamily.displaySemi,
              fontSize: 17,
              color: t.heading,
            }}
          >
            {crate.title}
          </Text>
          <Text style={[type.labelSm, { color: accent }]}>
            {isSealed ? 'SEALED' : 'OPENED'}
            {crateTier ? ` · ${crateTier.name.toUpperCase()}+` : ''}
            {crate.source === 'level_up' && crate.source_level
              ? ` · LV ${crate.source_level}`
              : ` · ${crate.source_date}`}
            {xpReward ? ` · ${rarityDef(xpReward.rarity).name.toUpperCase()}` : ''}
          </Text>
          {crate.subtitle ? (
            <Text style={[type.bodySm, { color: t.body }]}>{crate.subtitle}</Text>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={onOpen}
        disabled={isOpening}
        style={({ pressed }) => ({
          opacity: pressed || isOpening ? 0.7 : 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: isSealed ? t.accent : 'rgba(77,140,255,0.12)',
        })}
        accessibilityRole="button"
        accessibilityLabel={isSealed ? 'Open reward crate' : 'Replay reward reveal'}
      >
        <Text
          style={{
            fontFamily: fontFamily.display,
            fontSize: 14,
            letterSpacing: 1.4,
            color: isSealed ? '#fff' : t.heading,
          }}
        >
          {isOpening ? 'OPENING…' : isSealed ? 'OPEN CRATE' : 'REPLAY REVEAL'}
        </Text>
      </Pressable>
    </GlassSurface>
  );
}
