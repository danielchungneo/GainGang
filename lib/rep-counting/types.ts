/** Normalized body landmark from BlazePose (33 points). */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type RepPhase = 'up' | 'down' | 'transition';

export type CameraExerciseType = 'pushup' | 'squat' | 'situp';

export interface RepCounterSnapshot {
  repCount: number;
  phase: RepPhase;
  angle: number;
  trackingOk: boolean;
  fullyInFrame: boolean;
  frameMessage: string;
}

export interface ExerciseSetupInfo {
  title: string;
  tips: string[];
  cameraHint: 'side' | 'front-or-side';
}
