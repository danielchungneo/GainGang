import { View, Text, StyleSheet } from "react-native";

import { ranks, fontFamily, type RankTier } from "@/lib/gaingang-theme";

export function RankChip({ tier }: { tier: RankTier }) {
  const r = ranks[tier];
  return (
    <View
      style={[
        styles.chip,
        { borderColor: r.color, backgroundColor: hexA(r.color, 0.14) },
      ]}
    >
      <Text style={[styles.text, { color: r.glow }]}>{tier}</Text>
    </View>
  );
}

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
  },
  text: { fontFamily: fontFamily.mono, fontSize: 9, letterSpacing: 0.5 },
});
