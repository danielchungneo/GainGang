import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';

import {
  GoalCompleteOverlay,
  type GoalCompleteExerciseTarget,
} from '@/components/goal-complete-overlay';
import { useAuth } from '@/context/auth-context';
import { useCelebrationGate } from '@/hooks/use-celebration-gate';
import { useClaimDailyReward, useTodaysRewardCrate } from '@/hooks/use-reward-crates';
import { todayISO } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { rarityDef, type RewardRarity } from '@/lib/rewards';

interface DayCompleteWithRewardClaimProps {
  visible: boolean;
  questTitle: string;
  xpEarned: number;
  exercises: GoalCompleteExerciseTarget[];
  /** YYYY-MM-DD of the completed day — defaults to today. */
  rewardDate?: string;
  onDismiss: () => void;
}

function isRewardRarity(value: string): value is RewardRarity {
  return ['E', 'D', 'C', 'B', 'A', 'S'].includes(value);
}

/**
 * Day-clear celebration that waits for the sealed daily uncommon crate.
 * CLAIM REWARD keeps the crate sealed and opens inventory (same as level-up).
 */
export function DayCompleteWithRewardClaim({
  visible,
  questTitle,
  xpEarned,
  exercises,
  rewardDate = todayISO(),
  onDismiss,
}: DayCompleteWithRewardClaimProps) {
  useCelebrationGate(visible);

  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: dailyCrate, refetch } = useTodaysRewardCrate(rewardDate);
  const claimDailyReward = useClaimDailyReward();

  // Auto-grant runs on the activity trigger — poll briefly until the crate lands.
  useEffect(() => {
    if (!visible) return;
    void refetch();
    const poll = setInterval(() => void refetch(), 450);
    const stop = setTimeout(() => clearInterval(poll), 4000);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [visible, rewardDate, refetch]);

  const sealedCrate = dailyCrate?.status === 'sealed' ? dailyCrate : null;
  const tierLabel =
    sealedCrate && isRewardRarity(sealedCrate.tier)
      ? rarityDef(sealedCrate.tier).name
      : 'Uncommon';

  async function handleClaim() {
    try {
      if (!sealedCrate) {
        await claimDailyReward.mutateAsync(rewardDate);
      }
    } catch {
      // Crate may already exist or grant may still be racing — still open inventory.
    }

    if (userId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewardCrates(userId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.todaysRewardCrate(userId, rewardDate),
      });
    }
    onDismiss();
    router.push('/inventory');
  }

  return (
    <GoalCompleteOverlay
      visible={visible}
      variant="day"
      questTitle={questTitle}
      questKind="Day Clear"
      xpEarned={xpEarned}
      exercises={exercises}
      rewardCrateId={sealedCrate?.id ?? null}
      rewardCrateTierLabel={tierLabel}
      onClaimReward={() => {
        void handleClaim();
      }}
      onDismiss={onDismiss}
    />
  );
}
