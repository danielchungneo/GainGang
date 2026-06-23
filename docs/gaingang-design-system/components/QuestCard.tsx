import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, fontFamily, radius, spacing, brand } from '../theme';
import { ProgressBar } from './ProgressBar';
import { Button } from './Button';

export interface QuestCardProps {
  kind?: string;              // "Daily Quest"
  title: string;             // "The Iron Oath"
  description?: string;
  timeLeft?: string;         // "14h left"
  gang: { current: number; target: number };
  individual: { current: number; target: number };
  rewards?: string[];        // ["+120 XP", "🎡 Reward Spin"]
  ctaLabel?: string;
  onPressCta?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The "system window" quest card — translucent panel, glowing border,
 * dual progress (Gang total + your target), reward chips and a CTA.
 */
export function QuestCard({
  kind = 'Daily Quest',
  title,
  description,
  timeLeft,
  gang,
  individual,
  rewards = [],
  ctaLabel = 'LOG ACTIVITY',
  onPressCta,
  style,
}: QuestCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.borderGlow,
          shadowColor: c.primary,
          shadowOpacity: theme.mode === 'dark' ? 0.55 : 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
    >
      {/* header strip */}
      <LinearGradient
        colors={[
          theme.mode === 'dark' ? 'rgba(77,140,255,0.16)' : 'rgba(47,109,255,0.10)',
          theme.mode === 'dark' ? 'rgba(157,78,221,0.10)' : 'rgba(123,47,222,0.08)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { borderBottomColor: c.border }]}
      >
        <Text style={[styles.kind, { color: c.primaryGlow }]}>⚔ {kind.toUpperCase()}</Text>
        {!!timeLeft && (
          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <Text style={styles.status}>Active · {timeLeft}</Text>
          </View>
        )}
      </LinearGradient>

      {/* body */}
      <View style={{ padding: spacing.md + 2 }}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {!!description && <Text style={[styles.desc, { color: c.textDim }]}>{description}</Text>}

        {/* gang */}
        <View style={{ marginBottom: spacing.md }}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: c.textMuted }]}>GANG TOTAL</Text>
            <Text style={[styles.metaVal, { color: c.primaryGlow }]}>
              {gang.current} / {gang.target}
            </Text>
          </View>
          <ProgressBar value={gang.current / gang.target} />
        </View>

        {/* individual */}
        <View style={{ marginBottom: spacing.lg }}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: c.textMuted }]}>YOUR TARGET</Text>
            <Text style={[styles.metaVal, { color: c.secondaryGlow }]}>
              {individual.current} / {individual.target}
              {individual.current >= individual.target ? ' ✓' : ''}
            </Text>
          </View>
          <ProgressBar
            value={individual.current / individual.target}
            colors={[brand.violet, brand.violetGlow]}
            glowColor={brand.violet}
          />
        </View>

        {/* rewards */}
        {rewards.length > 0 && (
          <View style={styles.rewards}>
            {rewards.map((r) => (
              <View key={r} style={[styles.reward, { borderColor: c.border, backgroundColor: c.surface2 }]}>
                <Text style={[styles.rewardText, { color: c.textDim }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        <Button label={ctaLabel} onPress={onPressCta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  kind: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2DD4BF', marginRight: 6 },
  status: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 1.2, color: '#2DD4BF', textTransform: 'uppercase' },
  title: { fontFamily: fontFamily.display, fontSize: 26, marginBottom: 6 },
  desc: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  metaLabel: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 1 },
  metaVal: { fontFamily: fontFamily.mono, fontSize: 11 },
  rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  reward: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1 },
  rewardText: { fontFamily: fontFamily.mono, fontSize: 11 },
});
