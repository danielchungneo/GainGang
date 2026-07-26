import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { Theme, darkTheme, lightTheme } from './themes';

const APPEARANCE_STORAGE_KEY = 'gaingang.appearance';

type AppearanceMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  mode: AppearanceMode;
  setMode: (m: AppearanceMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  mode: 'dark',
  setMode: () => {},
  toggle: () => {},
});

function isAppearanceMode(value: string | null): value is AppearanceMode {
  return value === 'dark' || value === 'light';
}

/**
 * Wrap your app once:
 *
 *   <GainGangProvider>        // dark-first by default
 *     <App />
 *   </GainGangProvider>
 *
 * Pass `followSystem` to track the OS light/dark setting instead.
 * Otherwise the mode starts dark and only changes via setMode/toggle
 * (e.g. Settings), and the choice is persisted.
 */
export function GainGangProvider({
  children,
  initialMode = 'dark',
  followSystem = false,
}: {
  children: React.ReactNode;
  initialMode?: AppearanceMode;
  followSystem?: boolean;
}) {
  const system = useColorScheme();
  const [override, setOverride] = useState<AppearanceMode | null>(
    followSystem ? null : initialMode,
  );

  const mode: AppearanceMode =
    override ?? (system === 'light' ? 'light' : 'dark');

  useEffect(() => {
    if (followSystem) return;

    let cancelled = false;
    void AsyncStorage.getItem(APPEARANCE_STORAGE_KEY).then((saved) => {
      if (cancelled || !isAppearanceMode(saved)) return;
      setOverride(saved);
    });

    return () => {
      cancelled = true;
    };
  }, [followSystem]);

  useEffect(() => {
    Appearance.setColorScheme(mode);
  }, [mode]);

  const setMode = useCallback(
    (next: AppearanceMode) => {
      setOverride(next);
      if (!followSystem) {
        void AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next);
      }
    },
    [followSystem],
  );

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: mode === 'dark' ? darkTheme : lightTheme,
      mode,
      setMode,
      toggle,
    }),
    [mode, setMode, toggle],
  );

  const bg = value.theme.colors.bg;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(bg);
  }, [bg]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

/** Access the active theme + mode controls anywhere below the provider. */
export const useTheme = () => useContext(ThemeContext);
