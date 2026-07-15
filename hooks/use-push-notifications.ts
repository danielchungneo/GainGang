import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import {
  getPushPermissionStatus,
  pathForNotificationData,
  registerForPushNotifications,
  type PushPermissionStatus,
} from '@/lib/push-notifications';

/**
 * Registers the device for Expo push when the user is signed in and permission
 * is already granted (or was just granted from Settings). Also opens deep links
 * when a notification is tapped.
 */
export function usePushNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [permission, setPermission] = useState<PushPermissionStatus>('undetermined');
  const [isRegistering, setIsRegistering] = useState(false);
  const handledResponse = useRef(false);

  useEffect(() => {
    void getPushPermissionStatus().then(setPermission);
  }, []);

  useEffect(() => {
    if (!userId || permission !== 'granted') return;

    let cancelled = false;
    setIsRegistering(true);
    void registerForPushNotifications()
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setIsRegistering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, permission]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const path = pathForNotificationData(data);
      if (path) router.push(path as never);
    });

    if (!handledResponse.current) {
      handledResponse.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, unknown>;
        const path = pathForNotificationData(data);
        if (path) router.push(path as never);
      });
    }

    return () => sub.remove();
  }, []);

  async function enablePushNotifications(): Promise<boolean> {
    setIsRegistering(true);
    try {
      const token = await registerForPushNotifications();
      const next = await getPushPermissionStatus();
      setPermission(next);
      return !!token;
    } finally {
      setIsRegistering(false);
    }
  }

  return {
    permission,
    isRegistering,
    enablePushNotifications,
    refreshPermission: async () => setPermission(await getPushPermissionStatus()),
  };
}
