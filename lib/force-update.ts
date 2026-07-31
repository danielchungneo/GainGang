import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const FORCE_UPDATE_SETTINGS_KEY = 'force_update';

/** Floor used when remote config is unavailable. */
export const DEFAULT_MIN_STORE_VERSION = '1.0.1';

const DEFAULT_IOS_STORE_URL =
  'https://apps.apple.com/us/app/gain-gang/id6792023328';
const DEFAULT_ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.danielchungneo.gaingang';
const DEFAULT_MESSAGE =
  'A new version of GainGang is required. Update from the store to continue.';

export interface ForceUpdateConfig {
  minIosVersion: string;
  minAndroidVersion: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  message: string;
}

export interface ForceUpdateDecision {
  isRequired: boolean;
  installedVersion: string;
  minimumVersion: string;
  storeUrl: string;
  message: string;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return fallback;
}

export function getDefaultForceUpdateConfig(): ForceUpdateConfig {
  return {
    minIosVersion: DEFAULT_MIN_STORE_VERSION,
    minAndroidVersion: DEFAULT_MIN_STORE_VERSION,
    iosStoreUrl:
      process.env.EXPO_PUBLIC_APP_STORE_URL?.trim() || DEFAULT_IOS_STORE_URL,
    androidStoreUrl:
      process.env.EXPO_PUBLIC_PLAY_STORE_URL?.trim() || DEFAULT_ANDROID_STORE_URL,
    message: DEFAULT_MESSAGE,
  };
}

export function parseForceUpdateConfig(value: unknown): ForceUpdateConfig {
  const defaults = getDefaultForceUpdateConfig();
  if (!value || typeof value !== 'object') return defaults;

  const raw = value as Record<string, unknown>;
  return {
    minIosVersion: asNonEmptyString(raw.min_ios_version, defaults.minIosVersion),
    minAndroidVersion: asNonEmptyString(
      raw.min_android_version,
      defaults.minAndroidVersion,
    ),
    iosStoreUrl: asNonEmptyString(raw.ios_store_url, defaults.iosStoreUrl),
    androidStoreUrl: asNonEmptyString(
      raw.android_store_url,
      defaults.androidStoreUrl,
    ),
    message: asNonEmptyString(raw.message, defaults.message),
  };
}

/** Parse "1.2.3" / "1.2" into numeric parts for comparison. */
export function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .split('.')
    .map((part) => {
      const match = /^(\d+)/.exec(part);
      return match ? Number(match[1]) : 0;
    });
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

/**
 * Native binary marketing version from the store build.
 * Prefer this over expoConfig.version so an OTA cannot fake a store update.
 */
export function getInstalledNativeVersion(): string {
  return Constants.nativeApplicationVersion?.trim() || '0.0.0';
}

export function decideForceUpdate(
  config: ForceUpdateConfig,
  installedVersion = getInstalledNativeVersion(),
  platform: typeof Platform.OS = Platform.OS,
): ForceUpdateDecision {
  const isIos = platform === 'ios';
  const minimumVersion = isIos
    ? config.minIosVersion
    : config.minAndroidVersion;
  const storeUrl = isIos ? config.iosStoreUrl : config.androidStoreUrl;

  return {
    isRequired: compareVersions(installedVersion, minimumVersion) < 0,
    installedVersion,
    minimumVersion,
    storeUrl,
    message: config.message,
  };
}

export async function fetchForceUpdateConfig(): Promise<ForceUpdateConfig> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', FORCE_UPDATE_SETTINGS_KEY)
    .maybeSingle();

  if (error || !data) return getDefaultForceUpdateConfig();
  return parseForceUpdateConfig(data.value);
}
