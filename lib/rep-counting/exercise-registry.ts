import type {
  CameraExerciseType,
  CameraTrackingMode,
  ExerciseSetupInfo,
} from '@/lib/rep-counting/types';

const EXERCISE_NAME_MAP: Record<string, CameraExerciseType> = {
  'push-ups': 'pushup',
  'push-up': 'pushup',
  pushups: 'pushup',
  pushup: 'pushup',
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
};

export const SETUP_GUIDES: Record<CameraExerciseType, ExerciseSetupInfo> = {
  pushup: {
    title: 'Push-ups',
    cameraHint: 'front-or-side',
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
  lunge: {
    title: 'Lunges',
    cameraHint: 'side',
    tips: [
      'Film from the side or front so your stride is visible.',
      'Keep hips, both knees, and ankles in frame.',
      'Drop until the front thigh is roughly parallel, then stand tall.',
      'Alternating legs is fine — each lunge counts as one rep.',
    ],
  },
  situp: {
    title: 'Sit-ups',
    cameraHint: 'side',
    tips: [
      'Film from the side — sit-ups need a profile view.',
      'Bend your knees so they sit above your hips and torso before starting.',
      'Keep shoulders, hips, and knees visible (arms optional).',
      'Lower all the way down, then curl up fully.',
    ],
  },
  crunch: {
    title: 'Crunches',
    cameraHint: 'side',
    tips: [
      'Film from the side — crunches need a profile view.',
      'Hold tabletop: legs up, knees bent ~90°, then keep them there.',
      'Curl your shoulders/torso toward your knees — don’t pull your knees in.',
      'Lower your shoulders back down to finish the rep.',
    ],
  },
  plank: {
    title: 'Plank',
    cameraHint: 'side',
    tips: [
      'Film from the side — high plank or forearm plank both work.',
      'Keep shoulder, hip, and one knee in frame, plus one arm.',
      'Knees stay off the ground — bent legs are fine if knees stay up.',
      'Hips stay lifted off the ground in a straight body line.',
    ],
  },
};

/** Shared clip shown on page 1 of the pre-camera setup pager. */
export const CAMERA_SETUP_VIDEO = require('../../assets/videos/user-tutorials/camera-setup.mov');

/** Local tutorial clips shown on the pre-camera setup screen (muted, looping). */
export const EXERCISE_TUTORIAL_VIDEOS: Record<CameraExerciseType, number> = {
  pushup: require('../../assets/videos/exercise-video-tutorials/pushup.mov'),
  squat: require('../../assets/videos/exercise-video-tutorials/squats.mov'),
  lunge: require('../../assets/videos/exercise-video-tutorials/lunge.mov'),
  situp: require('../../assets/videos/exercise-video-tutorials/situps.mov'),
  crunch: require('../../assets/videos/exercise-video-tutorials/crunch.mov'),
  plank: require('../../assets/videos/exercise-video-tutorials/plank.mov'),
};

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCameraExerciseType(exerciseName: string): CameraExerciseType | null {
  const key = normalizeExerciseName(exerciseName);
  if (EXERCISE_NAME_MAP[key]) return EXERCISE_NAME_MAP[key];

  if (key.includes('push')) return 'pushup';
  if (key.includes('lunge')) return 'lunge';
  if (key.includes('squat')) return 'squat';
  if (key.includes('crunch')) return 'crunch';
  if (key.includes('plank')) return 'plank';
  if (key.includes('sit')) return 'situp';

  return null;
}

export function getCameraTrackingMode(type: CameraExerciseType): CameraTrackingMode {
  return type === 'plank' ? 'hold' : 'reps';
}

/** True when this exercise name has camera logic (ignores unit). */
export function supportsCameraRepCounting(exerciseName: string): boolean {
  return getCameraExerciseType(exerciseName) !== null;
}

/** True when camera tracking is available for this exercise + unit pair. */
export function supportsCameraTracking(exerciseName: string, unit: string): boolean {
  const type = getCameraExerciseType(exerciseName);
  if (!type) return false;
  const normalizedUnit = unit.trim().toLowerCase();
  return getCameraTrackingMode(type) === 'hold'
    ? normalizedUnit === 'seconds'
    : normalizedUnit === 'reps';
}

export function isPushupVariant(exerciseName: string): boolean {
  return getCameraExerciseType(exerciseName) === 'pushup';
}
