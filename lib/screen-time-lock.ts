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

/** Extra App Group fields for midnight relock (persisted with block config). */
export interface FocusLockNativeExtras {
  focusLockEnabled: boolean;
  /** @deprecated Ignored by midnight lock; kept for older app installs. */
  datesWithExercises?: string[];
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
  // Incomplete workout days stay locked even if a stale rest-day unlock stamp lingers.
  if (input.hasExercisesToday) {
    if (input.goalsComplete) return 'unlocked_today';
    if (input.temporaryUnlockActive) return 'temporarily_unlocked';
    return 'locked';
  }
  // Rest day: unlock is stamped in sync when the app opens (unlockedDate = today).
  if (input.prefs.unlockedDate === today) return 'unlocked_today';
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

/** Dev: native ManagedSettings / App Group state (JS status can disagree). */
export function getNativeFocusLockDebugInfo(): {
  nativeIsActive: boolean | null;
  nativeBlockedItemCount: number | null;
  nativeRemainingUnlockSeconds: number | null;
  decodedAppTokens: number | null;
  decodedCategoryTokens: number | null;
  storeApplicationCount: number | null;
  storeApplicationsIsNil: boolean | null;
  selectionAppTokens: number | null;
  appGroup: string | null;
  diagnosticsAvailable: boolean;
  nativeError: string | null;
} {
  const empty = {
    nativeIsActive: null as boolean | null,
    nativeBlockedItemCount: null as number | null,
    nativeRemainingUnlockSeconds: null as number | null,
    decodedAppTokens: null as number | null,
    decodedCategoryTokens: null as number | null,
    storeApplicationCount: null as number | null,
    storeApplicationsIsNil: null as boolean | null,
    selectionAppTokens: null as number | null,
    appGroup: null as string | null,
    diagnosticsAvailable: false,
    nativeError: null as string | null,
  };
  const native = loadNative();
  if (!native || !isScreenTimeLockSupported()) {
    return { ...empty, nativeError: 'native_unavailable' };
  }
  try {
    const config = native.getBlockConfiguration?.() as
      | { blockedItems?: unknown[]; isActive?: boolean }
      | null
      | undefined;
    const remaining = Math.max(0, Math.floor(native.getRemainingUnlockTime() ?? 0));

    let diagnostics: Record<string, unknown> | null = null;
    let diagnosticsAvailable = false;
    try {
      if (typeof native.getShieldDiagnostics === 'function') {
        diagnostics = native.getShieldDiagnostics() as unknown as Record<
          string,
          unknown
        >;
        diagnosticsAvailable = diagnostics != null;
      }
    } catch (error) {
      return {
        ...empty,
        nativeIsActive: typeof config?.isActive === 'boolean' ? config.isActive : null,
        nativeBlockedItemCount: Array.isArray(config?.blockedItems)
          ? config.blockedItems.length
          : null,
        nativeRemainingUnlockSeconds: remaining,
        nativeError: `getShieldDiagnostics failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    return {
      nativeIsActive: typeof config?.isActive === 'boolean' ? config.isActive : null,
      nativeBlockedItemCount: Array.isArray(config?.blockedItems)
        ? config.blockedItems.length
        : null,
      nativeRemainingUnlockSeconds: remaining,
      decodedAppTokens:
        typeof diagnostics?.decodedAppTokens === 'number'
          ? diagnostics.decodedAppTokens
          : null,
      decodedCategoryTokens:
        typeof diagnostics?.decodedCategoryTokens === 'number'
          ? diagnostics.decodedCategoryTokens
          : null,
      storeApplicationCount:
        typeof diagnostics?.storeApplicationCount === 'number'
          ? diagnostics.storeApplicationCount
          : null,
      storeApplicationsIsNil:
        typeof diagnostics?.storeApplicationsIsNil === 'boolean'
          ? diagnostics.storeApplicationsIsNil
          : null,
      selectionAppTokens:
        typeof diagnostics?.selectionAppTokens === 'number'
          ? diagnostics.selectionAppTokens
          : null,
      appGroup:
        typeof diagnostics?.appGroup === 'string' ? diagnostics.appGroup : null,
      diagnosticsAvailable,
      nativeError: diagnosticsAvailable
        ? null
        : 'getShieldDiagnostics missing — native build may predate the patch',
    };
  } catch (error) {
    return {
      ...empty,
      nativeError: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Hydrate persisted grant cache (call on app start / before first status read). */
export async function hydrateTemporaryUnlockGrant(): Promise<void> {
  await loadTempUnlockGrant();
}

/**
 * Apply or clear iOS shields from persisted prefs + today's schedule / goals.
 * Safe no-op on non-iOS or when the native module is unavailable.
 * `justUnlocked` is true only when this sync newly sets unlockedDate because
 * workout goals were completed (not rest-day open unlocks).
 *
 * Midnight always starts locked. Opening the app unlocks for the day when
 * there are no exercises; otherwise unlock requires finishing goals (or a
 * temporary earn grant).
 */
export async function syncScreenTimeLockState(input: {
  prefs?: ScreenTimeLockPrefs;
  goalsComplete: boolean;
  hasExercisesToday: boolean;
  /**
   * False when today's goals could not be fetched (loading/error). Freezes all
   * unlock-stamp changes so a transient fetch failure can neither grant a
   * rest-day unlock nor revoke an earned one. Shields still apply fail-safe.
   */
  goalsKnown?: boolean;
  datesWithExercises?: string[];
}): Promise<{ prefs: ScreenTimeLockPrefs; justUnlocked: boolean }> {
  const prefs = input.prefs ?? (await loadScreenTimeLockPrefs());
  const native = loadNative();

  if (!native || !isScreenTimeLockSupported()) {
    return { prefs, justUnlocked: false };
  }

  const today = todayISO();
  const hasSelection = prefs.blockedItems.length > 0;
  const hasExercisesToday = input.hasExercisesToday;
  const goalsKnown = input.goalsKnown !== false;

  let next = prefs;
  let justUnlocked = false;

  if (prefs.unlockedDate && prefs.unlockedDate !== today) {
    next = { ...prefs, unlockedDate: null };
  }

  if (next.enabled && hasSelection && goalsKnown) {
    if (hasExercisesToday && !input.goalsComplete) {
      // Workout day incomplete — drop a same-day unlock stamp (false rest day,
      // mid-day plan edits, or goals that hydrated after an empty fetch).
      if (next.unlockedDate === today) {
        next = { ...next, unlockedDate: null };
      }
    } else if (!hasExercisesToday && next.unlockedDate !== today) {
      // No exercises today — opening the app is enough to unlock for the day.
      next = { ...next, unlockedDate: today };
    } else if (
      hasExercisesToday &&
      input.goalsComplete &&
      next.unlockedDate !== today
    ) {
      next = { ...next, unlockedDate: today };
      justUnlocked = true;
    }
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

    // Persist isActive:true while locked so midnight / relock can re-apply
    // shields. Native applyBlocks already skips shielding while a temporary
    // unlock budget remains.
    const config: Record<string, unknown> = {
      blockedItems: next.blockedItems,
      isActive: shouldLock,
      focusLockEnabled: true,
    };
    if (next.unlockedDate) config.unlockedDate = next.unlockedDate;
    // Full FamilyActivitySelection blob — native prefers this over per-item tokens.
    if (next.selectionData) config.selectionData = next.selectionData;

    await native.setBlockConfiguration(
      config as unknown as Parameters<typeof native.setBlockConfiguration>[0],
    );

    // Verify shields actually landed in ManagedSettings. getShieldDiagnostics
    // also force re-applies the current config on the main thread as a
    // self-heal (it respects active temporary unlocks and inactive configs).
    if (shouldLock && typeof native.getShieldDiagnostics === 'function') {
      const diag = native.getShieldDiagnostics();
      if (
        diag?.storeApplicationsIsNil === true &&
        !getTemporaryUnlockState().active
      ) {
        console.warn(
          '[screen-time-lock] shields empty after sync — ManagedSettings did not apply',
          diag,
        );
      }
    }
  } catch (error) {
    console.warn('[screen-time-lock] sync failed', error);
  }

  return { prefs: next, justUnlocked };
}

export async function setScreenTimeLockEnabled(
  enabled: boolean,
  goalsComplete: boolean,
  options: {
    hasExercisesToday: boolean;
    goalsKnown?: boolean;
    datesWithExercises?: string[];
  } = {
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
    goalsKnown: options.goalsKnown,
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
  goalsKnown?: boolean;
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
    goalsKnown: input.goalsKnown,
    datesWithExercises: input.datesWithExercises,
  });
}
