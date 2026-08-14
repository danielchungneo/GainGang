/**
 * GlassSurface — iOS-specific implementation.
 *
 * Uses expo-blur's BlurView which maps to UIVisualEffectView under the hood,
 * styled with the GainGang aura border treatment.
 */
import { BlurView } from "expo-blur";
import { StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/lib/gaingang-theme";

export interface GlassSurfaceProps extends ViewProps {
  /** 0–100: blur intensity passed to UIVisualEffectView. */
  intensity?: number;
  /**
   * Force an opaque surface fill. Use over dark scrims in light mode so
   * theme text stays readable (blur would otherwise frost to dark gray).
   */
  opaque?: boolean;
}

export function GlassSurface({
  style,
  intensity,
  opaque = false,
  children,
  ...props
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.mode === "dark";

  const chrome = {
    borderRadius: 18,
    overflow: "hidden" as const,
    borderWidth: isDark ? 1 : StyleSheet.hairlineWidth,
    borderColor: c.borderGlow,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isDark ? 0.35 : 0.12,
    shadowRadius: 22,
  };

  if (opaque) {
    return (
      <View
        style={[{ backgroundColor: c.surface }, chrome, style]}
        {...props}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      tint={
        isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"
      }
      intensity={intensity ?? (isDark ? 45 : 30)}
      style={[chrome, style]}
      {...props}
    >
      {children}
    </BlurView>
  );
}
