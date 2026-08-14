import type { ImageSource } from 'expo-image';

import { normalizeExerciseName } from '@/lib/rep-counting/exercise-registry';

/** Canonical keys for catalog exercises that have art. */
export type ExerciseIconKey =
  | 'pushup'
  | 'pullup'
  | 'squat'
  | 'lunge'
  | 'situp'
  | 'crunch'
  | 'plank'
  | 'jumping-jacks';

const EXERCISE_ICON_SOURCES: Record<ExerciseIconKey, ImageSource> = {
  pushup: require('../assets/images/exercises/push-up.png'),
  pullup: require('../assets/images/exercises/pull-up.png'),
  squat: require('../assets/images/exercises/squat.png'),
  lunge: require('../assets/images/exercises/lunge.png'),
  situp: require('../assets/images/exercises/sit-up.png'),
  crunch: require('../assets/images/exercises/crunch.png'),
  plank: require('../assets/images/exercises/plank.png'),
  'jumping-jacks': require('../assets/images/exercises/jumping-jacks.png'),
};

const EXERCISE_NAME_TO_ICON: Record<string, ExerciseIconKey> = {
  'push-ups': 'pushup',
  'push-up': 'pushup',
  pushups: 'pushup',
  pushup: 'pushup',
  'pull-ups': 'pullup',
  'pull-up': 'pullup',
  pullups: 'pullup',
  pullup: 'pullup',
  'bodyweight squats': 'squat',
  squat: 'squat',
  squats: 'squat',
  lunges: 'lunge',
  lunge: 'lunge',
  'sit-ups': 'situp',
  'sit-up': 'situp',
  situps: 'situp',
  situp: 'situp',
  crunches: 'crunch',
  crunch: 'crunch',
  plank: 'plank',
  planks: 'plank',
  'jumping jacks': 'jumping-jacks',
  'jumping jack': 'jumping-jacks',
  jumpingjacks: 'jumping-jacks',
};

export function getExerciseIconKey(exerciseName: string): ExerciseIconKey | null {
  const key = normalizeExerciseName(exerciseName);
  if (EXERCISE_NAME_TO_ICON[key]) return EXERCISE_NAME_TO_ICON[key];

  if (key.includes('jumping') && key.includes('jack')) return 'jumping-jacks';
  if (key.includes('pull')) return 'pullup';
  if (key.includes('push')) return 'pushup';
  if (key.includes('lunge')) return 'lunge';
  if (key.includes('squat')) return 'squat';
  if (key.includes('crunch')) return 'crunch';
  if (key.includes('plank')) return 'plank';
  if (key.includes('sit')) return 'situp';

  return null;
}

export function getExerciseIconSource(exerciseName: string): ImageSource | null {
  const key = getExerciseIconKey(exerciseName);
  return key ? EXERCISE_ICON_SOURCES[key] : null;
}
