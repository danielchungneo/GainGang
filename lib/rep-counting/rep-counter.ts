import { checkBodyInFrame } from '@/lib/rep-counting/body-in-frame';
import { PoseLandmarkIndex } from '@/lib/rep-counting/pose-landmarks';
import type { CameraExerciseType, Landmark, RepPhase, RepCounterSnapshot } from '@/lib/rep-counting/types';
import {
  calculateAngle,
  elevationFromHorizontal,
  pickBestLandmarkSide,
  pickSide,
} from '@/utils/pose-math';

export interface ReadyCheckResult {
  ok: boolean;
  message: string;
}

export interface ExerciseConfig {
  type: CameraExerciseType;
  getAngle: (landmarks: Landmark[]) => number | null;
  upThreshold: number;
  downThreshold: number;
  minFramesInPhase: number;
  /** Which phase transition counts as one rep. */
  countTransition: 'down-to-up' | 'up-to-down';
  initialPhase: RepPhase;
  /** Optional pose gate — blocks phase/rep updates until ready (e.g. knees up). */
  isReady?: (landmarks: Landmark[]) => ReadyCheckResult;
  /**
   * When true, a successful isReady check arms counting for the rest of the
   * in-frame session (so curling the torso mid-rep won't disarm the gate).
   */
  latchReady?: boolean;
}

const CORE_VISIBILITY_MIN = 0.45;
/** Knee must sit this far above hip/shoulder (normalized image y). */
const KNEE_ABOVE_MARGIN = 0.05;
/** Thigh should be closer to vertical than horizontal while in tabletop. */
const CRUNCH_THIGH_VERTICAL_RATIO = 0.85;

function avgVisibility(...points: Landmark[]): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, p) => sum + p.visibility, 0) / points.length;
}

interface CoreChain {
  shoulder: Landmark;
  hip: Landmark;
  knee: Landmark;
}

function getCoreChain(landmarks: Landmark[], side: 'left' | 'right'): CoreChain {
  if (side === 'left') {
    return {
      shoulder: landmarks[PoseLandmarkIndex.LEFT_SHOULDER],
      hip: landmarks[PoseLandmarkIndex.LEFT_HIP],
      knee: landmarks[PoseLandmarkIndex.LEFT_KNEE],
    };
  }

  return {
    shoulder: landmarks[PoseLandmarkIndex.RIGHT_SHOULDER],
    hip: landmarks[PoseLandmarkIndex.RIGHT_HIP],
    knee: landmarks[PoseLandmarkIndex.RIGHT_KNEE],
  };
}

function pickBestCoreSide(landmarks: Landmark[]): 'left' | 'right' {
  const left = getCoreChain(landmarks, 'left');
  const right = getCoreChain(landmarks, 'right');
  return pickBestLandmarkSide(
    [left.shoulder, left.hip, left.knee],
    [right.shoulder, right.hip, right.knee],
  );
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

  if (avgVisibility(shoulder, elbow, wrist) < CORE_VISIBILITY_MIN) return null;
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

  if (avgVisibility(hip, knee, ankle) < CORE_VISIBILITY_MIN) return null;
  return calculateAngle(hip, knee, ankle);
}

/** Min visible knee angle — captures the bent front/back leg during a lunge. */
function minKneeAngle(landmarks: Landmark[]): number | null {
  const leftHip = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const leftKnee = landmarks[PoseLandmarkIndex.LEFT_KNEE];
  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightHip = landmarks[PoseLandmarkIndex.RIGHT_HIP];
  const rightKnee = landmarks[PoseLandmarkIndex.RIGHT_KNEE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];

  const angles: number[] = [];
  if (avgVisibility(leftHip, leftKnee, leftAnkle) >= CORE_VISIBILITY_MIN) {
    angles.push(calculateAngle(leftHip, leftKnee, leftAnkle));
  }
  if (avgVisibility(rightHip, rightKnee, rightAnkle) >= CORE_VISIBILITY_MIN) {
    angles.push(calculateAngle(rightHip, rightKnee, rightAnkle));
  }
  if (angles.length === 0) return null;
  return Math.min(...angles);
}

function hipAngle(landmarks: Landmark[]): number | null {
  const chain = getCoreChain(landmarks, pickBestCoreSide(landmarks));
  if (avgVisibility(chain.shoulder, chain.hip, chain.knee) < CORE_VISIBILITY_MIN) return null;
  return calculateAngle(chain.shoulder, chain.hip, chain.knee);
}

/**
 * Torso curl only: how far hip→shoulder lifts off horizontal.
 * Bringing knees to the head barely changes this; lifting the shoulders does.
 */
function crunchTorsoElevation(landmarks: Landmark[]): number | null {
  const chain = getCoreChain(landmarks, pickBestCoreSide(landmarks));
  if (avgVisibility(chain.shoulder, chain.hip, chain.knee) < CORE_VISIBILITY_MIN) return null;
  if (!isTabletopThigh(chain.hip, chain.knee)) return null;
  return elevationFromHorizontal(chain.hip, chain.shoulder);
}

function isTabletopThigh(hip: Landmark, knee: Landmark): boolean {
  const rise = hip.y - knee.y;
  if (rise < KNEE_ABOVE_MARGIN) return false;
  const run = Math.abs(knee.x - hip.x);
  return rise >= run * CRUNCH_THIGH_VERTICAL_RATIO;
}

/** Image y grows downward — smaller y means higher on screen. */
function kneesAboveHipAndShoulder(chain: CoreChain): boolean {
  return (
    chain.knee.y < chain.hip.y - KNEE_ABOVE_MARGIN &&
    chain.knee.y < chain.shoulder.y - KNEE_ABOVE_MARGIN
  );
}

/**
 * Ready when any visible side has tabletop legs (knee above hip, thigh mostly
 * vertical). Do not require knee above shoulder — that breaks mid-crunch as
 * the torso lifts. Feet-on-floor sit-ups fail the vertical-thigh check.
 */
function isCrunchReady(landmarks: Landmark[]): ReadyCheckResult {
  const sides: Array<'left' | 'right'> = ['left', 'right'];
  let hasVisibleChain = false;

  for (const side of sides) {
    const chain = getCoreChain(landmarks, side);
    if (avgVisibility(chain.shoulder, chain.hip, chain.knee) < CORE_VISIBILITY_MIN) continue;
    hasVisibleChain = true;
    if (isTabletopThigh(chain.hip, chain.knee)) {
      return { ok: true, message: '' };
    }
  }

  return {
    ok: false,
    message: hasVisibleChain
      ? 'Hold tabletop — knees above hips, thighs vertical'
      : 'Turn sideways — keep one shoulder, hip, and knee visible',
  };
}

/**
 * Sit-up setup gate: knees must sit above both hips and shoulders before
 * counting arms. Latched afterward so curling up doesn't disarm the gate.
 */
function isSitupReady(landmarks: Landmark[]): ReadyCheckResult {
  const sides: Array<'left' | 'right'> = ['left', 'right'];
  let hasVisibleChain = false;

  for (const side of sides) {
    const chain = getCoreChain(landmarks, side);
    if (avgVisibility(chain.shoulder, chain.hip, chain.knee) < CORE_VISIBILITY_MIN) continue;
    hasVisibleChain = true;
    if (kneesAboveHipAndShoulder(chain)) {
      return { ok: true, message: '' };
    }
  }

  return {
    ok: false,
    message: hasVisibleChain
      ? 'Raise your knees above your hips and torso to start'
      : 'Turn sideways — keep one shoulder, hip, and knee visible',
  };
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
    downThreshold: 110,
    minFramesInPhase: 3,
    countTransition: 'down-to-up',
    initialPhase: 'up',
  },
  lunge: {
    type: 'lunge',
    getAngle: minKneeAngle,
    upThreshold: 155,
    downThreshold: 105,
    minFramesInPhase: 3,
    countTransition: 'down-to-up',
    initialPhase: 'up',
  },
  situp: {
    type: 'situp',
    getAngle: hipAngle,
    // Core style: small angle = curled (up), large = flat (down).
    upThreshold: 95,
    downThreshold: 130,
    minFramesInPhase: 4,
    countTransition: 'down-to-up',
    initialPhase: 'down',
    isReady: isSitupReady,
    latchReady: true,
  },
  // Tracks torso lift off the floor (not knee tucks). Larger elevation = curled.
  crunch: {
    type: 'crunch',
    getAngle: crunchTorsoElevation,
    upThreshold: 8,
    downThreshold: 5,
    minFramesInPhase: 3,
    countTransition: 'down-to-up',
    initialPhase: 'down',
    isReady: isCrunchReady,
  },
  // Plank uses HoldCounter — placeholder so the Record stays exhaustive.
  plank: {
    type: 'plank',
    getAngle: () => null,
    upThreshold: 0,
    downThreshold: 0,
    minFramesInPhase: 1,
    countTransition: 'down-to-up',
    initialPhase: 'up',
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
  private readyLatched = false;

  constructor(private config: ExerciseConfig) {
    this.phase = config.initialPhase;
    this.frameMessage = defaultRepFrameMessage(config.type);
  }

  reset() {
    this.resetPhaseState();
    this.readyLatched = false;
    this.repCount = 0;
    this.lastAngle = 0;
    this.trackingOk = false;
    this.fullyInFrame = false;
    this.frameMessage = defaultRepFrameMessage(this.config.type);
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
      this.readyLatched = false;
      this.resetPhaseState();
      return this.snapshot();
    }

    if (this.config.isReady) {
      const ready = this.config.isReady(landmarks);
      if (ready.ok) {
        this.readyLatched = true;
      } else if (!this.config.latchReady || !this.readyLatched) {
        this.trackingOk = false;
        this.frameMessage = ready.message;
        this.resetPhaseState();
        return this.snapshot();
      }
    }

    const angle = this.config.getAngle(landmarks);
    this.trackingOk = angle !== null;

    if (angle === null) {
      this.resetPhaseState();
      return this.snapshot();
    }

    this.lastAngle = angle;

    const targetPhase = resolveTargetPhase(angle, this.config);

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

/**
 * Push-up/squat/crunch: large angle = up, small = down (upThreshold > downThreshold).
 * Sit-up: small angle = curled/up, large = open/down (upThreshold < downThreshold).
 */
function resolveTargetPhase(angle: number, config: ExerciseConfig): RepPhase {
  const { upThreshold, downThreshold } = config;
  const isCoreStyle = upThreshold < downThreshold;

  if (isCoreStyle) {
    if (angle < upThreshold) return 'up';
    if (angle > downThreshold) return 'down';
    return 'transition';
  }

  if (angle > upThreshold) return 'up';
  if (angle < downThreshold) return 'down';
  return 'transition';
}

function defaultRepFrameMessage(type: CameraExerciseType): string {
  if (type === 'pushup') return 'Keep your upper body in frame';
  if (type === 'situp' || type === 'crunch') return 'Keep your torso and knees in frame';
  if (type === 'plank') return 'Keep shoulder, hip, knee, and one arm in frame';
  return 'Step back — keep your full body in frame';
}

export function createRepCounter(type: CameraExerciseType): RepCounter {
  if (type === 'plank') {
    throw new Error('Plank uses HoldCounter — call createHoldCounter instead');
  }
  return new RepCounter(EXERCISE_CONFIGS[type]);
}
