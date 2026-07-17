import { useCallback, useState } from 'react';

import type { GoalCompleteExerciseTarget } from '@/components/goal-complete-overlay';
import {
  resolvePostSaveCelebration,
  type DailyGoalSaveCelebrationInput,
  type StreakContinuePayload,
} from '@/lib/daily-goal-celebration';

export interface DailyGoalCelebrationState {
  title: string;
  xpEarned: number;
  exercises: GoalCompleteExerciseTarget[];
}

export function useDailyGoalSaveCelebrations() {
  const [streakContinue, setStreakContinue] = useState<StreakContinuePayload | null>(null);
  const [streakKey, setStreakKey] = useState(0);
  const [celebration, setCelebration] = useState<DailyGoalCelebrationState | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [levelUp, setLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(null);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [pendingCelebration, setPendingCelebration] = useState<DailyGoalCelebrationState | null>(
    null,
  );
  const [pendingLevelUp, setPendingLevelUp] = useState<{ fromLevel: number; toLevel: number } | null>(
    null,
  );

  const handleActivitySaved = useCallback((input: DailyGoalSaveCelebrationInput) => {
    const { celebration: nextCelebration, levelUp: nextLevelUp, streakContinue: nextStreak } =
      resolvePostSaveCelebration(input);

    // Queue: streak → goal complete → level up
    if (nextStreak) {
      if (nextCelebration) setPendingCelebration(nextCelebration);
      if (nextLevelUp) setPendingLevelUp(nextLevelUp);
      setStreakContinue(nextStreak);
      setStreakKey((k) => k + 1);
      return;
    }

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
  }, []);

  const dismissStreakContinue = useCallback(() => {
    setStreakContinue(null);
    if (pendingCelebration) {
      setCelebration(pendingCelebration);
      setPendingCelebration(null);
      setCelebrationKey((k) => k + 1);
      return;
    }
    if (pendingLevelUp) {
      setLevelUp(pendingLevelUp);
      setPendingLevelUp(null);
      setLevelUpKey((k) => k + 1);
    }
  }, [pendingCelebration, pendingLevelUp]);

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
    streakContinue,
    streakKey,
    celebration,
    celebrationKey,
    levelUp,
    levelUpKey,
    handleActivitySaved,
    dismissStreakContinue,
    dismissCelebration,
    dismissLevelUp,
  };
}
