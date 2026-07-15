/** Normalized body landmark from BlazePose (33 points). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type RepPhase = 'up' | 'down' | 'transition';

export type CameraExerciseType = 'pushup' | 'squat' | 'situp' | 'crunch' | 'lunge' | 'plank';

/** Rep exercises count reps; hold exercises track elapsed seconds. */
export type CameraTrackingMode = 'reps' | 'hold';

export type HoldPhase = 'waiting' | 'countdown' | 'resuming' | 'holding' | 'paused';

export interface RepCounterSnapshot {
  repCount: number;
  phase: RepPhase;
  angle: number;
  trackingOk: boolean;
  fullyInFrame: boolean;
  frameMessage: string;
}

export interface HoldCounterSnapshot {
  phase: HoldPhase;
  /** Whole seconds held so far (paused time excluded). */
  elapsedSeconds: number;
  /** 3 → 2 → 1 during initial countdown; resume delay seconds otherwise. */
  countdownRemaining: number;
  trackingOk: boolean;
  fullyInFrame: boolean;
  frameMessage: string;
}

export interface ExerciseSetupInfo {
  title: string;
  tips: string[];
  cameraHint: 'side' | 'front-or-side';
}
