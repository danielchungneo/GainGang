import { router } from 'expo-router';

import { GoalCard as GoalCardView } from '@/components/ui/goal-card';
import { formatAmount, dayGoalLabel, timeLeftStatus } from '@/lib/format';
import { CATEGORY_LABELS, type QuestWithProgress } from '@/types';

interface GoalCardProps {
  goal: QuestWithProgress;
  loggable?: boolean;
}

function goalDescription(goal: QuestWithProgress): string {
  const gangPart = `${formatAmount(goal.gang_target, goal.unit)} as a Gang`;
  const yoursPart = `${formatAmount(goal.individual_target, goal.unit)} are yours`;
  const categoryPart = goal.day_category ? CATEGORY_LABELS[goal.day_category] : null;
  const exercisePart = goal.exercise_name ?? null;

  return [exercisePart, categoryPart, `${gangPart}. ${yoursPart}.`].filter(Boolean).join(' · ');
}

/** Goal card wired to live quest/goal data from the API. */
export function GoalCard({ goal, loggable = true }: GoalCardProps) {
  const userMet = goal.user_total >= goal.individual_target && goal.individual_target > 0;
  const hasLogged = goal.user_total > 0;
  const rewards = [
    userMet ? 'Target met ✓' : `${Math.round((goal.user_total / Math.max(goal.individual_target, 1)) * 100)}% yours`,
    `${goal.contributor_count} contributing`,
  ];

  const timeLeft = timeLeftStatus(goal.starts_on, goal.ends_on);

  return (
    <GoalCardView
      kind={goal.type === 'daily' ? dayGoalLabel(goal.starts_on) : 'Weekly Goal'}
      title={goal.title}
      description={goalDescription(goal)}
      timeLeft={timeLeft.label}
      timeLeftUrgency={timeLeft.urgency}
      gang={{ current: goal.gang_total, target: goal.gang_target }}
      individual={{ current: goal.user_total, target: goal.individual_target }}
      rewards={rewards}
      ctaLabel={loggable ? (hasLogged ? 'UPDATE ACTIVITY' : 'LOG ACTIVITY') : undefined}
      onPressCta={
        loggable
          ? () =>
              router.push({
                pathname: '/log-activity',
                params: {
                  gangId: goal.gang_id,
                  questId: goal.id,
                  category: goal.day_category ?? '',
                  exerciseId: goal.exercise_id ?? '',
                  exerciseName: goal.exercise_name ?? '',
                  unit: goal.unit,
                },
              })
          : undefined
      }
    />
  );
}
