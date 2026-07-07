import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import {
  useTheme,
  fontFamily,
  radius,
  spacing,
  brand,
  status,
  ranks,
} from '@/lib/gaingang-theme';
import type { ExerciseUnit } from '@/types';
import { formatAmount } from '@/lib/format';
import { Button } from './button';
import { GradientView } from './gradient-view';
import { ProgressBar } from './progress-bar';

export interface DailyGoalExerciseDisplay {
  name: string;
  unit: ExerciseUnit;
  gang: { current: number; target: number };
  individual: { current: number; target: number };
}

export interface DailyGoalCardProps {
  kind?: string;
  title: string;
  description?: string;
  timeLeft?: string;
  exercises: DailyGoalExerciseDisplay[];
  rewards?: string[];
  ctaLabel?: string;
  onPressCta?: () => void;
  /** When false, only gang progress bars are shown. Defaults to true. */
  showIndividual?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Daily goal card with per-exercise dual progress bars. */
export function DailyGoalCard({
  kind = 'Daily Goal',
  title,
  description,
  timeLeft,
  exercises,
  rewards = [],
  ctaLabel = 'LOG ACTIVITY',
  onPressCta,
  showIndividual = true,
  style,
}: DailyGoalCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isEnded = timeLeft === 'Ended';

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
      <GradientView
        colors={[
          theme.mode === 'dark'
            ? 'rgba(77,140,255,0.16)'
            : 'rgba(47,109,255,0.10)',
          theme.mode === 'dark'
            ? 'rgba(157,78,221,0.10)'
            : 'rgba(123,47,222,0.08)',
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
            <View
              style={[
                styles.dot,
                { backgroundColor: isEnded ? ranks.E.glow : status.success },
              ]}
            />
            <Text
              style={[
                styles.status,
                { color: isEnded ? ranks.E.glow : status.success },
              ]}
            >
              {isEnded ? 'Ended' : `Active · ${timeLeft}`}
            </Text>
          </View>
        )}
      </GradientView>

      <View style={{ padding: spacing.md + 2 }}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {!!description && (
          <Text style={[styles.desc, { color: c.textDim }]}>{description}</Text>
        )}

        {exercises.map((ex) => (
          <View key={ex.name} style={styles.exerciseBlock}>
            <Text style={[styles.exerciseName, { color: c.text }]}>{ex.name}</Text>

            <View style={{ marginBottom: spacing.sm }}>
              <View style={styles.metaRow}>
                <Text style={[styles.metaLabel, { color: c.textMuted }]}>
                  GANG
                </Text>
                <Text style={[styles.metaVal, { color: c.primaryGlow }]}>
                  {formatAmount(ex.gang.current, ex.unit)} / {formatAmount(ex.gang.target, ex.unit)}
                </Text>
              </View>
              <ProgressBar
                value={ex.gang.target > 0 ? ex.gang.current / ex.gang.target : 0}
              />
            </View>

            {showIndividual ? (
              <View style={{ marginBottom: spacing.md }}>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: c.textMuted }]}>
                    YOU
                  </Text>
                  <Text style={[styles.metaVal, { color: c.secondaryGlow }]}>
                    {formatAmount(ex.individual.current, ex.unit)} /{' '}
                    {formatAmount(ex.individual.target, ex.unit)}
                    {ex.individual.current >= ex.individual.target ? ' ✓' : ''}
                  </Text>
                </View>
                <ProgressBar
                  value={
                    ex.individual.target > 0
                      ? ex.individual.current / ex.individual.target
                      : 0
                  }
                  colors={[brand.violet, brand.violetGlow]}
                  glowColor={brand.violet}
                />
              </View>
            ) : null}
          </View>
        ))}

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
                <Text style={[styles.rewardText, { color: c.textDim }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {onPressCta ? <Button label={ctaLabel} onPress={onPressCta} /> : null}
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
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  status: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fontFamily.display, fontSize: 26, marginBottom: 6 },
  desc: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  exerciseBlock: {
    marginBottom: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  exerciseName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 16,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  metaLabel: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 1 },
  metaVal: { fontFamily: fontFamily.mono, fontSize: 11 },
  rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  reward: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  rewardText: { fontFamily: fontFamily.mono, fontSize: 11 },
});
