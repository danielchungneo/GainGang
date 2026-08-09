/**
 * GlassSurface — Android / Web fallback.
 *
 * Light mode: frosted panel on the aura palette.
 * Dark mode: raised system-window surface with a blue glow border.
 */
import { StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/lib/gaingang-theme";

export interface GlassSurfaceProps extends ViewProps {
  /** 0–100: controls simulated blur opacity on non-iOS (ignored on iOS). */
  intensity?: number;
  /**
   * Force an opaque surface fill. Use over dark scrims in light mode so
   * theme text stays readable (iOS blur would otherwise frost to dark gray).
   */
  opaque?: boolean;
}

export function GlassSurface({
  style,
  children,
  opaque: _opaque,
  ...props
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.mode === "dark";

  return (
    <View
      style={[
        {
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: c.surface,
          borderWidth: isDark ? 1 : StyleSheet.hairlineWidth,
          borderColor: c.borderGlow,
          shadowColor: c.primary,
          shadowOffset: { width: 0, height: isDark ? 6 : 8 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: isDark ? 20 : 24,
          elevation: isDark ? 8 : 6,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
