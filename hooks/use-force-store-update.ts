import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';

import {
  decideForceUpdate,
  fetchForceUpdateConfig,
  getDefaultForceUpdateConfig,
  type ForceUpdateConfig,
} from '@/lib/force-update';

export interface ForceStoreUpdateState {
  /** True when the installed native binary is below the required store version. */
  isUpdateRequired: boolean;
  /** User-facing copy from remote config (or default). */
  message: string;
  /** Store listing URL for the current platform. */
  storeUrl: string;
  /** Opens the App Store / Play Store listing. */
  openStore: () => Promise<void>;
  /** Re-check remote config + installed version. */
  refresh: () => Promise<void>;
}

/**
 * Blocks the app when the native binary is older than the configured minimum.
 * Skipped in development so local builds are not trapped.
 */
export function useForceStoreUpdate(): ForceStoreUpdateState {
  const [config, setConfig] = useState<ForceUpdateConfig>(
    getDefaultForceUpdateConfig,
  );
  const isCheckingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (__DEV__ || isCheckingRef.current) return;

    isCheckingRef.current = true;
    try {
      const next = await fetchForceUpdateConfig();
      setConfig(next);
    } catch {
      // Keep last-known / default config on network errors.
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'active') void refresh();
    }

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  const decision = decideForceUpdate(config);
  const isUpdateRequired = !__DEV__ && decision.isRequired;

  const openStore = useCallback(async () => {
    const url = decision.storeUrl;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fall through to best-effort open.
    }
    await Linking.openURL(url);
  }, [decision.storeUrl]);

  return {
    isUpdateRequired,
    message: decision.message,
    storeUrl: decision.storeUrl,
    openStore,
    refresh,
  };
}
