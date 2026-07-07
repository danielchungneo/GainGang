import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CircularProgress } from '@/components/ui/circular-progress';
import { GlassSurface } from '@/components/ui/glass-surface';
import { GradientView } from '@/components/ui/gradient-view';
import {
  formatAmount,
  formatGoalActivityList,
  formatGoalDate,
  timeLeftUntilDateEnd,
} from '@/lib/format';
import {
  fontFamily,
  radius,
  spacing,
  status,
  useTheme,
} from '@/lib/gaingang-theme';
import type { DailyGoalWithProgress } from '@/types';

interface GangGoalProgressProps {
  goal: DailyGoalWithProgress;
}

function progressRatio(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

export function GangGoalProgress({ goal }: GangGoalProgressProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width: screenWidth } = useWindowDimensions();
  const timeLeft = timeLeftUntilDateEnd(goal.goal_date);
  const isEnded = timeLeft === 'Ended';
  const cardGap = spacing.sm + 4;
  const cardWidth = Math.min(148, screenWidth * 0.38);

  return (
    <GlassSurface style={styles.goalCard}>
      <GradientView
        colors={[
          theme.mode === 'dark' ? 'rgba(77,140,255,0.16)' : 'rgba(47,109,255,0.10)',
          theme.mode === 'dark' ? 'rgba(157,78,221,0.10)' : 'rgba(123,47,222,0.08)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerBand, { borderBottomColor: c.border }]}
      >
        <Text style={[styles.kind, { color: c.primaryGlow }]}>
          ⚔ DAILY GOAL
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: isEnded ? c.textMuted : status.success },
            ]}
          />
          <Text
            style={[
              styles.status,
              { color: isEnded ? c.textMuted : status.success },
            ]}
          >
            {isEnded ? 'Ended' : `Active · ${timeLeft}`}
          </Text>
        </View>
      </GradientView>

      <View style={styles.headerBody}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {formatGoalDate(goal.goal_date)}
        </Text>
        <Text style={[styles.subtitle, { color: c.textDim }]} numberOfLines={2}>
          {formatGoalActivityList(goal.exercises)}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + cardGap}
        snapToAlignment="start"
        nestedScrollEnabled
        contentContainerStyle={[
          styles.carousel,
          { gap: cardGap, paddingHorizontal: spacing.md + 2 },
        ]}
        style={styles.carouselScroll}
      >
        {goal.exercises.map((exercise) => {
          const ratio = progressRatio(exercise.gang_total, exercise.gang_target);
          const complete = exercise.gang_target > 0 && exercise.gang_total >= exercise.gang_target;
          const pctLabel = `${Math.round(ratio * 100)}%`;

          return (
            <View
              key={exercise.id}
              style={[
                styles.exerciseCard,
                {
                  width: cardWidth,
                  backgroundColor: c.surface2,
                  borderColor: c.border,
                },
              ]}
            >
              <CircularProgress
                value={ratio}
                size={104}
                strokeWidth={9}
                label={complete ? '✓' : pctLabel}
                complete={complete}
              />
              <Text style={[styles.exerciseName, { color: c.text }]} numberOfLines={2}>
                {exercise.exercise_name}
              </Text>
              <Text style={[styles.progressText, { color: c.primaryGlow }]}>
                {formatAmount(exercise.gang_total, exercise.unit)}
              </Text>
              <Text style={[styles.targetText, { color: c.textMuted }]}>
                of {formatAmount(exercise.gang_target, exercise.unit)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  goalCard: {
    overflow: 'hidden',
  },
  headerBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  kind: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
    textTransform: 'uppercase',
  },
  headerBody: {
    paddingHorizontal: spacing.md + 2,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  carouselScroll: {
    flexGrow: 0,
    marginBottom: spacing.md + 2,
  },
  carousel: {
    paddingTop: spacing.sm,
    paddingBottom: 2,
  },
  exerciseCard: {
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    minHeight: 36,
  },
  progressText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  targetText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    marginTop: -4,
  },
});
