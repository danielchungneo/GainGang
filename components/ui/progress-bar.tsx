import { View, StyleSheet } from "react-native";

import { brand, useTheme, radius } from "@/lib/gaingang-theme";

export interface ProgressBarProps {
  /** 0–1 */
  value?: number;
  /** Alias for `value` used by older call sites. */
  ratio?: number;
  colors?: readonly [string, string];
  glowColor?: string;
  height?: number;
}

export function ProgressBar({
  value,
  ratio,
  colors,
  glowColor,
  height = 9,
}: ProgressBarProps) {
  const { theme } = useTheme();
  const pct = Math.max(0, Math.min(1, value ?? ratio ?? 0));
  const fill = colors ?? theme.aura;

  return (
    <View style={[styles.track, { height, backgroundColor: theme.track }]}>
      {pct > 0 ? (
        <View
          style={[
            styles.fill,
            {
              width: `${pct * 100}%`,
              backgroundColor: fill[0],
              shadowColor: glowColor ?? fill[0],
              shadowOpacity: 0.7,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        />
      ) : null}
    </View>
  );
}

/** Convenience wrapper when passing a custom hex color. */
export function ProgressBarWithColor({
  ratio,
  height,
  color,
}: {
  ratio: number;
  height?: number;
  color?: string;
}) {
  const colors = color ? ([color, color] as const) : undefined;
  const glowColor =
    color === brand.violet || color === "#a855f7" ? brand.violet : undefined;
  return (
    <ProgressBar
      ratio={ratio}
      height={height}
      colors={colors}
      glowColor={glowColor}
    />
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: "hidden", width: "100%" },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
});
