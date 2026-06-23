import { useTheme } from "@/lib/gaingang-theme";

/**

 * Resolves the active GainGang palette for the current color scheme.

 * Bridges legacy call sites to the design-system theme.

 */

export function useThemeTokens() {
  const { theme, mode, toggle, setMode } = useTheme();

  const isLight = mode === "light";

  const c = theme.colors;

  return {
    isLight,

    mode,

    toggle,

    setMode,

    theme,

    heading: c.text,

    body: c.textDim,

    placeholder: c.textMuted,

    accent: c.primary,

    accentOnPrimary: "#FFFFFF",

    inputBg: isLight ? "rgba(47,109,255,0.06)" : "rgba(77,140,255,0.08)",

    inputBorder: c.borderGlow,

    buttonBg: c.surface2,

    buttonBorder: c.border,

    surfaceBorder: c.borderGlow,
  };
}
