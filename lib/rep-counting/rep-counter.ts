import { checkBodyInFrame } from '@/lib/rep-counting/body-in-frame';
import { PoseLandmarkIndex } from '@/lib/rep-counting/pose-landmarks';
import type { CameraExerciseType, Landmark, RepPhase, RepCounterSnapshot } from '@/lib/rep-counting/types';
import { calculateAngle, pickSide } from '@/utils/pose-math';

export interface ExerciseConfig {
  type: CameraExerciseType;
  getAngle: (landmarks: Landmark[]) => number | null;
  upThreshold: number;
  downThreshold: number;
  minFramesInPhase: number;
  /** Which phase transition counts as one rep. */
  countTransition: 'down-to-up' | 'up-to-down';
  initialPhase: RepPhase;
}

function avgVisibility(...points: Landmark[]): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, p) => sum + p.visibility, 0) / points.length;
}

function elbowAngle(landmarks: Landmark[]): number | null {
  const side = pickSide(landmarks[PoseLandmarkIndex.LEFT_ELBOW], landmarks[PoseLandmarkIndex.RIGHT_ELBOW]);
  const shoulder =
    side === 'left'
      ? landmarks[PoseLandmarkIndex.LEFT_SHOULDER]
      : landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const elbow =
    side === 'left'
      ? landmarks[PoseLandmarkIndex.LEFT_ELBOW]
      : landmarks[PoseLandmarkIndex.RIGHT_ELBOW];
  const wrist =
    side === 'left'
      ? landmarks[PoseLandmarkIndex.LEFT_WRIST]
      : landmarks[PoseLandmarkIndex.RIGHT_WRIST];

  if (avgVisibility(shoulder, elbow, wrist) < 0.45) return null;
  return calculateAngle(shoulder, elbow, wrist);
}

function kneeAngle(landmarks: Landmark[]): number | null {
  const side = pickSide(landmarks[PoseLandmarkIndex.LEFT_KNEE], landmarks[PoseLandmarkIndex.RIGHT_KNEE]);
  const hip =
    side === 'left' ? landmarks[PoseLandmarkIndex.LEFT_HIP] : landmarks[PoseLandmarkIndex.RIGHT_HIP];
  const knee =
    side === 'left' ? landmarks[PoseLandmarkIndex.LEFT_KNEE] : landmarks[PoseLandmarkIndex.RIGHT_KNEE];
  const ankle =
    side === 'left' ? landmarks[PoseLandmarkIndex.LEFT_ANKLE] : landmarks[PoseLandmarkIndex.RIGHT_ANKLE];

  if (avgVisibility(hip, knee, ankle) < 0.45) return null;
  return calculateAngle(hip, knee, ankle);
}

function hipAngle(landmarks: Landmark[]): number | null {
  const side = pickSide(landmarks[PoseLandmarkIndex.LEFT_HIP], landmarks[PoseLandmarkIndex.RIGHT_HIP]);
  const shoulder =
    side === 'left'
      ? landmarks[PoseLandmarkIndex.LEFT_SHOULDER]
      : landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const hip =
    side === 'left' ? landmarks[PoseLandmarkIndex.LEFT_HIP] : landmarks[PoseLandmarkIndex.RIGHT_HIP];
  const knee =
    side === 'left' ? landmarks[PoseLandmarkIndex.LEFT_KNEE] : landmarks[PoseLandmarkIndex.RIGHT_KNEE];

  if (avgVisibility(shoulder, hip, knee) < 0.45) return null;
  return calculateAngle(shoulder, hip, knee);
}

export const EXERCISE_CONFIGS: Record<CameraExerciseType, ExerciseConfig> = {
  pushup: {
    type: 'pushup',
    getAngle: elbowAngle,
    upThreshold: 155,
    downThreshold: 95,
    minFramesInPhase: 3,
    countTransition: 'down-to-up',
    initialPhase: 'up',
  },
  squat: {
    type: 'squat',
    getAngle: kneeAngle,
    upThreshold: 155,
    downThreshold: 100,
    minFramesInPhase: 3,
    countTransition: 'down-to-up',
    initialPhase: 'up',
  },
  situp: {
    type: 'situp',
    getAngle: hipAngle,
    upThreshold: 85,
    downThreshold: 130,
    minFramesInPhase: 4,
    countTransition: 'up-to-down',
    initialPhase: 'down',
  },
};

export class RepCounter {
  private phase: RepPhase;
  private framesInPhase = 0;
  private pendingPhase: RepPhase | null = null;
  private pendingFrames = 0;
  public repCount = 0;
  private lastAngle = 0;
  private trackingOk = false;
  private fullyInFrame = false;
  private frameMessage: string;

  constructor(private config: ExerciseConfig) {
    this.phase = config.initialPhase;
    this.frameMessage =
      config.type === 'pushup'
        ? 'Keep your upper body in frame'
        : 'Step back — keep your full body in frame';
  }

  reset() {
    this.resetPhaseState();
    this.repCount = 0;
    this.lastAngle = 0;
    this.trackingOk = false;
    this.fullyInFrame = false;
    this.frameMessage =
      this.config.type === 'pushup'
        ? 'Keep your upper body in frame'
        : 'Step back — keep your full body in frame';
  }

  private resetPhaseState() {
    this.phase = this.config.initialPhase;
    this.framesInPhase = 0;
    this.pendingPhase = null;
    this.pendingFrames = 0;
  }

  processFrame(landmarks: Landmark[]): RepCounterSnapshot {
    const frameCheck = checkBodyInFrame(landmarks, this.config.type);
    this.fullyInFrame = frameCheck.ok;
    this.frameMessage = frameCheck.message;

    if (!frameCheck.ok) {
      this.trackingOk = false;
      this.resetPhaseState();
      return this.snapshot();
    }

    const angle = this.config.getAngle(landmarks);
    this.trackingOk = angle !== null;

    if (angle === null) {
      this.resetPhaseState();
      return this.snapshot();
    }

    this.lastAngle = angle;

    const targetPhase: RepPhase =
      angle > this.config.upThreshold
        ? 'up'
        : angle < this.config.downThreshold
          ? 'down'
          : 'transition';

    if (targetPhase === 'transition') {
      return this.snapshot();
    }

    if (targetPhase === this.phase) {
      this.pendingPhase = null;
      this.pendingFrames = 0;
      this.framesInPhase++;
      return this.snapshot();
    }

    if (targetPhase === this.pendingPhase) {
      this.pendingFrames++;
    } else {
      this.pendingPhase = targetPhase;
      this.pendingFrames = 1;
    }

    if (this.pendingFrames < this.config.minFramesInPhase) {
      return this.snapshot();
    }

    const previousPhase = this.phase;
    this.phase = targetPhase;
    this.pendingPhase = null;
    this.pendingFrames = 0;
    this.framesInPhase = 1;

    const completedDownToUp = previousPhase === 'down' && targetPhase === 'up';
    const completedUpToDown = previousPhase === 'up' && targetPhase === 'down';

    const shouldCount =
      (this.config.countTransition === 'down-to-up' && completedDownToUp) ||
      (this.config.countTransition === 'up-to-down' && completedUpToDown);

    if (shouldCount) {
      this.repCount++;
    }

    return this.snapshot();
  }

  snapshot(): RepCounterSnapshot {
    return {
      repCount: this.repCount,
      phase: this.phase,
      angle: this.lastAngle,
      trackingOk: this.trackingOk,
      fullyInFrame: this.fullyInFrame,
      frameMessage: this.frameMessage,
    };
  }
}

export function createRepCounter(type: CameraExerciseType): RepCounter {
  return new RepCounter(EXERCISE_CONFIGS[type]);
}
