import { MIN_LANDMARK_VISIBILITY, PoseLandmarkIndex } from '@/lib/rep-counting/pose-landmarks';
import type { CameraExerciseType, Landmark } from '@/lib/rep-counting/types';
import { pickSide } from '@/utils/pose-math';

/** Allow tiny overflow so edge joints still count when the overlay draws them. */
const ON_CAMERA_SLOP = 0.02;

export interface BodyInFrameResult {
  ok: boolean;
  message: string;
}

/** True when the joint would still render on the skeleton overlay. */
function isLandmarkInFrame(landmark: Landmark | undefined): boolean {
  if (!landmark) return false;
  if (landmark.visibility < MIN_LANDMARK_VISIBILITY) return false;
  if (landmark.x < -ON_CAMERA_SLOP || landmark.x > 1 + ON_CAMERA_SLOP) return false;
  if (landmark.y < -ON_CAMERA_SLOP || landmark.y > 1 + ON_CAMERA_SLOP) return false;
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

/** Core moves only need one side's torso through knees — no arms or ankles. */
function checkCoreBodyInFrame(landmarks: Landmark[]): BodyInFrameResult {
  const leftIndices = [
    PoseLandmarkIndex.LEFT_SHOULDER,
    PoseLandmarkIndex.LEFT_HIP,
    PoseLandmarkIndex.LEFT_KNEE,
  ];
  const rightIndices = [
    PoseLandmarkIndex.RIGHT_SHOULDER,
    PoseLandmarkIndex.RIGHT_HIP,
    PoseLandmarkIndex.RIGHT_KNEE,
  ];

  const left = checkIndicesInFrame(landmarks, leftIndices, '');
  if (left.ok) return left;

  const right = checkIndicesInFrame(landmarks, rightIndices, '');
  if (right.ok) return right;

  return { ok: false, message: 'Keep your torso and knees in frame' };
}

/** Side-profile plank: one torso/knee chain + any one arm (can be opposite side). */
function checkPlankBodyInFrame(landmarks: Landmark[]): BodyInFrameResult {
  const leftBody = checkIndicesInFrame(
    landmarks,
    [
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.LEFT_HIP,
      PoseLandmarkIndex.LEFT_KNEE,
    ],
    '',
  );
  const rightBody = checkIndicesInFrame(
    landmarks,
    [
      PoseLandmarkIndex.RIGHT_SHOULDER,
      PoseLandmarkIndex.RIGHT_HIP,
      PoseLandmarkIndex.RIGHT_KNEE,
    ],
    '',
  );
  if (!leftBody.ok && !rightBody.ok) {
    return { ok: false, message: 'Keep shoulder, hip, and knee in frame' };
  }

  const leftArm = checkIndicesInFrame(
    landmarks,
    [PoseLandmarkIndex.LEFT_ELBOW, PoseLandmarkIndex.LEFT_WRIST],
    '',
  );
  const rightArm = checkIndicesInFrame(
    landmarks,
    [PoseLandmarkIndex.RIGHT_ELBOW, PoseLandmarkIndex.RIGHT_WRIST],
    '',
  );
  // Wrist alone is enough if the elbow is briefly occluded mid-hold.
  const leftWristOk = isLandmarkInFrame(landmarks[PoseLandmarkIndex.LEFT_WRIST]);
  const rightWristOk = isLandmarkInFrame(landmarks[PoseLandmarkIndex.RIGHT_WRIST]);
  if (leftArm.ok || rightArm.ok || leftWristOk || rightWristOk) {
    return { ok: true, message: '' };
  }

  return { ok: false, message: 'Keep one arm or wrist in frame' };
}

export function checkBodyInFrame(
  landmarks: Landmark[],
  exerciseType: CameraExerciseType,
): BodyInFrameResult {
  if (!landmarks || landmarks.length < 17) {
    return {
      ok: false,
      message: defaultFrameMessage(exerciseType),
    };
  }

  switch (exerciseType) {
    case 'pushup':
      return checkPushupBodyInFrame(landmarks);
    case 'squat':
    case 'lunge':
      return checkSquatBodyInFrame(landmarks);
    case 'plank':
      return checkPlankBodyInFrame(landmarks);
    case 'situp':
    case 'crunch':
      return checkCoreBodyInFrame(landmarks);
  }
}

function defaultFrameMessage(exerciseType: CameraExerciseType): string {
  if (exerciseType === 'pushup') return 'Keep your upper body in frame';
  if (exerciseType === 'situp' || exerciseType === 'crunch') {
    return 'Keep your torso and knees in frame';
  }
  if (exerciseType === 'plank') {
    return 'Keep shoulder, hip, knee, and one arm in frame';
  }
  return 'Step back — keep your full body in frame';
}
