import { useCallback, useEffect, useState } from 'react';

import { AchievementUnlockOverlay } from '@/components/achievement-unlock-overlay';
import {
  getAchievementUnlockQueueLength,
  shiftAchievementUnlock,
  subscribeAchievementUnlockQueue,
} from '@/lib/achievements/unlock-queue';
import {
  isCelebrationBusy,
  subscribeCelebrationGate,
} from '@/lib/celebration-gate';
import type { Achievement } from '@/types';

/**
 * Root host that drains the achievement unlock queue one overlay at a time.
 * Waits until other celebrations finish so streak → goal → level-up stay first.
 * Multiple unlocks from one award call play sequentially (dismiss → next).
 */
export function AchievementUnlockHost() {
  const [current, setCurrent] = useState<Achievement | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [gateTick, setGateTick] = useState(0);
  const [queueTick, setQueueTick] = useState(0);

  useEffect(() => subscribeAchievementUnlockQueue(() => setQueueTick((n) => n + 1)), []);
  useEffect(() => subscribeCelebrationGate(() => setGateTick((n) => n + 1)), []);

  const showNext = useCallback((next: Achievement) => {
    setCurrent(next);
    setPlayKey((k) => k + 1);
  }, []);

  // Idle drain: start the first queued unlock once other celebrations clear.
  useEffect(() => {
    if (current) return;
    if (getAchievementUnlockQueueLength() === 0) return;
    if (isCelebrationBusy()) return;

    const next = shiftAchievementUnlock();
    if (!next) return;
    showNext(next);
  }, [current, gateTick, queueTick, showNext]);

  const dismiss = useCallback(() => {
    // Hand off immediately so the next badge plays without waiting on our own
    // celebration-gate cleanup (and without closing the Modal in between).
    if (getAchievementUnlockQueueLength() > 0) {
      const next = shiftAchievementUnlock();
      if (next) {
        showNext(next);
        return;
      }
    }
    setCurrent(null);
  }, [showNext]);

  return (
    <AchievementUnlockOverlay
      key={playKey}
      visible={!!current}
      achievement={current}
      onDismiss={dismiss}
    />
  );
}
