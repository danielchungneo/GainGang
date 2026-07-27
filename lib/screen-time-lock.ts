import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { todayISO } from '@/lib/format';

export interface ScreenTimeBlockedItem {
  type: 'app' | 'category' | 'webDomain';
  token: string;
  bundleIdentifier?: string;
  displayName?: string;
  categoryName?: string;
  domain?: string;
  iconBase64?: string;
}

export interface ScreenTimeLockPrefs {
  enabled: boolean;
  selectionData: string;
  blockedItems: ScreenTimeBlockedItem[];
  /** YYYY-MM-DD when goals were completed and shields lifted for the day. */
  unlockedDate: string | null;
  totalApps: number;
  totalCategories: number;
}

export type ScreenTimeLockStatus =
  | 'unsupported'
  | 'disabled'
  | 'needs_permission'
  | 'needs_apps'
  | 'locked'
  | 'unlocked_today';

const STORAGE_KEY = 'gaingang.screen-time-lock';

const DEFAULT_PREFS: ScreenTimeLockPrefs = {
  enabled: false,
  selectionData: '',
  blockedItems: [],
  unlockedDate: null,
  totalApps: 0,
  totalCategories: 0,
};

export function isScreenTimeLockSupported(): boolean {
  return Platform.OS === 'ios';
}

function loadNative() {
  if (!isScreenTimeLockSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-app-blocker') as typeof import('expo-app-blocker');
  } catch {
    return null;
  }
}

export async function loadScreenTimeLockPrefs(): Promise<ScreenTimeLockPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ScreenTimeLockPrefs>;
    return {
      enabled: parsed.enabled === true,
      selectionData: typeof parsed.selectionData === 'string' ? parsed.selectionData : '',
      blockedItems: Array.isArray(parsed.blockedItems)
        ? (parsed.blockedItems as ScreenTimeBlockedItem[])
        : [],
      unlockedDate:
        typeof parsed.unlockedDate === 'string' ? parsed.unlockedDate : null,
      totalApps: typeof parsed.totalApps === 'number' ? parsed.totalApps : 0,
      totalCategories:
        typeof parsed.totalCategories === 'number' ? parsed.totalCategories : 0,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveScreenTimeLockPrefs(
  prefs: ScreenTimeLockPrefs,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function getScreenTimePermissionGranted(): Promise<boolean> {
  const native = loadNative();
  if (!native) return false;
  try {
    const status = await native.getPermissionStatus();
    return status.allGranted;
  } catch {
    return false;
  }
}

export async function requestScreenTimePermission(): Promise<boolean> {
  const native = loadNative();
  if (!native) return false;
  try {
    const status = await native.requestPermissions();
    return status.allGranted;
  } catch {
    return false;
  }
}

export function deriveScreenTimeLockStatus(input: {
  prefs: ScreenTimeLockPrefs;
  permissionGranted: boolean;
  goalsComplete: boolean;
}): ScreenTimeLockStatus {
  if (!isScreenTimeLockSupported()) return 'unsupported';
  if (!input.prefs.enabled) return 'disabled';
  if (!input.permissionGranted) return 'needs_permission';
  if (input.prefs.blockedItems.length === 0) return 'needs_apps';

  const today = todayISO();
  if (input.prefs.unlockedDate === today || input.goalsComplete) {
    return 'unlocked_today';
  }
  return 'locked';
}

/**
 * Apply or clear iOS shields from persisted prefs + today's goal completion.
 * Safe no-op on non-iOS or when the native module is unavailable.
 * `justUnlocked` is true only when this sync newly sets unlockedDate to today.
 */
export async function syncScreenTimeLockState(input: {
  prefs?: ScreenTimeLockPrefs;
  goalsComplete: boolean;
}): Promise<{ prefs: ScreenTimeLockPrefs; justUnlocked: boolean }> {
  const prefs = input.prefs ?? (await loadScreenTimeLockPrefs());
  const native = loadNative();

  if (!native || !isScreenTimeLockSupported()) {
    return { prefs, justUnlocked: false };
  }

  const today = todayISO();
  const hasSelection = prefs.blockedItems.length > 0;

  let next = prefs;
  let justUnlocked = false;

  if (prefs.unlockedDate && prefs.unlockedDate !== today) {
    next = { ...prefs, unlockedDate: null };
  }

  if (next.enabled && hasSelection && input.goalsComplete && next.unlockedDate !== today) {
    next = { ...next, unlockedDate: today };
    justUnlocked = true;
  }

  if (next !== prefs) {
    await saveScreenTimeLockPrefs(next);
  }

  try {
    if (!next.enabled || !hasSelection) {
      native.clearAllBlocks();
      return { prefs: next, justUnlocked };
    }

    const shouldLock = next.unlockedDate !== today;
    await native.setBlockConfiguration({
      blockedItems: next.blockedItems,
      isActive: shouldLock,
    });
  } catch (error) {
    console.warn('[screen-time-lock] sync failed', error);
  }

  return { prefs: next, justUnlocked };
}

export async function setScreenTimeLockEnabled(
  enabled: boolean,
  goalsComplete: boolean,
): Promise<{ prefs: ScreenTimeLockPrefs; justUnlocked: boolean }> {
  const prefs = await loadScreenTimeLockPrefs();
  const next: ScreenTimeLockPrefs = {
    ...prefs,
    enabled,
    unlockedDate: enabled ? prefs.unlockedDate : null,
  };
  await saveScreenTimeLockPrefs(next);
  return syncScreenTimeLockState({ prefs: next, goalsComplete });
}

export async function updateScreenTimeSelection(input: {
  selectionData: string;
  blockedItems: ScreenTimeBlockedItem[];
  totalApps: number;
  totalCategories: number;
  goalsComplete: boolean;
}): Promise<{ prefs: ScreenTimeLockPrefs; justUnlocked: boolean }> {
  const prefs = await loadScreenTimeLockPrefs();
  const next: ScreenTimeLockPrefs = {
    ...prefs,
    selectionData: input.selectionData,
    blockedItems: input.blockedItems,
    totalApps: input.totalApps,
    totalCategories: input.totalCategories,
  };
  await saveScreenTimeLockPrefs(next);
  return syncScreenTimeLockState({ prefs: next, goalsComplete: input.goalsComplete });
}
