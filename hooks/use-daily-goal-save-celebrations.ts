import { useCallback, useState } from 'react';

import type { GoalCompleteExerciseTarget } from '@/components/goal-complete-overlay';
import { useProfile } from '@/hooks/use-profile';
import {
  resolvePostSaveCelebration,
  type DailyGoalSaveCelebrationInput,
} from '@/lib/daily-goal-celebration';

export interface DailyGoalCelebrationState {
  title: string;
  xpEarned: number;
  exercises: GoalCompleteExerciseTarget[];
}

export function useDailyGoalSaveCelebrations() {
  const { data: profile } = useProfile();
  const [celebration, setCelebration] = useState<DailyGoalCelebrationState | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [pendingLevelUp, setPendingLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(
    null,
  );

  const handleActivitySaved = useCallback(
    (input: Omit<DailyGoalSaveCelebrationInput, 'profileXp'>) => {
      const { celebration: nextCelebration, levelUp: nextLevelUp } = resolvePostSaveCelebration({
        ...input,
        profileXp: profile?.xp ?? 0,
      });

      if (nextCelebration) {
        if (nextLevelUp) setPendingLevelUp(nextLevelUp);
        setCelebration(nextCelebration);
        setCelebrationKey((k) => k + 1);
        return;
      }

      if (nextLevelUp) {
        setLevelUp(nextLevelUp);
        setLevelUpKey((k) => k + 1);
      }
    },
    [profile?.xp],
  );

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
    if (pendingLevelUp) {
      setLevelUp(pendingLevelUp);
      setPendingLevelUp(null);
      setLevelUpKey((k) => k + 1);
    }
  }, [pendingLevelUp]);

  const dismissLevelUp = useCallback(() => {
    setLevelUp(null);
  }, []);

  return {
    celebration,
    celebrationKey,
    levelUp,
    levelUpKey,
    handleActivitySaved,
    dismissCelebration,
    dismissLevelUp,
  };
}
