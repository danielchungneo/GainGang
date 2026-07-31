import { LinearGradient } from "expo-linear-gradient";
import { View, Text, StyleSheet } from "react-native";

import { gradientColors, parseBorderStyle } from "@/lib/cosmetics";
import { fontFamily, levelBadgeForLevel } from "@/lib/gaingang-theme";
import type { Json } from "@/types/database";

interface LevelChipProps {
  level: number;
  /** Equipped level border style jsonb. */
  borderStyle?: Json | null;
}

export function LevelChip({ level, borderStyle }: LevelChipProps) {
  const badge = levelBadgeForLevel(Math.max(1, level));
  const border = parseBorderStyle(borderStyle ?? null);

  const chip = (
    <View
      style={[
        styles.chip,
        { borderColor: badge.color, backgroundColor: hexA(badge.color, 0.14) },
      ]}
    >
      <Text style={[styles.text, { color: badge.glow }]}>{level}</Text>
    </View>
  );

  if (!border) return chip;

  return (
    <LinearGradient
      colors={gradientColors(border.colors)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        padding: Math.min(border.width ?? 2, 2),
        borderRadius: 7,
        shadowColor: border.glow ?? border.colors[0],
        shadowOpacity: 0.5,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      {chip}
    </LinearGradient>
  );
}

/** @deprecated Use LevelChip with `level` instead. */
export const RankChip = LevelChip;

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    minWidth: 22,
    alignItems: "center",
  },
  text: { fontFamily: fontFamily.mono, fontSize: 9, letterSpacing: 0.5 },
});
