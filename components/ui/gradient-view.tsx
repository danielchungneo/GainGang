import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export interface GradientViewProps {
  colors: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Gradient surface — uses a solid fill from the leading stop so it works
 * without the expo-linear-gradient native module (web, stale dev clients).
 */
export function GradientView({ colors, style, children }: GradientViewProps) {
  return (
    <View style={[style, { backgroundColor: colors[0] }]}>{children}</View>
  );
}
