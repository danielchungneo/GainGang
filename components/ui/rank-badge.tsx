import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Polygon,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from "react-native-svg";

import { ranks, fontFamily, type RankTier } from "@/lib/gaingang-theme";
import type { Rank } from "@/types";

export interface RankBadgeProps {
  /** App rank value — preferred prop for call sites. */
  rank?: Rank;
  /** Design-system tier alias. */
  tier?: RankTier;
  size?: number;
  showLabel?: boolean;
}

export function RankBadge({
  rank,
  tier,
  size = 88,
  showLabel = false,
}: RankBadgeProps) {
  const resolvedTier = (tier ?? rank ?? "E") as RankTier;
  const r = ranks[resolvedTier];
  const h = size * 1.09;
  const pts = (w: number, ht: number) =>
    `${w * 0.5},0 ${w},${ht * 0.25} ${w},${ht * 0.75} ${w * 0.5},${ht} 0,${ht * 0.75} 0,${ht * 0.25}`;

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: size,
          height: h,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: r.color,
          shadowOpacity: 0.7,
          shadowRadius: size * 0.32,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Svg width={size} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient
              id={`fill-${resolvedTier}`}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <Stop offset="0" stopColor={r.fill[0]} />
              <Stop offset="1" stopColor={r.fill[1]} />
            </SvgGradient>
          </Defs>
          <Polygon points={pts(size, h)} fill={`url(#fill-${resolvedTier})`} />
          <Polygon
            points={pts(size - 4, h - 4)}
            x={2}
            translateX={2}
            translateY={2}
            fill="none"
            stroke={r.color}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        </Svg>
        <Text style={[styles.letter, { color: r.glow, fontSize: size * 0.45 }]}>
          {resolvedTier}
        </Text>
      </View>

      {showLabel && (
        <>
          <Text style={[styles.rank, { color: r.glow }]}>
            {resolvedTier}-RANK
          </Text>
          <Text style={styles.name}>{r.name}</Text>
        </>
      )}
    </View>
  );
}

export const RANK_COLORS = Object.fromEntries(
  (Object.keys(ranks) as RankTier[]).map((t) => [t, ranks[t].color]),
) as Record<Rank, string>;

const styles = StyleSheet.create({
  letter: { fontFamily: fontFamily.display },
  rank: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 12,
  },
  name: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: "#6C7896",
    marginTop: 2,
  },
});
