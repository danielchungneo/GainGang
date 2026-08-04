import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ScreenTimeUnlockOverlay } from '@/components/screen-time-unlock-overlay';
import { useScreenTimeLock } from '@/hooks/use-screen-time-lock';

const PENDING_UNLOCK_NOTIFICATION_ID = 'expo.appblocker.pendingUnlock.local';

function openEarnScreenTime() {
  try {
    router.push('/earn-screen-time');
  } catch {
    // Navigation may not be ready yet on cold start; ignore.
  }
}

function isFocusLockNotification(response: Notifications.NotificationResponse): boolean {
  const request = response.notification.request;
  if (request.identifier === PENDING_UNLOCK_NOTIFICATION_ID) return true;
  const data = request.content.data as Record<string, unknown> | undefined;
  return (
    data?.gaingangFocusLock === true ||
    data?.link === '/(tabs)' ||
    data?.link === '/unlock' ||
    data?.link === '/earn-screen-time'
  );
}

/** Keeps Focus lock shields in sync and routes shield-button taps into the earn flow. */
export function ScreenTimeLockSync() {
  const { showUnlockCelebration, dismissUnlockCelebration } = useScreenTimeLock();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let unlockSub: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const blocker = require('expo-app-blocker') as typeof import('expo-app-blocker');
      if (blocker.checkAndClearPendingUnlock()) {
        requestAnimationFrame(() => openEarnScreenTime());
      }
      unlockSub = blocker.addPendingUnlockListener(() => {
        openEarnScreenTime();
      });
    } catch {
      // Native module unavailable (Expo Go / missing rebuild).
    }

    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!isFocusLockNotification(response)) return;
      openEarnScreenTime();
    });

    return () => {
      unlockSub?.remove();
      notifSub.remove();
    };
  }, []);

  return (
    <ScreenTimeUnlockOverlay
      visible={showUnlockCelebration}
      onDismiss={dismissUnlockCelebration}
    />
  );
}
