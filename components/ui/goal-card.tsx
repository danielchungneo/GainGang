import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";

import {
  useTheme,
  fontFamily,
  radius,
  spacing,
  brand,
  status,
  ranks,
} from "@/lib/gaingang-theme";
import type { TimeLeftUrgency } from "@/lib/format";
import { Button } from "./button";
import { GradientView } from "./gradient-view";
import { ProgressBar } from "./progress-bar";

export interface GoalCardProps {
  kind?: string;
  title: string;
  description?: string;
  timeLeft?: string;
  timeLeftUrgency?: TimeLeftUrgency;
  gang: { current: number; target: number };
  individual: { current: number; target: number };
  rewards?: string[];
  ctaLabel?: string;
  onPressCta?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** System-window goal card with dual progress bars and a CTA. */
export function GoalCard({
  kind = "Daily Goal",
  title,
  description,
  timeLeft,
  timeLeftUrgency = "comfortable",
  gang,
  individual,
  rewards = [],
  ctaLabel = "LOG ACTIVITY",
  onPressCta,
  style,
}: GoalCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const statusColor = timeLeftUrgencyColor(timeLeftUrgency);
  const isEnded = timeLeftUrgency === "ended";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.borderGlow,
          shadowColor: c.primary,
          shadowOpacity: theme.mode === "dark" ? 0.55 : 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
    >
      <GradientView
        colors={[
          theme.mode === "dark"
            ? "rgba(77,140,255,0.16)"
            : "rgba(47,109,255,0.10)",
          theme.mode === "dark"
            ? "rgba(157,78,221,0.10)"
            : "rgba(123,47,222,0.08)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { borderBottomColor: c.border }]}
      >
        <Text style={[styles.kind, { color: c.primaryGlow }]}>
          ⚔ {kind.toUpperCase()}
        </Text>
        {!!timeLeft && (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.status, { color: statusColor }]}>
              {isEnded ? "Ended" : `Active · ${timeLeft}`}
            </Text>
          </View>
        )}
      </GradientView>

      <View style={{ padding: spacing.md + 2 }}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {!!description && (
          <Text style={[styles.desc, { color: c.textDim }]}>{description}</Text>
        )}

        <View style={{ marginBottom: spacing.md }}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: c.textMuted }]}>
              GANG TOTAL
            </Text>
            <Text style={[styles.metaVal, { color: c.primaryGlow }]}>
              {gang.current} / {gang.target}
            </Text>
          </View>
          <ProgressBar value={gang.current / gang.target} />
        </View>

        <View style={{ marginBottom: spacing.lg }}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: c.textMuted }]}>
              YOUR TARGET
            </Text>
            <Text style={[styles.metaVal, { color: c.secondaryGlow }]}>
              {individual.current} / {individual.target}
              {individual.current >= individual.target ? " ✓" : ""}
            </Text>
          </View>
          <ProgressBar
            value={individual.current / individual.target}
            colors={[brand.violet, brand.violetGlow]}
            glowColor={brand.violet}
          />
        </View>

        {rewards.length > 0 && (
          <View style={styles.rewards}>
            {rewards.map((r) => (
              <View
                key={r}
                style={[
                  styles.reward,
                  { borderColor: c.border, backgroundColor: c.surface2 },
                ]}
              >
                <Text style={[styles.rewardText, { color: c.textDim }]}>
                  {r}
                </Text>
              </View>
            ))}
          </View>
        )}

        {onPressCta ? <Button label={ctaLabel} onPress={onPressCta} /> : null}
      </View>
    </View>
  );
}

function timeLeftUrgencyColor(urgency: TimeLeftUrgency): string {
  switch (urgency) {
    case "comfortable":
      return status.success;
    case "moderate":
      return brand.blueGlow;
    case "urgent":
      return status.warning;
    case "critical":
      return status.danger;
    case "ended":
      return ranks.E.glow;
  }
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  kind: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 2 },
  statusRow: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  status: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { fontFamily: fontFamily.display, fontSize: 26, marginBottom: 6 },
  desc: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  metaLabel: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 1 },
  metaVal: { fontFamily: fontFamily.mono, fontSize: 11 },
  rewards: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  reward: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  rewardText: { fontFamily: fontFamily.mono, fontSize: 11 },
});
