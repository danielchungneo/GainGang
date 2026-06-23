/**
 * GlassSurface — iOS-specific implementation.
 *
 * Uses expo-blur's BlurView which maps to UIVisualEffectView under the hood,
 * styled with the GainGang aura border treatment.
 */
import { BlurView } from "expo-blur";
import { StyleSheet, type ViewProps } from "react-native";

import { useTheme } from "@/lib/gaingang-theme";

export interface GlassSurfaceProps extends ViewProps {
  /** 0–100: blur intensity passed to UIVisualEffectView. */
  intensity?: number;
}

export function GlassSurface({
  style,
  intensity,
  children,
  ...props
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.mode === "dark";

  return (
    <BlurView
      tint={
        isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"
      }
      intensity={intensity ?? (isDark ? 45 : 30)}
      style={[
        {
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: isDark ? 1 : StyleSheet.hairlineWidth,
          borderColor: c.borderGlow,
          shadowColor: c.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 22,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </BlurView>
  );
}
