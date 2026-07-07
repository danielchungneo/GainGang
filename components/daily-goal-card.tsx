import { router } from 'expo-router';

import { DailyGoalCard as DailyGoalCardView } from '@/components/ui/daily-goal-card';
import { formatGoalDate, timeLeftUntilDateEnd } from '@/lib/format';
import type { DailyGoalWithProgress } from '@/types';

interface DailyGoalCardProps {
  goal: DailyGoalWithProgress;
  loggable?: boolean;
}

/** Daily goal card wired to weekly plan data from the API. */
export function DailyGoalCard({ goal, loggable = true }: DailyGoalCardProps) {
  const allMet =
    goal.exercises.length > 0 &&
    goal.exercises.every(
      (e) => e.individual_target > 0 && e.user_total >= e.individual_target,
    );
  const anyLogged = goal.exercises.some((e) => e.user_total > 0);
  const metCount = goal.exercises.filter(
    (e) => e.individual_target > 0 && e.user_total >= e.individual_target,
  ).length;

  const rewards = [
    allMet ? 'All targets met ✓' : `${metCount}/${goal.exercises.length} done`,
    `${goal.member_count} members`,
  ];

  return (
    <DailyGoalCardView
      kind={goal.gang_name?.toUpperCase() ?? 'DAILY GOAL'}
      title={formatGoalDate(goal.goal_date)}
      timeLeft={timeLeftUntilDateEnd(goal.goal_date)}
      exercises={goal.exercises.map((e) => ({
        name: e.exercise_name,
        unit: e.unit,
        gang: { current: e.gang_total, target: e.gang_target },
        individual: { current: e.user_total, target: e.individual_target },
      }))}
      rewards={rewards}
      ctaLabel={loggable ? (anyLogged ? 'UPDATE ACTIVITY' : 'LOG ACTIVITY') : undefined}
      onPressCta={
        loggable
          ? () =>
              router.push({
                pathname: '/log-daily-goal',
                params: { dailyGoalId: goal.id, gangId: goal.gang_id },
              })
          : undefined
      }
    />
  );
}
