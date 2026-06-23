import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, darkTheme, lightTheme } from './themes';

interface ThemeContextValue {
  theme: Theme;
  mode: 'dark' | 'light';
  setMode: (m: 'dark' | 'light') => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  mode: 'dark',
  setMode: () => {},
  toggle: () => {},
});

/**
 * Wrap your app once:
 *
 *   <GainGangProvider>        // dark-first by default
 *     <App />
 *   </GainGangProvider>
 *
 * Pass `followSystem` to track the OS light/dark setting instead.
 */
export function GainGangProvider({
  children,
  initialMode = 'dark',
  followSystem = false,
}: {
  children: React.ReactNode;
  initialMode?: 'dark' | 'light';
  followSystem?: boolean;
}) {
  const system = useColorScheme();
  const [override, setOverride] = useState<'dark' | 'light' | null>(
    followSystem ? null : initialMode,
  );

  const mode: 'dark' | 'light' =
    override ?? (system === 'light' ? 'light' : 'dark');

  const setMode = useCallback((m: 'dark' | 'light') => setOverride(m), []);
  const toggle = useCallback(
    () => setOverride((p) => ((p ?? mode) === 'dark' ? 'light' : 'dark')),
    [mode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: mode === 'dark' ? darkTheme : lightTheme, mode, setMode, toggle }),
    [mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme + mode controls anywhere below the provider. */
export const useTheme = () => useContext(ThemeContext);
