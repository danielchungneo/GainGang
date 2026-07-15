import { checkBodyInFrame } from '@/lib/rep-counting/body-in-frame';
import { PoseLandmarkIndex } from '@/lib/rep-counting/pose-landmarks';
import type {
  CameraExerciseType,
  HoldCounterSnapshot,
  HoldPhase,
  Landmark,
} from '@/lib/rep-counting/types';
import { pickBestLandmarkSide } from '@/utils/pose-math';

export interface PlankPoseResult {
  ok: boolean;
  message: string;
}

const VISIBILITY_MIN = 0.35;
/** Shoulder–hip line can sit this far off horizontal (degrees). */
const MAX_TORSO_TILT_DEG = 52;
/** Image y grows downward — hips must sit this far above wrists. */
const HIP_ABOVE_WRIST_MARGIN = 0.05;
/** Knee is treated as on the ground when this close to the wrist (floor). */
const KNEE_ON_GROUND_MARGIN = 0.05;
/**
 * Max how far hips may sit below shoulders (sag). Larger y = lower on screen.
 */
const MAX_HIP_SAG = 0.12;
/**
 * Support (wrist/elbow) must be at least this far below the shoulder.
 * Slightly negative so a chin tuck that pulls estimated shoulders downward
 * does not falsely fail a still-valid plank.
 */
const SUPPORT_BELOW_SHOULDER_MIN = -0.02;
/** Require pose stable this many frames before starting countdown / resume delay. */
const READY_FRAMES = 8;
/**
 * Frames of bad form / tracking before pausing an active hold.
 * Long enough to ride out brief BlazePose blips when the head drops.
 */
const BREAK_FRAMES = 15;
const COUNTDOWN_MS = 3000;
/** Delay after form recovers mid-hold before the timer resumes counting. */
const RESUME_DELAY_MS = 2000;

function avgVisibility(...points: Landmark[]): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, p) => sum + p.visibility, 0) / points.length;
}

interface PlankSide {
  shoulder: Landmark;
  hip: Landmark;
  knee: Landmark;
  elbow: Landmark;
  wrist: Landmark;
}

function getPlankSide(landmarks: Landmark[], side: 'left' | 'right'): PlankSide {
  if (side === 'left') {
    return {
      shoulder: landmarks[PoseLandmarkIndex.LEFT_SHOULDER],
      hip: landmarks[PoseLandmarkIndex.LEFT_HIP],
      knee: landmarks[PoseLandmarkIndex.LEFT_KNEE],
      elbow: landmarks[PoseLandmarkIndex.LEFT_ELBOW],
      wrist: landmarks[PoseLandmarkIndex.LEFT_WRIST],
    };
  }

  return {
    shoulder: landmarks[PoseLandmarkIndex.RIGHT_SHOULDER],
    hip: landmarks[PoseLandmarkIndex.RIGHT_HIP],
    knee: landmarks[PoseLandmarkIndex.RIGHT_KNEE],
    elbow: landmarks[PoseLandmarkIndex.RIGHT_ELBOW],
    wrist: landmarks[PoseLandmarkIndex.RIGHT_WRIST],
  };
}

/** Prefer the clearer torso/leg chain (arms chosen separately). */
function pickBestBodySide(landmarks: Landmark[]): 'left' | 'right' {
  const left = getPlankSide(landmarks, 'left');
  const right = getPlankSide(landmarks, 'right');
  return pickBestLandmarkSide(
    [left.shoulder, left.hip, left.knee],
    [right.shoulder, right.hip, right.knee],
  );
}

/** Prefer whichever arm/wrist is more visible — may differ from the body side. */
function pickBestArmSide(landmarks: Landmark[]): 'left' | 'right' {
  const left = getPlankSide(landmarks, 'left');
  const right = getPlankSide(landmarks, 'right');
  return pickBestLandmarkSide(
    [left.elbow, left.wrist],
    [right.elbow, right.wrist],
  );
}

/** Degrees the shoulder→hip vector sits off horizontal (0 = flat plank torso). */
function torsoTiltFromHorizontal(shoulder: Landmark, hip: Landmark): number {
  const dx = hip.x - shoulder.x;
  const dy = hip.y - shoulder.y;
  const deg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  return deg > 90 ? 180 - deg : deg;
}

function isKneeOnGround(knee: Landmark, floorY: number): boolean {
  if (knee.visibility < VISIBILITY_MIN) return false;
  return knee.y >= floorY - KNEE_ON_GROUND_MARGIN;
}

/**
 * Side-profile plank: one torso/leg chain + any one arm.
 * A visible knee on the ground fails the hold; legs need not be straight.
 */
export function isPlankPose(landmarks: Landmark[]): PlankPoseResult {
  const body = getPlankSide(landmarks, pickBestBodySide(landmarks));
  const arm = getPlankSide(landmarks, pickBestArmSide(landmarks));
  const left = getPlankSide(landmarks, 'left');
  const right = getPlankSide(landmarks, 'right');

  if (avgVisibility(body.shoulder, body.hip, body.knee) < VISIBILITY_MIN) {
    return {
      ok: false,
      message: 'Turn sideways — keep shoulder, hip, and knee visible',
    };
  }

  const armVisible =
    avgVisibility(arm.elbow, arm.wrist) >= VISIBILITY_MIN ||
    arm.wrist.visibility >= VISIBILITY_MIN;
  if (!armVisible) {
    return { ok: false, message: 'Keep one arm or wrist visible' };
  }

  const tilt = torsoTiltFromHorizontal(body.shoulder, body.hip);
  if (tilt > MAX_TORSO_TILT_DEG) {
    return { ok: false, message: 'Get horizontal — drop into a plank' };
  }

  const supportY = Math.max(arm.wrist.y, arm.elbow.visibility >= VISIBILITY_MIN ? arm.elbow.y : arm.wrist.y);

  // Support hand should sit at/below shoulders (planted on the floor).
  if (supportY < body.shoulder.y + SUPPORT_BELOW_SHOULDER_MIN) {
    return { ok: false, message: 'Plant your arms under your shoulders' };
  }

  // Hips must be clearly off the floor.
  if (body.hip.y >= supportY - HIP_ABOVE_WRIST_MARGIN) {
    return { ok: false, message: 'Lift your hips off the ground' };
  }

  if (body.hip.y > body.shoulder.y + MAX_HIP_SAG) {
    return { ok: false, message: 'Lift your hips a bit' };
  }

  // Only fail the leg check when a visible knee is on the ground.
  if (isKneeOnGround(left.knee, supportY) || isKneeOnGround(right.knee, supportY)) {
    return { ok: false, message: 'Keep your knees off the ground' };
  }

  return { ok: true, message: '' };
}

export class HoldCounter {
  private phase: HoldPhase = 'waiting';
  private readyFrames = 0;
  private breakFrames = 0;
  private countdownStartedAt: number | null = null;
  private resumeStartedAt: number | null = null;
  private holdSegmentStartedAt: number | null = null;
  private accumulatedMs = 0;
  private countdownRemaining = 0;
  private trackingOk = false;
  private fullyInFrame = false;
  private frameMessage: string;

  constructor(private exerciseType: CameraExerciseType = 'plank') {
    this.frameMessage = 'Get into plank position';
  }

  reset() {
    this.phase = 'waiting';
    this.readyFrames = 0;
    this.breakFrames = 0;
    this.countdownStartedAt = null;
    this.resumeStartedAt = null;
    this.holdSegmentStartedAt = null;
    this.accumulatedMs = 0;
    this.countdownRemaining = 0;
    this.trackingOk = false;
    this.fullyInFrame = false;
    this.frameMessage = 'Get into plank position';
  }

  /** Restore elapsed time when remounting after review ("Keep going"). */
  seedElapsedSeconds(seconds: number) {
    this.accumulatedMs = Math.max(0, Math.floor(seconds)) * 1000;
    this.holdSegmentStartedAt = null;
    this.phase = 'waiting';
    this.readyFrames = 0;
    this.breakFrames = 0;
    this.countdownStartedAt = null;
    this.resumeStartedAt = null;
    this.countdownRemaining = 0;
    this.frameMessage =
      seconds > 0 ? 'Get back into plank to continue' : 'Get into plank position';
  }

  /** Whole seconds held (excludes pauses and countdown). */
  get elapsedSeconds(): number {
    return Math.floor(this.elapsedMs() / 1000);
  }

  private elapsedMs(): number {
    let total = this.accumulatedMs;
    if (this.phase === 'holding' && this.holdSegmentStartedAt !== null) {
      total += Date.now() - this.holdSegmentStartedAt;
    }
    return total;
  }

  private pauseHold() {
    if (this.holdSegmentStartedAt !== null) {
      this.accumulatedMs += Date.now() - this.holdSegmentStartedAt;
      this.holdSegmentStartedAt = null;
    }
    this.phase = 'paused';
    this.resumeStartedAt = null;
    this.countdownRemaining = 0;
    this.readyFrames = 0;
  }

  private enterWaiting(message: string) {
    this.phase = 'waiting';
    this.readyFrames = 0;
    this.breakFrames = 0;
    this.countdownStartedAt = null;
    this.resumeStartedAt = null;
    this.countdownRemaining = 0;
    this.frameMessage = message;
  }

  private beginHolding() {
    this.phase = 'holding';
    this.countdownRemaining = 0;
    this.countdownStartedAt = null;
    this.resumeStartedAt = null;
    this.holdSegmentStartedAt = Date.now();
    this.frameMessage = '';
  }

  processFrame(landmarks: Landmark[]): HoldCounterSnapshot {
    const frameCheck = checkBodyInFrame(landmarks, this.exerciseType);
    this.fullyInFrame = frameCheck.ok;
    this.frameMessage = frameCheck.message;

    if (!frameCheck.ok) {
      this.trackingOk = false;
      if (this.phase === 'holding' || this.phase === 'resuming') {
        // Grace period so brief visibility dips (e.g. chin tuck) don't pause.
        this.breakFrames++;
        if (this.breakFrames >= BREAK_FRAMES) {
          this.pauseHold();
          this.frameMessage = frameCheck.message || 'Get back in frame';
        }
      } else if (this.phase === 'countdown') {
        this.enterWaiting(frameCheck.message || 'Get into plank position');
      } else if (this.phase === 'paused') {
        this.readyFrames = 0;
        this.frameMessage = frameCheck.message || 'Get back in frame';
      } else {
        this.readyFrames = 0;
      }
      return this.snapshot();
    }

    const pose = isPlankPose(landmarks);
    this.trackingOk = pose.ok;

    if (!pose.ok) {
      this.breakFrames++;
      if (
        (this.phase === 'holding' || this.phase === 'resuming') &&
        this.breakFrames >= BREAK_FRAMES
      ) {
        this.pauseHold();
        this.frameMessage = pose.message;
      } else if (this.phase === 'countdown') {
        this.enterWaiting(pose.message);
      } else if (this.phase === 'paused') {
        this.readyFrames = 0;
        this.frameMessage = pose.message;
      } else {
        this.readyFrames = 0;
        this.frameMessage = pose.message;
      }
      return this.snapshot();
    }

    this.breakFrames = 0;

    if (this.phase === 'waiting' || this.phase === 'paused') {
      this.readyFrames++;
      const wasPaused = this.phase === 'paused';
      this.frameMessage = wasPaused ? 'Hold steady to resume…' : 'Hold steady…';
      if (this.readyFrames >= READY_FRAMES) {
        if (wasPaused) {
          this.phase = 'resuming';
          this.resumeStartedAt = Date.now();
          this.countdownRemaining = Math.ceil(RESUME_DELAY_MS / 1000);
          this.frameMessage = `Hold steady — restarting in ${this.countdownRemaining}s`;
        } else {
          this.phase = 'countdown';
          this.countdownStartedAt = Date.now();
          this.countdownRemaining = 3;
          this.frameMessage = '';
        }
      }
      return this.snapshot();
    }

    if (this.phase === 'countdown') {
      const started = this.countdownStartedAt ?? Date.now();
      const remainingMs = COUNTDOWN_MS - (Date.now() - started);
      if (remainingMs <= 0) {
        this.beginHolding();
      } else {
        this.countdownRemaining = Math.max(1, Math.ceil(remainingMs / 1000));
        this.frameMessage = '';
      }
      return this.snapshot();
    }

    if (this.phase === 'resuming') {
      const started = this.resumeStartedAt ?? Date.now();
      const remainingMs = RESUME_DELAY_MS - (Date.now() - started);
      if (remainingMs <= 0) {
        this.beginHolding();
      } else {
        this.countdownRemaining = Math.max(1, Math.ceil(remainingMs / 1000));
        this.frameMessage = `Hold steady — restarting in ${this.countdownRemaining}s`;
      }
      return this.snapshot();
    }

    // holding
    this.frameMessage = '';
    return this.snapshot();
  }

  snapshot(): HoldCounterSnapshot {
    return {
      phase: this.phase,
      elapsedSeconds: this.elapsedSeconds,
      countdownRemaining: this.countdownRemaining,
      trackingOk: this.trackingOk,
      fullyInFrame: this.fullyInFrame,
      frameMessage: this.frameMessage,
    };
  }
}

export function createHoldCounter(type: CameraExerciseType = 'plank'): HoldCounter {
  return new HoldCounter(type);
}
