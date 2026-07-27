import * as SecureStore from 'expo-secure-store';
import { Share } from 'react-native';

const PENDING_INVITE_KEY = 'pending_gang_invite_code';

const DEFAULT_INVITE_BASE_URL =
  'https://uqgzzpxujaxgodfduczb.supabase.co/functions/v1/invite';

const DEFAULT_APP_STORE_URL =
  'https://apps.apple.com/us/app/gain-gang/id6792023328';

/** HTTPS invite endpoint (302 → gaingang://invite/CODE). */
function inviteBaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_INVITE_BASE_URL?.trim();
  return value && value.length > 0 ? value.replace(/\/$/, '') : DEFAULT_INVITE_BASE_URL;
}

function appStoreUrl(): string {
  const value = process.env.EXPO_PUBLIC_APP_STORE_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_APP_STORE_URL;
}

/** Deep link path that opens the invite confirm screen inside the app. */
export function buildGangInviteDeepLink(inviteCode: string): string {
  const code = inviteCode.trim().toUpperCase();
  return `gaingang://invite/${encodeURIComponent(code)}`;
}

/** Shareable HTTPS invite URL (redirects into the app with the invite code). */
export function buildGangInviteUrl(inviteCode: string): string {
  const code = inviteCode.trim().toUpperCase();
  return `${inviteBaseUrl()}?code=${encodeURIComponent(code)}`;
}

export function buildGangInviteMessage(gangName: string, inviteCode: string): string {
  const inviteUrl = buildGangInviteUrl(inviteCode);
  const storeUrl = appStoreUrl();
  return [
    `You're invited to join ${gangName} on GainGang!`,
    '',
    `Don't have the app yet? ${storeUrl}`,
    '',
    `Once you have the app, open this link to join the gang: ${inviteUrl}`,
  ].join('\n');
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
