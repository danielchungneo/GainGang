import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet } from "react-native";

import { fontFamily, status } from "@/lib/gaingang-theme";

export interface StreakPillProps {
  days: number;
}

/** Compact streak mark: flame icon + day count. */
export function StreakPill({ days }: StreakPillProps) {
  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`${days} day streak`}
    >
      <Ionicons name="flame" size={14} color={status.fire} />
      <Text style={styles.count}>{days}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  count: {
    fontFamily: fontFamily.display,
    fontSize: 13,
    lineHeight: 15,
    color: status.fire,
  },
});
