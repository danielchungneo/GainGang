import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { LevelUpOverlay } from '@/components/level-up-overlay';
import { RewardReveal, type RewardRowData } from '@/components/reward-reveal';
import { GlassSurface, LevelBadge, ScreenBackground } from '@/components/ui';
import { useProfile } from '@/hooks/use-profile';
import { useOpenRewardCrate, useRewardCrates } from '@/hooks/use-reward-crates';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import {
  emblemLevelFromRewards,
  parseCrateContents,
  rarityDef,
  raritySubtitle,
  REWARD_RARITY_ORDER,
  revealTierFromCrate,
  rewardAccentColor,
  type CrateReward,
  type RewardRarity,
  type XpCrateReward,
} from '@/lib/rewards';
import { getLevelUpInfo, type UserRewardCrate } from '@/types';

function rewardsToRevealRows(rewards: CrateReward[]): RewardRowData[] {
  return rewards.map((reward) => ({
    label: reward.label,
    value: reward.value,
    color: rewardAccentColor(reward),
    badgeLevel: reward.kind === 'xp' ? reward.badgeLevel : undefined,
  }));
}

/** Local-only preview loot — does not grant XP or touch the server. */
function previewXpReward(rarity: RewardRarity): XpCrateReward {
  const def = rarityDef(rarity);
  return {
    kind: 'xp',
    rarity,
    amount: def.xpAmount,
    badgeLevel: def.badgeLevel,
    label: `${def.name.toUpperCase()} XP DROP`,
    value: `+${def.xpAmount} XP`,
  };
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
    tier: 'aura',
    title: 'Daily Reward Crate',
    subtitle: 'Earned by clearing every exercise for the day.',
    opened_at: null,
  };
}

export default function InventoryScreen() {
  const t = useThemeTokens();
  const { data: profile } = useProfile();
  const { data: crates, isLoading, refetch, isRefetching } = useRewardCrates();
  const openCrate = useOpenRewardCrate();

  const [openingCrate, setOpeningCrate] = useState<UserRewardCrate | null>(null);
  const [previewRewards, setPreviewRewards] = useState<CrateReward[] | null>(null);
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
  const opened = (crates ?? []).filter((c) => c.status === 'opened' && c.id !== spoilerCrateId);

  const revealRewards = previewRewards
    ?? (openingCrate ? (parseCrateContents(openingCrate.contents)?.rewards ?? []) : []);
  const revealTitle = previewRewards
    ? `${rarityDef(previewRewards[0]!.rarity).name} XP Cache`
    : (openingCrate?.title ?? '');
  const revealSubtitle = previewRewards
    ? (raritySubtitle(previewRewards) ?? 'Dev preview — no XP granted')
    : (raritySubtitle(revealRewards) ??
      openingCrate?.subtitle ??
      'Opening your reward…');
  const revealKey = previewRewards
    ? `preview-${previewRewards[0]?.rarity ?? 'x'}-${levelUpKey}`
    : (openingCrate?.id ?? 'reveal');

  async function handleOpen(crate: UserRewardCrate) {
    setError(null);
    setPreviewRewards(null);
    setPendingLevelUp(null);

    // Replay already-opened crates immediately (loot is persisted).
    if (crate.status !== 'sealed') {
      setSpoilerCrateId(null);
      setOpeningCrate(crate);
      setRevealVisible(true);
      return;
    }

    // Cover the screen first so the list never flashes opened loot.
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

  function handlePreviewRarity(rarity: RewardRarity) {
    setError(null);
    setOpeningCrate(null);
    setSpoilerCrateId(null);
    setPendingLevelUp(null);
    setPreviewRewards([previewXpReward(rarity)]);
    setRevealVisible(true);
  }

  function handleRevealClaim() {
    setRevealVisible(false);
    setOpeningCrate(null);
    setPreviewRewards(null);
    setSpoilerCrateId(null);

    if (pendingLevelUp) {
      setLevelUp(pendingLevelUp);
      setPendingLevelUp(null);
      setLevelUpKey((k) => k + 1);
    }
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={t.accent}
          />
        }
      >
        <View className="mt-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={26} color={t.heading} />
          </Pressable>
          <Text style={[type.heading, { color: t.heading, flex: 1 }]}>Inventory</Text>
        </View>

        <Text style={[type.bodySm, { color: t.body }]}>
          Sealed crates wait here until you open them. Each open rolls a rarity-weighted XP drop —
          rarer badges mean bigger XP.
        </Text>

        <GlassSurface style={{ padding: 16, gap: 12 }}>
          <Text style={[type.label, { color: t.placeholder }]}>Dev · Preview XP rarities</Text>
          <Text style={[type.bodySm, { color: t.body }]}>
            Local animation only — no XP is granted.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REWARD_RARITY_ORDER.map((rarity) => {
              const def = rarityDef(rarity);
              return (
                <Pressable
                  key={rarity}
                  onPress={() => handlePreviewRarity(rarity)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.75 : 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: `${def.color}77`,
                    backgroundColor: `${def.color}22`,
                    minWidth: '30%',
                    flexGrow: 1,
                    alignItems: 'center',
                    gap: 4,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${def.name} XP reveal`}
                >
                  <LevelBadge level={def.badgeLevel} size={28} centerLabel="XP" />
                  <Text
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: 10,
                      letterSpacing: 1,
                      color: def.glow,
                    }}
                  >
                    {def.name.toUpperCase()}
                  </Text>
                  <Text style={[type.dataSm, { color: t.body }]}>+{def.xpAmount}</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>

        {error ? (
          <Text style={[type.bodySm, { color: '#FF5C89' }]}>{error}</Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
        ) : (crates ?? []).length === 0 ? (
          <GlassSurface style={{ padding: 20, gap: 8 }}>
            <Text
              style={{
                fontFamily: fontFamily.displaySemi,
                fontSize: 18,
                color: t.heading,
              }}
            >
              No crates yet
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              Clear every daily exercise, then claim your reward from the Today tab.
            </Text>
          </GlassSurface>
        ) : (
          <>
            {sealed.length > 0 ? (
              <View className="gap-3">
                <Text style={[type.label, { color: t.placeholder }]}>Sealed</Text>
                {sealed.map((crate) => {
                  const display =
                    crate.id === spoilerCrateId ? asSealedSpoiler(crate) : crate;
                  return (
                    <CrateCard
                      key={crate.id}
                      crate={display}
                      onOpen={() => handleOpen(crate)}
                      isOpening={
                        (openCrate.isPending || revealVisible) &&
                        spoilerCrateId === crate.id
                      }
                    />
                  );
                })}
              </View>
            ) : null}

            {opened.length > 0 ? (
              <View className="gap-3">
                <Text style={[type.label, { color: t.placeholder }]}>Opened</Text>
                {opened.map((crate) => (
                  <CrateCard
                    key={crate.id}
                    crate={crate}
                    onOpen={() => handleOpen(crate)}
                    isOpening={false}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={revealVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleRevealClaim}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,15,0.92)' }}>
          {openingCrate || previewRewards ? (
            <RewardReveal
              key={revealKey}
              visible
              onClaim={handleRevealClaim}
              tier={revealTierFromCrate(openingCrate?.tier, revealRewards)}
              title={revealTitle}
              subtitle={revealSubtitle}
              kicker={previewRewards ? 'DEV PREVIEW' : 'REWARD CRATE OPENED'}
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
        <LevelUpOverlay
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
  const accent = xpReward ? rarityDef(xpReward.rarity).color : t.accent;

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
              backgroundColor: 'rgba(77,140,255,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(77,140,255,0.35)',
            }}
          >
            <Ionicons
              name={isSealed ? 'cube' : 'cube-outline'}
              size={22}
              color={t.accent}
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
            {isSealed ? 'SEALED' : 'OPENED'} · {crate.source_date}
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
