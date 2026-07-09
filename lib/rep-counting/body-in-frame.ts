import { PoseLandmarkIndex } from '@/lib/rep-counting/pose-landmarks';
import type { CameraExerciseType, Landmark } from '@/lib/rep-counting/types';
import { pickSide } from '@/utils/pose-math';

const MIN_BODY_VISIBILITY = 0.5;
const FRAME_MARGIN = 0.06;

export interface BodyInFrameResult {
  ok: boolean;
  message: string;
}

function isLandmarkInFrame(landmark: Landmark | undefined): boolean {
  if (!landmark) return false;
  if (landmark.visibility < MIN_BODY_VISIBILITY) return false;
  if (landmark.x < FRAME_MARGIN || landmark.x > 1 - FRAME_MARGIN) return false;
  if (landmark.y < FRAME_MARGIN || landmark.y > 1 - FRAME_MARGIN) return false;
  return true;
}

function getUpperTorsoIndices(side: 'left' | 'right'): number[] {
  if (side === 'left') {
    return [
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.LEFT_ELBOW,
      PoseLandmarkIndex.LEFT_WRIST,
    ];
  }

  return [
    PoseLandmarkIndex.RIGHT_SHOULDER,
    PoseLandmarkIndex.RIGHT_ELBOW,
    PoseLandmarkIndex.RIGHT_WRIST,
  ];
}

function getFullBodyIndices(side: 'left' | 'right'): number[] {
  if (side === 'left') {
    return [
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.LEFT_ELBOW,
      PoseLandmarkIndex.LEFT_WRIST,
      PoseLandmarkIndex.LEFT_HIP,
      PoseLandmarkIndex.LEFT_KNEE,
      PoseLandmarkIndex.LEFT_ANKLE,
    ];
  }

  return [
    PoseLandmarkIndex.RIGHT_SHOULDER,
    PoseLandmarkIndex.RIGHT_ELBOW,
    PoseLandmarkIndex.RIGHT_WRIST,
    PoseLandmarkIndex.RIGHT_HIP,
    PoseLandmarkIndex.RIGHT_KNEE,
    PoseLandmarkIndex.RIGHT_ANKLE,
  ];
}

function checkIndicesInFrame(
  landmarks: Landmark[],
  indices: number[],
  message: string,
): BodyInFrameResult {
  const missing = indices.filter((index) => !isLandmarkInFrame(landmarks[index]));
  if (missing.length === 0) {
    return { ok: true, message: '' };
  }

  return { ok: false, message };
}

function checkPushupBodyInFrame(landmarks: Landmark[]): BodyInFrameResult {
  const side = pickSide(landmarks[PoseLandmarkIndex.LEFT_ELBOW], landmarks[PoseLandmarkIndex.RIGHT_ELBOW]);
  return checkIndicesInFrame(
    landmarks,
    getUpperTorsoIndices(side),
    'Keep your upper body in frame',
  );
}

function checkSquatBodyInFrame(landmarks: Landmark[]): BodyInFrameResult {
  const side = pickSide(landmarks[PoseLandmarkIndex.LEFT_KNEE], landmarks[PoseLandmarkIndex.RIGHT_KNEE]);
  const chain = checkIndicesInFrame(
    landmarks,
    getFullBodyIndices(side),
    'Step back — keep your full body in frame',
  );
  if (!chain.ok) return chain;

  const shouldersVisible =
    isLandmarkInFrame(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) ||
    isLandmarkInFrame(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]);
  if (!shouldersVisible) {
    return { ok: false, message: 'Step back — keep your full body in frame' };
  }

  return { ok: true, message: '' };
}

function checkSitupBodyInFrame(landmarks: Landmark[]): BodyInFrameResult {
  const side = pickSide(landmarks[PoseLandmarkIndex.LEFT_HIP], landmarks[PoseLandmarkIndex.RIGHT_HIP]);
  const indices =
    side === 'left'
      ? [
          PoseLandmarkIndex.LEFT_SHOULDER,
          PoseLandmarkIndex.LEFT_HIP,
          PoseLandmarkIndex.LEFT_KNEE,
          PoseLandmarkIndex.LEFT_ANKLE,
        ]
      : [
          PoseLandmarkIndex.RIGHT_SHOULDER,
          PoseLandmarkIndex.RIGHT_HIP,
          PoseLandmarkIndex.RIGHT_KNEE,
          PoseLandmarkIndex.RIGHT_ANKLE,
        ];

  const missing = indices.filter((index) => !isLandmarkInFrame(landmarks[index]));
  if (missing.length > 0) {
    return { ok: false, message: 'Step back — keep your full body in frame' };
  }

  return { ok: true, message: '' };
}

export function checkBodyInFrame(
  landmarks: Landmark[],
  exerciseType: CameraExerciseType,
): BodyInFrameResult {
  if (!landmarks || landmarks.length < 17) {
    return {
      ok: false,
      message:
        exerciseType === 'pushup'
          ? 'Keep your upper body in frame'
          : 'Step back — keep your full body in frame',
    };
  }

  switch (exerciseType) {
    case 'pushup':
      return checkPushupBodyInFrame(landmarks);
    case 'squat':
      return checkSquatBodyInFrame(landmarks);
    case 'situp':
      return checkSitupBodyInFrame(landmarks);
  }
}
