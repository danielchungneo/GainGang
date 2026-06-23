import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/progress-bar';
import { formatAmount } from '@/lib/format';
import { brand, fontFamily, useTheme } from '@/lib/gaingang-theme';
import type { ExerciseUnit } from '@/types';

interface GoalProgressPreviewProps {
  title: string;
  unit: ExerciseUnit;
  gangTotal: number;
  gangTarget: number;
  userTotal: number;
  individualTarget: number;
  isPreview?: boolean;
}

function progressRatio(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

/** Live dual progress bars for personal + gang goal contribution. */
export function GoalProgressPreview({
  title,
  unit,
  gangTotal,
  gangTarget,
  userTotal,
  individualTarget,
  isPreview = false,
}: GoalProgressPreviewProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const userMet = individualTarget > 0 && userTotal >= individualTarget;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface2,
          borderColor: c.border,
        },
      ]}>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.section}>
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: c.textMuted }]}>GANG TOTAL</Text>
          <Text style={[styles.metaVal, { color: c.primaryGlow }]}>
            {formatAmount(gangTotal, unit)} / {formatAmount(gangTarget, unit)}
          </Text>
        </View>
        <ProgressBar value={progressRatio(gangTotal, gangTarget)} />
      </View>

      <View style={styles.section}>
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: c.textMuted }]}>YOUR TARGET</Text>
          <Text style={[styles.metaVal, { color: c.secondaryGlow }]}>
            {formatAmount(userTotal, unit)} / {formatAmount(individualTarget, unit)}
            {userMet ? ' ✓' : ''}
          </Text>
        </View>
        <ProgressBar
          value={progressRatio(userTotal, individualTarget)}
          colors={[brand.violet, brand.violetGlow]}
          glowColor={brand.violet}
        />
      </View>

      {isPreview ? (
        <Text style={[styles.previewHint, { color: c.textMuted }]}>
          Preview with your entry
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 18,
  },
  section: {
    gap: 7,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  metaVal: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
  previewHint: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
