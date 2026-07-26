import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export interface OtaUpdateState {
  /** True when a mandatory update prompt should block the app. */
  isUpdateRequired: boolean;
  /** True while fetching or reloading. */
  isUpdating: boolean;
  /** User-facing error from check/download/reload, if any. */
  errorMessage: string | null;
  /** Download the available update (if needed) and reload into it. */
  applyUpdate: () => Promise<void>;
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong while updating. Please try again.';
}

/**
 * Checks for EAS OTA updates on launch and when returning to the foreground.
 * Download is deferred until `applyUpdate` so the user must confirm via the modal.
 */
export function useOtaUpdate(): OtaUpdateState {
  const { isUpdateAvailable, isUpdatePending, isDownloading, downloadError } =
    Updates.useUpdates();
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const isCheckingRef = useRef(false);

  async function checkForUpdate() {
    if (!Updates.isEnabled || isCheckingRef.current) return;

    isCheckingRef.current = true;
    try {
      await Updates.checkForUpdateAsync();
    } catch {
      // Dev / Expo Go reject; production network errors are rare — ignore quietly.
    } finally {
      isCheckingRef.current = false;
    }
  }

  useEffect(() => {
    void checkForUpdate();
  }, []);

  useEffect(() => {
    function onAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'active') void checkForUpdate();
    }

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  async function applyUpdate() {
    if (!Updates.isEnabled || isApplying || isDownloading) return;

    setIsApplying(true);
    setApplyError(null);

    try {
      if (!isUpdatePending) {
        const result = await Updates.fetchUpdateAsync();
        if (!result.isNew && !result.isRollBackToEmbedded) {
          setApplyError('No update was downloaded. Please try again.');
          setIsApplying(false);
          return;
        }
      }

      await Updates.reloadAsync();
    } catch (error) {
      setApplyError(errorMessageFrom(error));
      setIsApplying(false);
    }
  }

  const isUpdateRequired =
    Updates.isEnabled && (isUpdateAvailable || isUpdatePending);

  const errorMessage =
    applyError ??
    (downloadError ? errorMessageFrom(downloadError) : null);

  return {
    isUpdateRequired,
    isUpdating: isApplying || isDownloading,
    errorMessage,
    applyUpdate,
  };
}
