import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { LevelUpOverlay } from '@/components/level-up-overlay';
import { useAuth } from '@/context/auth-context';
import { useCelebrationGate } from '@/hooks/use-celebration-gate';
import { useLevelUpRewardCrate } from '@/hooks/use-reward-crates';
import { queryKeys } from '@/lib/query-keys';
import { rarityDef, type RewardRarity } from '@/lib/rewards';

interface LevelUpWithRewardClaimProps {
  visible: boolean;
  fromLevel: number;
  toLevel: number;
  onDismiss: () => void;
}

function isRewardRarity(value: string): value is RewardRarity {
  return ['E', 'D', 'C', 'B', 'A', 'S'].includes(value);
}

/**
 * Level-up celebration that waits for the sealed level-up crate for `toLevel`.
 * CLAIM REWARD keeps the crate sealed in inventory instead of opening it.
 */
export function LevelUpWithRewardClaim({
  visible,
  fromLevel,
  toLevel,
  onDismiss,
}: LevelUpWithRewardClaimProps) {
  useCelebrationGate(visible);

  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: levelCrate, refetch } = useLevelUpRewardCrate(visible ? toLevel : undefined);

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

  const sealedCrate = levelCrate?.status === 'sealed' ? levelCrate : null;
  const tierLabel =
    sealedCrate && isRewardRarity(sealedCrate.tier)
      ? rarityDef(sealedCrate.tier).name
      : null;

  function handleClaim() {
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewardCrates(userId) });
    }
    onDismiss();
    router.push('/inventory');
  }

  return (
    <LevelUpOverlay
      visible={visible}
      fromLevel={fromLevel}
      toLevel={toLevel}
      onDismiss={onDismiss}
      rewardCrateId={sealedCrate?.id ?? null}
      rewardCrateTierLabel={tierLabel}
      onClaimReward={() => handleClaim()}
    />
  );
}
