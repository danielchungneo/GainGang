import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, GlassSurface } from '@/components/ui';
import {
  areDailyGoalsComplete,
  useClaimDailyReward,
  useTodaysRewardCrate,
} from '@/hooks/use-reward-crates';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { todayISO } from '@/lib/format';
import { fontFamily, type } from '@/lib/gaingang-theme';
import type { DailyGoalWithProgress } from '@/types';

export interface DailyRewardClaimBannerProps {
  goals: DailyGoalWithProgress[];
}

export function DailyRewardClaimBanner({ goals }: DailyRewardClaimBannerProps) {
  const t = useThemeTokens();
  const rewardDate = todayISO();
  const { data: todaysCrate, isLoading } = useTodaysRewardCrate(rewardDate);
  const claimReward = useClaimDailyReward();
  const [error, setError] = useState<string | null>(null);

  const isComplete = areDailyGoalsComplete(goals);
  if (!isComplete) return null;

  const isClaimed = !!todaysCrate;
  const isSealed = todaysCrate?.status === 'sealed';

  async function handleClaim() {
    setError(null);
    try {
      await claimReward.mutateAsync(rewardDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim reward');
    }
  }

  return (
    <GlassSurface style={{ padding: 18, gap: 12 }}>
      <View className="gap-1">
        <Text style={[type.labelSm, { color: t.accent }]}>
          {isClaimed ? 'REWARD CLAIMED' : 'DAILY REWARD READY'}
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.displaySemi,
            fontSize: 20,
            lineHeight: 26,
            color: t.heading,
          }}
        >
          {isClaimed
            ? isSealed
              ? 'Crate waiting in inventory'
              : 'Today\'s crate is opened'
            : 'Claim your daily reward crate'}
        </Text>
        <Text style={[type.bodySm, { color: t.body }]}>
          {isClaimed
            ? isSealed
              ? 'Open it from inventory to reveal what’s inside.'
              : 'Come back tomorrow after clearing your goals for another crate.'
            : 'You cleared every exercise today. Claim a sealed crate for your inventory.'}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={t.accent} />
      ) : isClaimed ? (
        <Button
          label={isSealed ? 'OPEN INVENTORY' : 'VIEW INVENTORY'}
          onPress={() => router.push('/inventory')}
        />
      ) : (
        <Button
          label={claimReward.isPending ? 'CLAIMING…' : 'CLAIM REWARD'}
          onPress={handleClaim}
          disabled={claimReward.isPending}
        />
      )}

      {error ? (
        <Text style={[type.bodySm, { color: '#FF5C89' }]}>{error}</Text>
      ) : null}
    </GlassSurface>
  );
}
