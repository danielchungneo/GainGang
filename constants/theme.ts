import { Platform } from "react-native";

import { brand, darkTheme, lightTheme } from "@/lib/gaingang-theme";

export const Colors = {
  light: {
    text: lightTheme.colors.text,

    background: lightTheme.colors.bg,

    tint: lightTheme.colors.primary,

    icon: lightTheme.colors.textMuted,

    tabIconDefault: lightTheme.colors.textMuted,

    tabIconSelected: lightTheme.colors.primary,
  },

  dark: {
    text: darkTheme.colors.text,

    background: darkTheme.colors.bg,

    tint: darkTheme.colors.primary,

    icon: darkTheme.colors.textDim,

    tabIconDefault: darkTheme.colors.textMuted,

    tabIconSelected: darkTheme.colors.primaryGlow,
  },
};

/**

 * Glass design tokens for the light theme — frosted surfaces on the aura palette.

 */

export const Glass = {
  surfaceBg: "rgba(255, 255, 255, 0.72)",

  surfaceBorder: lightTheme.colors.borderGlow,

  inputBg: "rgba(47,109,255,0.06)",

  inputBorder: lightTheme.colors.borderGlow,

  buttonBg: lightTheme.colors.surface2,

  buttonBorder: lightTheme.colors.border,

  textPrimary: lightTheme.colors.text,

  textSecondary: lightTheme.colors.textDim,

  textPlaceholder: lightTheme.colors.textMuted,

  blob1: "rgba(77,140,255,0.18)",

  blob2: "rgba(157,78,221,0.14)",

  blob3: "rgba(77,140,255,0.10)",

  blobBase: lightTheme.colors.bg,
} as const;

/**

 * Glass design tokens for the dark theme — system-window panels with blue→violet aura.

 */

export const DarkGlass = {
  surfaceBg: "rgba(14, 21, 36, 0.82)",

  surfaceBorder: darkTheme.colors.borderGlow,

  surfaceGlow: brand.blue,

  inputBg: "rgba(77,140,255,0.08)",

  inputBorder: darkTheme.colors.borderGlow,

  buttonBg: darkTheme.colors.surface2,

  buttonBorder: darkTheme.colors.border,

  primaryBg: brand.blue,

  primaryText: "#FFFFFF",

  textPrimary: darkTheme.colors.text,

  textSecondary: darkTheme.colors.textDim,

  textPlaceholder: darkTheme.colors.textMuted,

  neonCyan: brand.blue,

  neonPurple: brand.violet,

  neonBlue: brand.blueDeep,

  blob1: "rgba(77,140,255,0.16)",

  blob2: "rgba(157,78,221,0.12)",

  blob3: "rgba(77,140,255,0.08)",

  blobBase: darkTheme.colors.bg,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",

    serif: "ui-serif",

    rounded: "ui-rounded",

    mono: "ui-monospace",
  },

  default: {
    sans: "normal",

    serif: "serif",

    rounded: "normal",

    mono: "monospace",
  },

  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",

    serif: "Georgia, 'Times New Roman', serif",

    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",

    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
