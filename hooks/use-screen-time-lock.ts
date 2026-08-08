import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { areDailyGoalsComplete } from '@/hooks/use-reward-crates';
import {
  useMyTodaysDailyGoals,
  useMyUpcomingExerciseDates,
} from '@/hooks/use-weekly-plans';
import {
  isCelebrationBusy,
  subscribeCelebrationGate,
} from '@/lib/celebration-gate';
import {
  deriveScreenTimeLockStatus,
  getScreenTimePermissionGranted,
  getTemporaryUnlockState,
  hydrateTemporaryUnlockGrant,
  isScreenTimeLockSupported,
  loadScreenTimeLockPrefs,
  relockScreenTimeApps,
  requestScreenTimePermission,
  setScreenTimeLockEnabled,
  syncScreenTimeLockState,
  updateScreenTimeSelection,
  type ScreenTimeBlockedItem,
  type ScreenTimeLockPrefs,
  type ScreenTimeLockStatus,
} from '@/lib/screen-time-lock';

const DEFAULT_PREFS: ScreenTimeLockPrefs = {
  enabled: false,
  selectionData: '',
  blockedItems: [],
  unlockedDate: null,
  totalApps: 0,
  totalCategories: 0,
};

const EMPTY_DATES: string[] = [];

/** Pause after other celebrations clear before showing Focus unlock. */
const UNLOCK_AFTER_IDLE_MS = 500;

/**
 * Loads Focus lock prefs, syncs shields when goals / AppState change,
 * and exposes settings actions. Mount once near the root so unlock works
 * even when the Settings screen is not open.
 */
export function useScreenTimeLock() {
  const supported = isScreenTimeLockSupported();
  const { data: goals, isFetched: goalsFetched } = useMyTodaysDailyGoals();
  const { data: upcomingDates, isFetched: datesFetched } = useMyUpcomingExerciseDates();
  const hasExercisesToday = (goals?.length ?? 0) > 0;
  const goalsComplete = goals ? areDailyGoalsComplete(goals) : false;
  const datesWithExercises = upcomingDates ?? EMPTY_DATES;
  const scheduleReady = goalsFetched && datesFetched;

  const [prefs, setPrefs] = useState<ScreenTimeLockPrefs>(DEFAULT_PREFS);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);
  const [pendingUnlockCelebration, setPendingUnlockCelebration] = useState(false);
  const [temporaryUnlockActive, setTemporaryUnlockActive] = useState(false);
  const [temporaryUnlockRemainingSeconds, setTemporaryUnlockRemainingSeconds] =
    useState(0);
  const wasGoalsComplete = useRef<boolean | null>(null);

  const refreshTemporaryUnlock = useCallback(() => {
    if (!supported) {
      setTemporaryUnlockActive(false);
      setTemporaryUnlockRemainingSeconds(0);
      return { active: false, remainingSeconds: 0, grantedAt: null, expiresAt: null, budgetSeconds: 0 };
    }
    const wasActive = temporaryUnlockActive;
    const state = getTemporaryUnlockState();
    setTemporaryUnlockActive(state.active);
    setTemporaryUnlockRemainingSeconds(state.remainingSeconds);
    // When a grant just expired, re-sync so shields are definitely active.
    if (wasActive && !state.active) {
      void syncScreenTimeLockState({
        goalsComplete,
        hasExercisesToday,
        datesWithExercises,
      }).then((result) => {
        setPrefs(result.prefs);
      });
    }
    return state;
  }, [
    datesWithExercises,
    goalsComplete,
    hasExercisesToday,
    supported,
    temporaryUnlockActive,
  ]);

  const refreshPermission = useCallback(async () => {
    if (!supported) {
      setPermissionGranted(false);
      return false;
    }
    const granted = await getScreenTimePermissionGranted();
    setPermissionGranted(granted);
    return granted;
  }, [supported]);

  const queueUnlockCelebration = useCallback(() => {
    setPendingUnlockCelebration(true);
  }, []);

  const applySyncResult = useCallback(
    (result: { prefs: ScreenTimeLockPrefs; justUnlocked: boolean }) => {
      setPrefs(result.prefs);
      // Celebrate only when this sync newly unlocked for today (Focus lock on + goals done).
      if (result.justUnlocked) queueUnlockCelebration();
    },
    [queueUnlockCelebration],
  );

  const runSyncFromStorage = useCallback(async () => {
    if (!supported || !scheduleReady) return;
    refreshTemporaryUnlock();
    const result = await syncScreenTimeLockState({
      goalsComplete,
      hasExercisesToday,
      datesWithExercises,
    });
    applySyncResult(result);
    refreshTemporaryUnlock();
  }, [
    applySyncResult,
    datesWithExercises,
    goalsComplete,
    hasExercisesToday,
    refreshTemporaryUnlock,
    scheduleReady,
    supported,
  ]);

  const lockNow = useCallback(async () => {
    if (!supported) return;
    await relockScreenTimeApps();
    refreshTemporaryUnlock();
    await runSyncFromStorage();
  }, [refreshTemporaryUnlock, runSyncFromStorage, supported]);

  useEffect(() => {
    if (!supported) {
      setIsReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      await hydrateTemporaryUnlockGrant();
      const loaded = await loadScreenTimeLockPrefs();
      const granted = await getScreenTimePermissionGranted();
      if (cancelled) return;

      // Local opt-in can linger after Screen Time access is revoked — clear it.
      if (loaded.enabled && !granted) {
        const result = await setScreenTimeLockEnabled(false, false, {
          hasExercisesToday: false,
          datesWithExercises: [],
        });
        if (cancelled) return;
        setPrefs(result.prefs);
        setPermissionGranted(false);
      } else {
        setPrefs(loaded);
        setPermissionGranted(granted);
      }
      refreshTemporaryUnlock();
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTemporaryUnlock, supported]);

  useEffect(() => {
    if (!supported || !isReady || !scheduleReady) return;
    void runSyncFromStorage();
  }, [goalsComplete, hasExercisesToday, isReady, runSyncFromStorage, scheduleReady, supported]);

  // Backup: if goals flip incomplete → complete while Focus lock is armed, queue
  // the unlock celebration even when sync races ahead of the celebration overlays.
  useEffect(() => {
    if (!supported || !isReady || !scheduleReady) return;

    if (wasGoalsComplete.current === null) {
      wasGoalsComplete.current = goalsComplete;
      return;
    }

    const newlyComplete =
      goalsComplete &&
      !wasGoalsComplete.current &&
      hasExercisesToday &&
      prefs.enabled &&
      prefs.blockedItems.length > 0 &&
      permissionGranted;

    wasGoalsComplete.current = goalsComplete;

    if (newlyComplete) queueUnlockCelebration();
  }, [
    goalsComplete,
    hasExercisesToday,
    isReady,
    permissionGranted,
    prefs.blockedItems.length,
    prefs.enabled,
    queueUnlockCelebration,
    scheduleReady,
    supported,
  ]);

  // Show Focus unlock only after streak / goal / level-up / reveal overlays clear.
  useEffect(() => {
    if (!pendingUnlockCelebration || showUnlockCelebration) return;

    let showTimer: ReturnType<typeof setTimeout> | null = null;

    function tryShowUnlock() {
      if (showTimer) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      if (isCelebrationBusy()) return;

      showTimer = setTimeout(() => {
        showTimer = null;
        if (isCelebrationBusy()) return;
        setShowUnlockCelebration(true);
        setPendingUnlockCelebration(false);
      }, UNLOCK_AFTER_IDLE_MS);
    }

    tryShowUnlock();
    const unsubscribe = subscribeCelebrationGate(tryShowUnlock);

    return () => {
      unsubscribe();
      if (showTimer) clearTimeout(showTimer);
    };
  }, [pendingUnlockCelebration, showUnlockCelebration]);

  // Live countdown while a temporary unlock is active (1s tick for wall-clock expiry).
  useEffect(() => {
    if (!supported || !isReady) return;
    refreshTemporaryUnlock();
    const interval = setInterval(() => {
      refreshTemporaryUnlock();
    }, temporaryUnlockActive ? 1_000 : 5_000);
    return () => clearInterval(interval);
  }, [isReady, refreshTemporaryUnlock, supported, temporaryUnlockActive]);

  useEffect(() => {
    if (!supported || !isReady) return;

    function onAppStateChange(state: AppStateStatus) {
      if (state !== 'active') return;
      void (async () => {
        const granted = await refreshPermission();
        if (!granted) {
          const current = await loadScreenTimeLockPrefs();
          if (current.enabled) {
            const result = await setScreenTimeLockEnabled(false, goalsComplete, {
              hasExercisesToday,
              datesWithExercises,
            });
            setPrefs(result.prefs);
            return;
          }
        }
        await runSyncFromStorage();
      })();
    }

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [
    datesWithExercises,
    goalsComplete,
    hasExercisesToday,
    isReady,
    refreshPermission,
    runSyncFromStorage,
    supported,
  ]);

  const status: ScreenTimeLockStatus = deriveScreenTimeLockStatus({
    prefs,
    permissionGranted,
    goalsComplete,
    hasExercisesToday,
    temporaryUnlockActive,
  });

  const enable = useCallback(async () => {
    if (!supported) return false;
    setIsUpdating(true);
    try {
      const granted = await requestScreenTimePermission();
      // Re-read native status — request can succeed in UI while status stays denied.
      const confirmed = granted && (await getScreenTimePermissionGranted());
      setPermissionGranted(confirmed);
      if (!confirmed) return false;

      try {
        const Notifications = await import('expo-notifications');
        await Notifications.requestPermissionsAsync();
      } catch {
        // Non-fatal; Focus lock still works, but the shield button may not notify.
      }

      const result = await setScreenTimeLockEnabled(true, goalsComplete, {
        hasExercisesToday,
        datesWithExercises,
      });
      // Enabling while goals are already done unlocks immediately — don't celebrate
      // that path; celebration is for completing tasks while Focus lock is active.
      setPrefs(result.prefs);
      return true;
    } finally {
      setIsUpdating(false);
    }
  }, [datesWithExercises, goalsComplete, hasExercisesToday, supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setIsUpdating(true);
    try {
      const result = await setScreenTimeLockEnabled(false, goalsComplete, {
        hasExercisesToday,
        datesWithExercises,
      });
      setPrefs(result.prefs);
    } finally {
      setIsUpdating(false);
    }
  }, [datesWithExercises, goalsComplete, hasExercisesToday, supported]);

  const saveSelection = useCallback(
    async (input: {
      selectionData: string;
      blockedItems: ScreenTimeBlockedItem[];
      totalApps: number;
      totalCategories: number;
    }) => {
      if (!supported) return;
      setIsUpdating(true);
      try {
        const result = await updateScreenTimeSelection({
          ...input,
          goalsComplete,
          hasExercisesToday,
          datesWithExercises,
        });
        setPrefs(result.prefs);
      } finally {
        setIsUpdating(false);
      }
    },
    [datesWithExercises, goalsComplete, hasExercisesToday, supported],
  );

  const dismissUnlockCelebration = useCallback(() => {
    setShowUnlockCelebration(false);
    setPendingUnlockCelebration(false);
  }, []);

  return {
    supported,
    isReady,
    isUpdating,
    prefs,
    permissionGranted,
    status,
    goalsComplete,
    temporaryUnlockActive,
    temporaryUnlockRemainingSeconds,
    refreshTemporaryUnlock,
    lockNow,
    showUnlockCelebration,
    dismissUnlockCelebration,
    enable,
    disable,
    saveSelection,
    refreshPermission,
  };
}
