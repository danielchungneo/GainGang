import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
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

/** Shown once today's goals are cleared. Crate is auto-granted into inventory. */
export function DailyRewardClaimBanner({ goals }: DailyRewardClaimBannerProps) {
  const t = useThemeTokens();
  const rewardDate = todayISO();
  const { data: todaysCrate, isLoading } = useTodaysRewardCrate(rewardDate);
  const claimReward = useClaimDailyReward();
  const grantAttemptedRef = useRef(false);
  const claimMutateRef = useRef(claimReward.mutateAsync);
  claimMutateRef.current = claimReward.mutateAsync;

  const isComplete = areDailyGoalsComplete(goals);

  // Client sync: if the DB trigger already granted, this is a no-op.
  // If the user completed before the trigger existed, this backfills.
  useEffect(() => {
    if (!isComplete || todaysCrate || isLoading || claimReward.isPending) return;
    if (grantAttemptedRef.current) return;
    grantAttemptedRef.current = true;
    void claimMutateRef.current(rewardDate).catch(() => {
      grantAttemptedRef.current = false;
    });
  }, [isComplete, todaysCrate, isLoading, claimReward.isPending, rewardDate]);

  if (!isComplete) return null;

  const isSealed = todaysCrate?.status === 'sealed';
  const isGranted = !!todaysCrate;

  return (
    <GlassSurface style={{ padding: 18, gap: 12 }}>
      <View className="gap-1">
        <Text style={[type.labelSm, { color: t.accent }]}>
          {isGranted ? 'REWARD READY' : 'DAILY COMPLETE'}
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.displaySemi,
            fontSize: 20,
            lineHeight: 26,
            color: t.heading,
          }}
        >
          {isGranted
            ? isSealed
              ? 'Crate waiting in inventory'
              : "Today's crate is opened"
            : 'Adding crate to inventory…'}
        </Text>
        <Text style={[type.bodySm, { color: t.body }]}>
          {isGranted
            ? isSealed
              ? 'Open it from inventory to reveal what’s inside.'
              : 'Come back tomorrow after clearing your goals for another crate.'
            : 'You cleared every exercise today. Your sealed crate is on its way.'}
        </Text>
      </View>

      {isLoading || claimReward.isPending || !isGranted ? (
        <ActivityIndicator color={t.accent} />
      ) : (
        <Button
          label={isSealed ? 'OPEN INVENTORY' : 'VIEW INVENTORY'}
          onPress={() => router.push('/inventory')}
        />
      )}
    </GlassSurface>
  );
}
