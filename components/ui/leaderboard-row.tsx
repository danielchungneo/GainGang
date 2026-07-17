import { View, Text, StyleSheet, Pressable } from "react-native";

import {
  useTheme,
  fontFamily,
  status,
} from "@/lib/gaingang-theme";
import { formatAmount } from "@/lib/format";
import type { ExerciseUnit } from "@/types";
import { Avatar } from "./avatar";
import { LevelChip } from "./rank-chip";

export interface LeaderboardRowProps {
  position: number;
  name: string;
  avatarUrl?: string | null;
  amount: number;
  unit: Extract<ExerciseUnit, "reps" | "miles">;
  level: number;
  completion?: number;
  isYou?: boolean;
  onPress?: () => void;
}

export function LeaderboardRow({
  position,
  name,
  avatarUrl,
  amount,
  unit,
  level,
  completion,
  isYou,
  onPress,
}: LeaderboardRowProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const top = position === 1;
  const posColor = top ? status.warning : isYou ? c.primaryGlow : c.textDim;

  const content = (
    <>
      <Text style={[styles.pos, { color: posColor }]}>{position}</Text>

      <Avatar name={name} uri={avatarUrl} size={38} />

      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: isYou ? c.primaryGlow : c.text }]}>
          {name}
        </Text>
        {completion != null && (
          <Text style={[styles.sub, { color: c.textMuted }]}>
            {Math.round(completion * 100)}% of leader
          </Text>
        )}
      </View>

      <LevelChip level={level} />
      <Text style={[styles.amount, { color: c.text }]}>
        {formatAmount(amount, unit)}
      </Text>
    </>
  );

  const rowStyle = [
    styles.row,
    { borderBottomColor: c.border },
    top && {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(245,165,36,0.06)"
          : "rgba(245,165,36,0.08)",
    },
    isYou && {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(77,140,255,0.06)"
          : "rgba(47,109,255,0.05)",
    },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={rowStyle}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pos: { fontFamily: fontFamily.display, fontSize: 18, width: 24 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  sub: { fontFamily: fontFamily.mono, fontSize: 11, marginTop: 2 },
  amount: {
    fontFamily: fontFamily.monoBold,
    fontSize: 14,
    minWidth: 72,
    textAlign: "right",
  },
});
