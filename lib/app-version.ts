import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface AppVersionInfo {
  /** Marketing version from app.json (e.g. 1.0.0). */
  version: string;
  /** Native build number (iOS CFBundleVersion / Android versionCode). */
  buildNumber: string | null;
  /** Short id of the running EAS Update, or null when on the embedded binary. */
  updateIdShort: string | null;
  channel: string | null;
  isEmbeddedLaunch: boolean;
  /** Single line for UI, e.g. "v1.0.0 (12) · OTA a1b2c3d4". */
  label: string;
}

interface ExpoUpdatesNativeModule {
  updateId?: string | null;
  channel?: string | null;
  isEmbeddedLaunch?: boolean;
}

function shortId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.replace(/-/g, '').slice(0, 8);
}

export function getAppVersionInfo(): AppVersionInfo {
  const version =
    Constants.expoConfig?.version ??
    Constants.nativeApplicationVersion ??
    '0.0.0';
  const buildNumber = Constants.nativeBuildVersion ?? null;

  // Safe when the current native binary was built before expo-updates was added.
  const ExpoUpdates = requireOptionalNativeModule<ExpoUpdatesNativeModule>('ExpoUpdates');
  const rawUpdateId =
    ExpoUpdates?.updateId && typeof ExpoUpdates.updateId === 'string'
      ? ExpoUpdates.updateId.toLowerCase()
      : null;
  const updateIdShort = shortId(rawUpdateId);
  const channel = ExpoUpdates?.channel ?? null;
  const isEmbeddedLaunch = ExpoUpdates?.isEmbeddedLaunch ?? true;

  const parts = [`v${version}`];
  if (buildNumber) parts[0] = `${parts[0]} (${buildNumber})`;

  if (updateIdShort && !isEmbeddedLaunch) {
    parts.push(`OTA ${updateIdShort}`);
  } else {
    parts.push(ExpoUpdates ? 'embedded' : 'dev');
  }

  if (channel) parts.push(channel);

  return {
    version,
    buildNumber,
    updateIdShort,
    channel,
    isEmbeddedLaunch,
    label: parts.join(' · '),
  };
}
