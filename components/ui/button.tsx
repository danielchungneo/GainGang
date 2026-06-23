import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from "react-native";

import { useTheme, fontFamily } from "@/lib/gaingang-theme";
import { GradientView } from "./gradient-view";

type Variant = "primary" | "secondary" | "ghost";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}: ButtonProps) {
  const { theme } = useTheme();

  if (variant === "primary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          { opacity: pressed || disabled ? 0.85 : 1 },
          style,
        ]}
      >
        <GradientView
          colors={theme.aura}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            {
              shadowColor: theme.colors.primary,
              shadowOpacity: 0.6,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
              elevation: 6,
            },
          ]}
        >
          <Text style={[styles.label, { color: "#FFFFFF" }]}>{label}</Text>
        </GradientView>
      </Pressable>
    );
  }

  if (variant === "secondary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor:
              theme.mode === "dark"
                ? "rgba(77,140,255,0.08)"
                : "rgba(47,109,255,0.06)",
            borderWidth: 1,
            borderColor: theme.colors.borderGlow,
            opacity: pressed || disabled ? 0.7 : 1,
          },
          style,
        ]}
      >
        <Text style={[styles.label, { color: theme.colors.primaryGlow }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ghost,
        { opacity: pressed || disabled ? 0.6 : 1 },
        style,
      ]}
    >
      <Text style={[styles.ghostLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  ghost: { paddingVertical: 12, paddingHorizontal: 8, alignItems: "center" },
  ghostLabel: { fontFamily: fontFamily.mono, fontSize: 13, letterSpacing: 0.8 },
});
