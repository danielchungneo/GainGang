import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { Share } from 'react-native';

const PENDING_INVITE_KEY = 'pending_gang_invite_code';

/** App Store listing — set EXPO_PUBLIC_APP_STORE_URL once published. */
function appStoreUrl(): string | undefined {
  const value = process.env.EXPO_PUBLIC_APP_STORE_URL?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Deep link path that opens the invite confirm screen. */
export function buildGangInviteUrl(inviteCode: string): string {
  return Linking.createURL(`invite/${encodeURIComponent(inviteCode.trim().toUpperCase())}`);
}

export function buildGangInviteMessage(gangName: string, inviteCode: string): string {
  const inviteUrl = buildGangInviteUrl(inviteCode);
  const storeUrl = appStoreUrl();
  const lines = [
    `You're invited to join ${gangName} on GainGang!`,
    '',
    `Open this link to join: ${inviteUrl}`,
  ];
  if (storeUrl) {
    lines.push('', `Don't have the app yet? Download GainGang: ${storeUrl}`);
  }
  return lines.join('\n');
}

export async function shareGangInvite(gangName: string, inviteCode: string): Promise<void> {
  await Share.share({
    message: buildGangInviteMessage(gangName, inviteCode),
    title: `Join ${gangName} on GainGang`,
  });
}

export async function savePendingGangInvite(inviteCode: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_INVITE_KEY, inviteCode.trim().toUpperCase());
}

export async function consumePendingGangInvite(): Promise<string | null> {
  const code = await SecureStore.getItemAsync(PENDING_INVITE_KEY);
  if (code) await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
  return code;
}

export async function peekPendingGangInvite(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_INVITE_KEY);
}
