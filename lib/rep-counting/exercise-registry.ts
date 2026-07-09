import type { CameraExerciseType, ExerciseSetupInfo } from '@/lib/rep-counting/types';

const EXERCISE_NAME_MAP: Record<string, CameraExerciseType> = {
  'push-ups': 'pushup',
  'push-up': 'pushup',
  pushups: 'pushup',
  pushup: 'pushup',
  'wide push-ups': 'pushup',
  'diamond push-ups': 'pushup',
  'decline push-ups': 'pushup',
  'bodyweight squats': 'squat',
  squat: 'squat',
  squats: 'squat',
  'jump squats': 'squat',
  'bulgarian split squat': 'squat',
  'sit-ups': 'situp',
  'sit-up': 'situp',
  situps: 'situp',
  situp: 'situp',
};

export const SETUP_GUIDES: Record<CameraExerciseType, ExerciseSetupInfo> = {
  pushup: {
    title: 'Push-ups',
    cameraHint: 'side',
    tips: [
      'Place the phone so your upper body is visible.',
      'Keep shoulders, elbows, and wrists in frame.',
      'Go all the way down and fully extend at the top.',
    ],
  },
  squat: {
    title: 'Squats',
    cameraHint: 'front-or-side',
    tips: [
      'Frame your hips, knees, and ankles in view.',
      'Front or side angle both work — stay consistent.',
      'Hit depth each rep before standing back up.',
    ],
  },
  situp: {
    title: 'Sit-ups',
    cameraHint: 'side',
    tips: [
      'Film from the side — sit-ups need a profile view.',
      'Keep shoulders, hips, and knees visible.',
      'Lower all the way down, then curl up fully.',
    ],
  },
};

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCameraExerciseType(exerciseName: string): CameraExerciseType | null {
  const key = normalizeExerciseName(exerciseName);
  if (EXERCISE_NAME_MAP[key]) return EXERCISE_NAME_MAP[key];

  if (key.includes('push')) return 'pushup';
  if (key.includes('squat')) return 'squat';
  if (key.includes('sit')) return 'situp';

  return null;
}

export function supportsCameraRepCounting(exerciseName: string): boolean {
  return getCameraExerciseType(exerciseName) !== null;
}

export function isPushupVariant(exerciseName: string): boolean {
  return getCameraExerciseType(exerciseName) === 'pushup';
}
