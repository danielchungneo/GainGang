import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { areDailyGoalsComplete } from '@/hooks/use-reward-crates';
import { useMyTodaysDailyGoals } from '@/hooks/use-weekly-plans';
import {
  deriveScreenTimeLockStatus,
  getScreenTimePermissionGranted,
  isScreenTimeLockSupported,
  loadScreenTimeLockPrefs,
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

/**
 * Loads Focus lock prefs, syncs shields when goals / AppState change,
 * and exposes settings actions. Mount once near the root so unlock works
 * even when the Settings screen is not open.
 */
export function useScreenTimeLock() {
  const supported = isScreenTimeLockSupported();
  const { data: goals } = useMyTodaysDailyGoals();
  const goalsComplete = goals ? areDailyGoalsComplete(goals) : false;

  const [prefs, setPrefs] = useState<ScreenTimeLockPrefs>(DEFAULT_PREFS);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);

  const refreshPermission = useCallback(async () => {
    if (!supported) {
      setPermissionGranted(false);
      return false;
    }
    const granted = await getScreenTimePermissionGranted();
    setPermissionGranted(granted);
    return granted;
  }, [supported]);

  const applySyncResult = useCallback(
    (result: { prefs: ScreenTimeLockPrefs; justUnlocked: boolean }) => {
      setPrefs(result.prefs);
      // Celebrate only when this sync newly unlocked for today (Focus lock on + goals done).
      // Delay so the daily-goal celebration can play first when both fire together.
      if (result.justUnlocked) {
        setTimeout(() => setShowUnlockCelebration(true), 2800);
      }
    },
    [],
  );

  const runSyncFromStorage = useCallback(async () => {
    if (!supported) return;
    const result = await syncScreenTimeLockState({ goalsComplete });
    applySyncResult(result);
  }, [applySyncResult, goalsComplete, supported]);

  useEffect(() => {
    if (!supported) {
      setIsReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      const loaded = await loadScreenTimeLockPrefs();
      const granted = await getScreenTimePermissionGranted();
      if (cancelled) return;
      setPrefs(loaded);
      setPermissionGranted(granted);
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [supported]);

  useEffect(() => {
    if (!supported || !isReady) return;
    void runSyncFromStorage();
  }, [goalsComplete, isReady, runSyncFromStorage, supported]);

  useEffect(() => {
    if (!supported || !isReady) return;

    function onAppStateChange(state: AppStateStatus) {
      if (state !== 'active') return;
      void (async () => {
        await refreshPermission();
        await runSyncFromStorage();
      })();
    }

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [isReady, refreshPermission, runSyncFromStorage, supported]);

  const status: ScreenTimeLockStatus = deriveScreenTimeLockStatus({
    prefs,
    permissionGranted,
    goalsComplete,
  });

  const enable = useCallback(async () => {
    if (!supported) return false;
    setIsUpdating(true);
    try {
      const granted = await requestScreenTimePermission();
      setPermissionGranted(granted);
      if (!granted) return false;

      try {
        const Notifications = await import('expo-notifications');
        await Notifications.requestPermissionsAsync();
      } catch {
        // Non-fatal; Focus lock still works, but the shield button may not notify.
      }

      const result = await setScreenTimeLockEnabled(true, goalsComplete);
      // Enabling while goals are already done unlocks immediately — don't celebrate
      // that path; celebration is for completing tasks while Focus lock is active.
      setPrefs(result.prefs);
      return true;
    } finally {
      setIsUpdating(false);
    }
  }, [goalsComplete, supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setIsUpdating(true);
    try {
      const result = await setScreenTimeLockEnabled(false, goalsComplete);
      setPrefs(result.prefs);
    } finally {
      setIsUpdating(false);
    }
  }, [goalsComplete, supported]);

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
        });
        setPrefs(result.prefs);
      } finally {
        setIsUpdating(false);
      }
    },
    [goalsComplete, supported],
  );

  const dismissUnlockCelebration = useCallback(() => {
    setShowUnlockCelebration(false);
  }, []);

  return {
    supported,
    isReady,
    isUpdating,
    prefs,
    permissionGranted,
    status,
    goalsComplete,
    showUnlockCelebration,
    dismissUnlockCelebration,
    enable,
    disable,
    saveSelection,
    refreshPermission,
  };
}
