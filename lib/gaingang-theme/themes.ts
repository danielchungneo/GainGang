/**
 * Light & dark theme objects. Surfaces, text, borders and the
 * theme-aware aura gradient. Consume via useTheme() (see ThemeProvider.tsx).
 */
import { brand, auraGradient, auraGradientLight } from './tokens';

export interface Theme {
  mode: 'dark' | 'light';
  colors: {
    // canvas → raised surfaces
    bg: string;
    surface: string;
    surface2: string;
    surface3: string;
    // text
    text: string;
    textDim: string;
    textMuted: string;
    // lines & accents
    border: string;
    borderGlow: string;
    primary: string;
    primaryGlow: string;
    secondary: string;
    secondaryGlow: string;
  };
  aura: readonly [string, string];
  /** Track color behind progress fills. */
  track: string;
}

export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    bg: '#05070F',
    surface: '#0E1524',
    surface2: '#131C30',
    surface3: '#1D2840',
    text: '#E8EDF7',
    textDim: '#AEB8D0',
    textMuted: '#7D8AA8',
    border: 'rgba(125,165,255,0.14)',
    borderGlow: 'rgba(77,140,255,0.35)',
    primary: brand.blue,
    primaryGlow: brand.blueGlow,
    secondary: brand.violet,
    secondaryGlow: brand.violetGlow,
  },
  aura: auraGradient,
  track: '#1D2840',
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    bg: '#F4F6FC',
    surface: '#FFFFFF',
    surface2: '#EEF1FA',
    surface3: '#DFE4F2',
    text: '#0D1426',
    textDim: '#42507A',
    textMuted: '#5B678C',
    border: '#E3E8F5',
    borderGlow: 'rgba(47,109,255,0.30)',
    primary: '#2F6DFF',
    primaryGlow: '#6F97E8',
    secondary: '#7B2FDE',
    secondaryGlow: '#9D4EDD',
  },
  aura: auraGradientLight,
  track: '#DFE4F2',
};
