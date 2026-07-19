import { supportsCameraTracking } from '@/lib/rep-counting/exercise-registry';
import type { DailyGoalExerciseWithProgress, ExerciseUnit } from '@/types';

export const WORKOUT_MIN_CYCLES = 1;
export const WORKOUT_MAX_CYCLES = 5;

export interface WorkoutModeOptions {
  excludeCompletedExercises?: boolean;
}

export interface WorkoutSegment {
  exerciseId: string;
  dailyGoalExerciseId: string;
  exerciseName: string;
  unit: ExerciseUnit;
  /** Per-cycle cap for this segment (reps or seconds). */
  targetAmount: number;
  /** 1-based cycle index. */
  cycleIndex: number;
  cycleCount: number;
  /** 0-based index in the full workout queue. */
  segmentIndex: number;
  segmentCount: number;
}

/** Camera-trackable exercises with a positive individual target. */
export function getWorkoutEligibleExercises(
  exercises: DailyGoalExerciseWithProgress[],
  options: WorkoutModeOptions = {},
): DailyGoalExerciseWithProgress[] {
  return exercises.filter(
    (ex) =>
      supportsCameraTracking(ex.exercise_name, ex.unit) &&
      ex.individual_target > 0 &&
      (!options.excludeCompletedExercises || ex.user_total < ex.individual_target),
  );
}

/**
 * Split an integer target across cycles with remainder in earlier cycles.
 * Example: 10 / 3 → [4, 3, 3]
 */
export function splitTargetAcrossCycles(total: number, cycles: number): number[] {
  const safeCycles = Math.max(1, Math.floor(cycles));
  const safeTotal = Math.max(0, Math.floor(total));
  const base = Math.floor(safeTotal / safeCycles);
  const remainder = safeTotal % safeCycles;

  return Array.from({ length: safeCycles }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Max cycles the picker may offer: 1–5, but never more than the smallest
 * positive eligible target so every segment gets at least 1 unit.
 */
export function getMaxWorkoutCycles(
  exercises: DailyGoalExerciseWithProgress[],
  options: WorkoutModeOptions = {},
): number {
  const eligible = getWorkoutEligibleExercises(exercises, options);
  if (eligible.length === 0) return 0;

  const smallestTarget = Math.min(...eligible.map((ex) => ex.individual_target));
  return Math.max(
    WORKOUT_MIN_CYCLES,
    Math.min(WORKOUT_MAX_CYCLES, Math.floor(smallestTarget)),
  );
}

export function getAvailableWorkoutCycles(
  exercises: DailyGoalExerciseWithProgress[],
  options: WorkoutModeOptions = {},
): number[] {
  const max = getMaxWorkoutCycles(exercises, options);
  if (max < WORKOUT_MIN_CYCLES) return [];
  return Array.from({ length: max - WORKOUT_MIN_CYCLES + 1 }, (_, i) => WORKOUT_MIN_CYCLES + i);
}

/**
 * Build a round-ordered workout queue: each eligible exercise once per cycle.
 * Targets are split from the full individual target. When completed exercises
 * are excluded, exercises already complete at workout start are omitted.
 */
export function buildWorkoutQueue(
  exercises: DailyGoalExerciseWithProgress[],
  cycles: number,
  options: WorkoutModeOptions = {},
): WorkoutSegment[] {
  const eligible = getWorkoutEligibleExercises(exercises, options);
  const maxCycles = getMaxWorkoutCycles(eligible, options);
  const safeCycles = Math.max(
    WORKOUT_MIN_CYCLES,
    Math.min(Math.floor(cycles), maxCycles || WORKOUT_MIN_CYCLES),
  );

  if (eligible.length === 0 || maxCycles < WORKOUT_MIN_CYCLES) return [];

  const splitsByExerciseId = new Map<string, number[]>();
  for (const ex of eligible) {
    splitsByExerciseId.set(ex.id, splitTargetAcrossCycles(ex.individual_target, safeCycles));
  }

  const segments: WorkoutSegment[] = [];
  for (let cycle = 0; cycle < safeCycles; cycle += 1) {
    for (const ex of eligible) {
      const amounts = splitsByExerciseId.get(ex.id)!;
      const targetAmount = amounts[cycle] ?? 0;
      if (targetAmount <= 0) continue;

      segments.push({
        exerciseId: ex.exercise_id,
        dailyGoalExerciseId: ex.id,
        exerciseName: ex.exercise_name,
        unit: ex.unit,
        targetAmount,
        cycleIndex: cycle + 1,
        cycleCount: safeCycles,
        segmentIndex: segments.length,
        segmentCount: 0,
      });
    }
  }

  const segmentCount = segments.length;
  return segments.map((segment) => ({ ...segment, segmentCount }));
}

export function formatWorkoutProgressLabel(segment: WorkoutSegment): string {
  return `Cycle ${segment.cycleIndex}/${segment.cycleCount} · ${segment.segmentIndex + 1}/${segment.segmentCount}`;
}
