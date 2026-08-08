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
  | 'temporarily_unlocked'
  | 'unlocked_today';

export interface TemporaryUnlockState {
  active: boolean;
  /** Seconds left until hard expiry (wall-clock ceiling, also respects usage spend). */
  remainingSeconds: number;
  /** Epoch ms when the current grant was issued; null if none. */
  grantedAt: number | null;
  /** Epoch ms when the unlock hard-expires; null if none. */
  expiresAt: number | null;
  /** Total budget granted in seconds. */
  budgetSeconds: number;
}

interface PersistedTempUnlockGrant {
  grantedAt: number;
  expiresAt: number;
  budgetSeconds: number;
}

/** Minimum earn slice for production grants. */
export const MIN_TEMPORARY_UNLOCK_MINUTES = 15;

/** Dev-only short unlock for testing re-lock without waiting 15 minutes. */
export const DEV_TEST_UNLOCK_MINUTES = 1;

/** Extra App Group fields for midnight rest-day / relock (persisted with block config). */
export interface FocusLockNativeExtras {
  focusLockEnabled: boolean;
  datesWithExercises: string[];
  unlockedDate?: string;
}

const STORAGE_KEY = 'gaingang.screen-time-lock';
const TEMP_UNLOCK_GRANT_KEY = 'gaingang.screen-time-temp-unlock';

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
  hasExercisesToday: boolean;
  temporaryUnlockActive?: boolean;
}): ScreenTimeLockStatus {
  if (!isScreenTimeLockSupported()) return 'unsupported';
  if (!input.prefs.enabled) return 'disabled';
  if (!input.permissionGranted) return 'needs_permission';
  if (input.prefs.blockedItems.length === 0) return 'needs_apps';

  const today = todayISO();
  if (
    !input.hasExercisesToday ||
    input.prefs.unlockedDate === today ||
    input.goalsComplete
  ) {
    return 'unlocked_today';
  }
  if (input.temporaryUnlockActive) return 'temporarily_unlocked';
  return 'locked';
}

/**
 * Read the active unlock budget.
 * JS-persisted grant is the source of truth for the countdown. When it expires we
 * always force a native relock — never fall back to native remaining (which can
 * stay at the full budget if DeviceActivity usage events never fire, making the
 * timer appear to “restart”).
 */
export function getTemporaryUnlockState(): TemporaryUnlockState {
  const empty: TemporaryUnlockState = {
    active: false,
    remainingSeconds: 0,
    grantedAt: null,
    expiresAt: null,
    budgetSeconds: 0,
  };
  const native = loadNative();
  if (!native || !isScreenTimeLockSupported()) return empty;

  try {
    const grant = readTempUnlockGrantSync();
    const now = Date.now();

    if (grant) {
      if (grant.expiresAt <= now) {
        // Grant over — clear local state and re-apply shields immediately.
        void relockScreenTimeApps();
        return empty;
      }

      const wallRemaining = Math.max(0, Math.ceil((grant.expiresAt - now) / 1000));
      return {
        active: true,
        remainingSeconds: wallRemaining,
        grantedAt: grant.grantedAt,
        expiresAt: grant.expiresAt,
        budgetSeconds: grant.budgetSeconds,
      };
    }

    // No JS grant (e.g. cold start before hydrate, or already cleared). Ask native;
    // getRemainingUnlockTime also backstop-relocks when its budget is spent.
    const nativeRemaining = Math.max(0, Math.floor(native.getRemainingUnlockTime() ?? 0));
    if (nativeRemaining <= 0) return empty;

    return {
      active: true,
      remainingSeconds: nativeRemaining,
      grantedAt: null,
      expiresAt: now + nativeRemaining * 1000,
      budgetSeconds: nativeRemaining,
    };
  } catch {
    return empty;
  }
}

let cachedGrant: PersistedTempUnlockGrant | null | undefined;

function readTempUnlockGrantSync(): PersistedTempUnlockGrant | null {
  if (cachedGrant !== undefined) return cachedGrant;
  return null;
}

async function loadTempUnlockGrant(): Promise<PersistedTempUnlockGrant | null> {
  try {
    const raw = await AsyncStorage.getItem(TEMP_UNLOCK_GRANT_KEY);
    if (!raw) {
      cachedGrant = null;
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedTempUnlockGrant>;
    if (
      typeof parsed.grantedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      typeof parsed.budgetSeconds !== 'number'
    ) {
      cachedGrant = null;
      return null;
    }
    cachedGrant = {
      grantedAt: parsed.grantedAt,
      expiresAt: parsed.expiresAt,
      budgetSeconds: parsed.budgetSeconds,
    };
    return cachedGrant;
  } catch {
    cachedGrant = null;
    return null;
  }
}

async function saveTempUnlockGrant(grant: PersistedTempUnlockGrant): Promise<void> {
  cachedGrant = grant;
  await AsyncStorage.setItem(TEMP_UNLOCK_GRANT_KEY, JSON.stringify(grant));
}

async function clearTempUnlockGrant(): Promise<void> {
  cachedGrant = null;
  await AsyncStorage.removeItem(TEMP_UNLOCK_GRANT_KEY);
}

/**
 * Grant a temporary unlock for Focus-lock apps.
 * Requires shields to currently be active (goals incomplete). Does not stack —
 * a new grant replaces any existing budget. Hard-expires on wall-clock after
 * `minutes` even if usage monitoring never reports consumption.
 *
 * Pass `allowBelowMinimum: true` for short test grants (dev only). Native
 * DeviceActivity schedules still cannot be shorter than 15 minutes, so
 * background re-lock under 15m relies on the in-app timer / Lock now / foreground poll.
 */
export async function grantTemporaryScreenTime(
  minutes: number,
  options: { allowBelowMinimum?: boolean } = {},
): Promise<{ unlocked: boolean; expiresAt: number; minutes: number }> {
  const native = loadNative();
  if (!native || !isScreenTimeLockSupported()) {
    return { unlocked: false, expiresAt: 0, minutes: 0 };
  }

  const rounded = Math.max(1, Math.round(minutes));
  const grantedMinutes = options.allowBelowMinimum
    ? rounded
    : Math.max(MIN_TEMPORARY_UNLOCK_MINUTES, rounded);
  try {
    const result = await native.temporaryUnlock(grantedMinutes);
    const unlocked = result?.unlocked === true;
    const budgetSeconds = grantedMinutes * 60;
    const grantedAt = Date.now();
    // Prefer our wall-clock expiry so short test grants end on time even if
    // native DeviceActivity schedules are floored to 15 minutes.
    const expiresAt = grantedAt + budgetSeconds * 1000;

    if (unlocked) {
      await saveTempUnlockGrant({
        grantedAt,
        expiresAt,
        budgetSeconds,
      });
    }

    return {
      unlocked,
      expiresAt,
      minutes: grantedMinutes,
    };
  } catch (error) {
    console.warn('[screen-time-lock] temporaryUnlock failed', error);
    return { unlocked: false, expiresAt: 0, minutes: 0 };
  }
}

/** Force re-apply shields after an earned budget is spent (or for testing). */
export async function relockScreenTimeApps(): Promise<void> {
  const native = loadNative();
  await clearTempUnlockGrant();
  if (!native || !isScreenTimeLockSupported()) return;
  try {
    await native.relockApps();
    // Re-assert the stored block config so shields stay on even if a stale
    // temporary-unlock flag previously caused applyBlocks to no-op.
    const config = native.getBlockConfiguration?.() as
      | { blockedItems?: unknown[]; isActive?: boolean }
      | null
      | undefined;
    if (config?.blockedItems && Array.isArray(config.blockedItems) && config.blockedItems.length > 0) {
      await native.setBlockConfiguration({
        ...config,
        isActive: true,
      } as Parameters<typeof native.setBlockConfiguration>[0]);
    }
  } catch (error) {
    console.warn('[screen-time-lock] relockApps failed', error);
  }
}

/** Hydrate persisted grant cache (call on app start / before first status read). */
export async function hydrateTemporaryUnlockGrant(): Promise<void> {
  await loadTempUnlockGrant();
}

/**
 * Apply or clear iOS shields from persisted prefs + today's goals / rest day.
 * Safe no-op on non-iOS or when the native module is unavailable.
 * `justUnlocked` is true only when this sync newly sets unlockedDate because
 * workout goals were completed (not rest days).
 */
export async function syncScreenTimeLockState(input: {
  prefs?: ScreenTimeLockPrefs;
  goalsComplete: boolean;
  hasExercisesToday: boolean;
  datesWithExercises?: string[];
}): Promise<{ prefs: ScreenTimeLockPrefs; justUnlocked: boolean }> {
  const prefs = input.prefs ?? (await loadScreenTimeLockPrefs());
  const native = loadNative();
  const datesWithExercises = input.datesWithExercises ?? [];

  if (!native || !isScreenTimeLockSupported()) {
    return { prefs, justUnlocked: false };
  }

  const today = todayISO();
  const hasSelection = prefs.blockedItems.length > 0;
  const hasExercisesToday = input.hasExercisesToday;

  let next = prefs;
  let justUnlocked = false;

  if (prefs.unlockedDate && prefs.unlockedDate !== today) {
    next = { ...prefs, unlockedDate: null };
  }

  // Only celebrate / stamp unlockedDate when goals are done on a workout day.
  if (
    next.enabled &&
    hasSelection &&
    hasExercisesToday &&
    input.goalsComplete &&
    next.unlockedDate !== today
  ) {
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

    const shouldLock =
      hasExercisesToday && next.unlockedDate !== today && !input.goalsComplete;

    // Poll remaining budget first — native getRemainingUnlockTime re-locks when
    // the usage budget is spent (backstop if DeviceActivityMonitor missed it).
    getTemporaryUnlockState();

    // Persist isActive:true while goals are incomplete so midnight / relock can
    // re-apply shields. Native applyBlocks already skips shielding while a
    // temporary unlock budget remains.
    const config: Record<string, unknown> = {
      blockedItems: next.blockedItems,
      isActive: shouldLock,
      focusLockEnabled: true,
      datesWithExercises,
    };
    if (next.unlockedDate) config.unlockedDate = next.unlockedDate;

    await native.setBlockConfiguration(
      config as unknown as Parameters<typeof native.setBlockConfiguration>[0],
    );
  } catch (error) {
    console.warn('[screen-time-lock] sync failed', error);
  }

  return { prefs: next, justUnlocked };
}

export async function setScreenTimeLockEnabled(
  enabled: boolean,
  goalsComplete: boolean,
  options: { hasExercisesToday: boolean; datesWithExercises?: string[] } = {
    hasExercisesToday: true,
  },
): Promise<{ prefs: ScreenTimeLockPrefs; justUnlocked: boolean }> {
  const prefs = await loadScreenTimeLockPrefs();
  const next: ScreenTimeLockPrefs = {
    ...prefs,
    enabled,
    unlockedDate: enabled ? prefs.unlockedDate : null,
  };
  await saveScreenTimeLockPrefs(next);
  return syncScreenTimeLockState({
    prefs: next,
    goalsComplete,
    hasExercisesToday: options.hasExercisesToday,
    datesWithExercises: options.datesWithExercises,
  });
}

export async function updateScreenTimeSelection(input: {
  selectionData: string;
  blockedItems: ScreenTimeBlockedItem[];
  totalApps: number;
  totalCategories: number;
  goalsComplete: boolean;
  hasExercisesToday: boolean;
  datesWithExercises?: string[];
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
  return syncScreenTimeLockState({
    prefs: next,
    goalsComplete: input.goalsComplete,
    hasExercisesToday: input.hasExercisesToday,
    datesWithExercises: input.datesWithExercises,
  });
}
