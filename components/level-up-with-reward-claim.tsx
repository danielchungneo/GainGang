import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';

import { LevelUpOverlay } from '@/components/level-up-overlay';
import { RewardReveal, type RewardRowData } from '@/components/reward-reveal';
import {
  useLevelUpRewardCrate,
  useOpenRewardCrate,
} from '@/hooks/use-reward-crates';
import {
  emblemLevelFromRewards,
  parseCrateContents,
  rarityDef,
  raritySubtitle,
  revealTierFromCrate,
  rewardAccentColor,
  type CrateReward,
  type RewardRarity,
} from '@/lib/rewards';
import type { UserRewardCrate } from '@/types';

interface LevelUpWithRewardClaimProps {
  visible: boolean;
  fromLevel: number;
  toLevel: number;
  onDismiss: () => void;
}

function rewardsToRevealRows(rewards: CrateReward[]): RewardRowData[] {
  return rewards.map((reward) => ({
    label: reward.label,
    value: reward.value,
    color: rewardAccentColor(reward),
    badgeLevel: reward.kind === 'xp' ? reward.badgeLevel : undefined,
  }));
}

function isRewardRarity(value: string): value is RewardRarity {
  return ['E', 'D', 'C', 'B', 'A', 'S'].includes(value);
}

/**
 * Level-up celebration that auto-loads the sealed level-up crate for `toLevel`
 * and offers a CLAIM REWARD CTA that opens the reveal in-place.
 */
export function LevelUpWithRewardClaim({
  visible,
  fromLevel,
  toLevel,
  onDismiss,
}: LevelUpWithRewardClaimProps) {
  const { data: levelCrate, refetch } = useLevelUpRewardCrate(visible ? toLevel : undefined);
  const openCrate = useOpenRewardCrate();

  const [openingCrate, setOpeningCrate] = useState<UserRewardCrate | null>(null);
  const [revealVisible, setRevealVisible] = useState(false);

  // XP trigger grants the crate asynchronously relative to the overlay mount.
  useEffect(() => {
    if (!visible) return;
    void refetch();
    const poll = setInterval(() => void refetch(), 450);
    const stop = setTimeout(() => clearInterval(poll), 4000);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [visible, toLevel, refetch]);

  const sealedCrate =
    levelCrate?.status === 'sealed' ? levelCrate : null;
  const tierLabel =
    sealedCrate && isRewardRarity(sealedCrate.tier)
      ? rarityDef(sealedCrate.tier).name
      : null;

  const revealRewards = openingCrate
    ? (parseCrateContents(openingCrate.contents)?.rewards ?? [])
    : [];

  async function handleClaim(crateId: string) {
    setRevealVisible(true);
    setOpeningCrate(null);
    try {
      const opened = await openCrate.mutateAsync(crateId);
      setOpeningCrate(opened);
      void refetch();
    } catch {
      setRevealVisible(false);
      onDismiss();
      router.push('/inventory');
    }
  }

  function handleRevealClaim() {
    setRevealVisible(false);
    setOpeningCrate(null);
    onDismiss();
  }

  return (
    <>
      <LevelUpOverlay
        visible={visible && !revealVisible}
        fromLevel={fromLevel}
        toLevel={toLevel}
        onDismiss={onDismiss}
        rewardCrateId={sealedCrate?.id ?? null}
        rewardCrateTierLabel={tierLabel}
        onClaimReward={(id) => void handleClaim(id)}
      />

      <Modal
        visible={revealVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleRevealClaim}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,15,0.92)' }}>
          {openingCrate ? (
            <RewardReveal
              key={openingCrate.id}
              visible
              onClaim={handleRevealClaim}
              tier={revealTierFromCrate(openingCrate.tier, revealRewards)}
              title={openingCrate.title}
              subtitle={
                raritySubtitle(revealRewards) ??
                openingCrate.subtitle ??
                'Opening your reward…'
              }
              kicker="LEVEL-UP CRATE OPENED"
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
    </>
  );
}
