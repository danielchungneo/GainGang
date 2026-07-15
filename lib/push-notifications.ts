import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

function resolveProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId
  );
}

function resolvePlatform(): 'ios' | 'android' | 'web' | 'unknown' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

/** Current OS notification permission. */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!Device.isDevice) return 'unavailable';
  if (Platform.OS === 'web') return 'unavailable';

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Ask for push permission, obtain an Expo push token, and store it for the
 * signed-in user. Returns null when permission is refused or the device
 * cannot receive pushes (simulators / web).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'GainGang',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let finalStatus = current.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = resolveProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResponse.data;
  if (!token) return null;

  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: resolvePlatform(),
  });
  if (error) throw error;

  return token;
}

/** Deep-link path hints encoded into push payloads by the dispatch edge function. */
export function pathForNotificationData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;

  const type = typeof data.type === 'string' ? data.type : null;
  const activityId = typeof data.activityId === 'string' ? data.activityId : null;
  const gangId = typeof data.gangId === 'string' ? data.gangId : null;

  // Daily complete (and other gang alerts) land on Groups → Progress.
  if (type === 'daily_goal' && gangId) {
    return `/(tabs)/groups?gangId=${encodeURIComponent(gangId)}&tab=progress`;
  }

  if (activityId) return `/activity/${activityId}`;

  if (gangId) {
    return `/(tabs)/groups?gangId=${encodeURIComponent(gangId)}&tab=progress`;
  }

  return '/alerts';
}
