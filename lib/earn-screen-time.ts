import {
  getCameraExerciseType,
  supportsCameraTracking,
} from '@/lib/rep-counting/exercise-registry';
import {
  DEV_TEST_UNLOCK_MINUTES,
  MIN_TEMPORARY_UNLOCK_MINUTES,
} from '@/lib/screen-time-lock';
import type {
  DailyGoalExerciseWithProgress,
  DailyGoalWithProgress,
  Exercise,
  ExerciseUnit,
} from '@/types';

export type EarnOfferKind = 'daily_chunk' | 'quick_earn';

export interface EarnOffer {
  id: string;
  kind: EarnOfferKind;
  title: string;
  subtitle: string;
  exerciseId: string;
  exerciseName: string;
  unit: Extract<ExerciseUnit, 'reps' | 'seconds'>;
  /** Amount the user must complete in this earn session. */
  targetAmount: number;
  unlockMinutes: number;
  /** When set, completion credits this daily-goal exercise. */
  dailyGoalId?: string;
  dailyGoalExerciseId?: string;
  gangId?: string;
  category?: DailyGoalExerciseWithProgress['category'];
}

interface QuickEarnTemplate {
  /** Substring matched against normalized exercise names. */
  nameIncludes: string;
  amount: number;
  unit: Extract<ExerciseUnit, 'reps' | 'seconds'>;
  minutes: number;
  label: string;
}

/** Production quick-earn catalog. */
const PROD_QUICK_EARN_TEMPLATES: QuickEarnTemplate[] = [
  {
    nameIncludes: 'push',
    amount: 10,
    unit: 'reps',
    minutes: MIN_TEMPORARY_UNLOCK_MINUTES,
    label: '10 push-ups',
  },
  {
    nameIncludes: 'plank',
    amount: 30,
    unit: 'seconds',
    minutes: MIN_TEMPORARY_UNLOCK_MINUTES,
    label: '30s plank',
  },
  {
    nameIncludes: 'squat',
    amount: 15,
    unit: 'reps',
    minutes: MIN_TEMPORARY_UNLOCK_MINUTES,
    label: '15 squats',
  },
  {
    nameIncludes: 'sit',
    amount: 15,
    unit: 'reps',
    minutes: MIN_TEMPORARY_UNLOCK_MINUTES,
    label: '15 sit-ups',
  },
];

/** Dev catalog: 1 rep / 1s → 1 minute unlock for fast end-to-end testing. */
const DEV_QUICK_EARN_TEMPLATES: QuickEarnTemplate[] = [
  {
    nameIncludes: 'push',
    amount: 1,
    unit: 'reps',
    minutes: DEV_TEST_UNLOCK_MINUTES,
    label: '1 push-up',
  },
  {
    nameIncludes: 'plank',
    amount: 1,
    unit: 'seconds',
    minutes: DEV_TEST_UNLOCK_MINUTES,
    label: '1s plank',
  },
  {
    nameIncludes: 'squat',
    amount: 1,
    unit: 'reps',
    minutes: DEV_TEST_UNLOCK_MINUTES,
    label: '1 squat',
  },
  {
    nameIncludes: 'sit',
    amount: 1,
    unit: 'reps',
    minutes: DEV_TEST_UNLOCK_MINUTES,
    label: '1 sit-up',
  },
];

/** Fixed quick-earn catalog — resolved against the live exercise table by name. */
export const QUICK_EARN_TEMPLATES: QuickEarnTemplate[] = __DEV__
  ? DEV_QUICK_EARN_TEMPLATES
  : PROD_QUICK_EARN_TEMPLATES;

const DAILY_REP_CHUNK = __DEV__ ? 1 : 10;
const DAILY_HOLD_CHUNK = __DEV__ ? 1 : 30;
const EARN_UNLOCK_MINUTES = __DEV__
  ? DEV_TEST_UNLOCK_MINUTES
  : MIN_TEMPORARY_UNLOCK_MINUTES;

function remainingFor(ex: DailyGoalExerciseWithProgress): number {
  return Math.max(0, Math.round(ex.individual_target - ex.user_total));
}

function formatTarget(amount: number, unit: Extract<ExerciseUnit, 'reps' | 'seconds'>): string {
  if (unit === 'seconds') {
    if (amount >= 60 && amount % 60 === 0) return `${amount / 60} min`;
    return `${amount}s`;
  }
  return `${amount} ${amount === 1 ? 'rep' : 'reps'}`;
}

function findDailyMatch(
  goals: DailyGoalWithProgress[],
  exerciseId: string,
): {
  goal: DailyGoalWithProgress;
  exercise: DailyGoalExerciseWithProgress;
} | null {
  for (const goal of goals) {
    for (const exercise of goal.exercises) {
      if (exercise.exercise_id === exerciseId && remainingFor(exercise) > 0) {
        return { goal, exercise };
      }
    }
  }
  return null;
}

/**
 * Build "from today's plan" offers: a small chunk and (when more remains) finish.
 * Only camera-trackable required exercises with remaining work are included.
 * In __DEV__, chunks are 1 rep / 1s for 1 minute unlocks.
 */
export function buildDailyChunkOffers(goals: DailyGoalWithProgress[]): EarnOffer[] {
  const offers: EarnOffer[] = [];

  for (const goal of goals) {
    for (const exercise of goal.exercises) {
      if (!exercise.is_required_for_user) continue;
      if (exercise.individual_target <= 0) continue;
      if (exercise.unit !== 'reps' && exercise.unit !== 'seconds') continue;
      if (!supportsCameraTracking(exercise.exercise_name, exercise.unit)) continue;

      const remaining = remainingFor(exercise);
      if (remaining <= 0) continue;

      const unit = exercise.unit;
      const chunkSize = unit === 'seconds' ? DAILY_HOLD_CHUNK : DAILY_REP_CHUNK;
      const chunkAmount = Math.min(chunkSize, remaining);

      offers.push({
        id: `daily-chunk:${exercise.id}:${chunkAmount}`,
        kind: 'daily_chunk',
        title: `${formatTarget(chunkAmount, unit)} · ${exercise.exercise_name}`,
        subtitle: `From ${goal.gang_name ?? 'today'} · earn ${EARN_UNLOCK_MINUTES} min`,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        unit,
        targetAmount: chunkAmount,
        unlockMinutes: EARN_UNLOCK_MINUTES,
        dailyGoalId: goal.id,
        dailyGoalExerciseId: exercise.id,
        gangId: goal.gang_id,
        category: exercise.category,
      });

      // Skip "finish exercise" offers in dev — the 1-rep chunk is enough to test.
      if (!__DEV__ && remaining > chunkAmount) {
        offers.push({
          id: `daily-finish:${exercise.id}:${remaining}`,
          kind: 'daily_chunk',
          title: `Finish ${exercise.exercise_name}`,
          subtitle: `${formatTarget(remaining, unit)} left · earn ${EARN_UNLOCK_MINUTES} min`,
          exerciseId: exercise.exercise_id,
          exerciseName: exercise.exercise_name,
          unit,
          targetAmount: remaining,
          unlockMinutes: EARN_UNLOCK_MINUTES,
          dailyGoalId: goal.id,
          dailyGoalExerciseId: exercise.id,
          gangId: goal.gang_id,
          category: exercise.category,
        });
      }
    }
  }

  return offers;
}

/**
 * Resolve fixed quick-earn templates against the exercise catalog.
 * When the exercise is also on today's plan with remaining work, link it so
 * progress counts toward daily goals.
 */
export function buildQuickEarnOffers(
  catalog: Exercise[],
  todayGoals: DailyGoalWithProgress[],
): EarnOffer[] {
  const offers: EarnOffer[] = [];

  for (const template of QUICK_EARN_TEMPLATES) {
    const match = catalog.find((ex) => {
      if (ex.unit !== template.unit) return false;
      if (!supportsCameraTracking(ex.name, ex.unit)) return false;
      const type = getCameraExerciseType(ex.name);
      if (!type) return false;
      return ex.name.toLowerCase().includes(template.nameIncludes);
    });
    if (!match) continue;

    const daily = findDailyMatch(todayGoals, match.id);
    const creditsDaily = daily != null;

    offers.push({
      id: `quick:${template.nameIncludes}:${match.id}`,
      kind: 'quick_earn',
      title: template.label,
      subtitle: creditsDaily
        ? `Also counts toward today · earn ${template.minutes} min`
        : `Earn ${template.minutes} min of screen time`,
      exerciseId: match.id,
      exerciseName: match.name,
      unit: template.unit,
      targetAmount: template.amount,
      unlockMinutes: template.minutes,
      dailyGoalId: daily?.goal.id,
      dailyGoalExerciseId: daily?.exercise.id,
      gangId: daily?.goal.gang_id,
      category: match.category,
    });
  }

  return offers;
}

export function formatUnlockMinutes(minutes: number): string {
  return `${minutes} min`;
}

/** Live countdown label, e.g. `14:59` or `0:45`. */
export function formatRemainingCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatRemainingBudget(seconds: number): string {
  return formatRemainingCountdown(seconds);
}
