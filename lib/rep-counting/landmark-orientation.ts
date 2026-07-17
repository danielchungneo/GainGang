import type { Landmark } from '@/lib/rep-counting/types';

/** UI / phone tip rotation for sideways floor filming (degrees). */
export type CameraUiRotation = 0 | -90;

/** Toggle upright ↔ landscape (−90°). */
export function nextCameraUiRotation(current: CameraUiRotation): CameraUiRotation {
  return current === 0 ? -90 : 0;
}

/**
 * Remap camera-space landmarks into gravity-aligned coordinates.
 *
 * The preview stays fixed to the phone sensor. When the UI is rotated for a
 * tipped phone, image +y no longer points with gravity. Pose gates that
 * compare "above" / "horizontal" (plank, sit-up, crunch) need gravity-space
 * coords. Joint angles are rotation-invariant; remapping still keeps
 * elevation / horizontal checks consistent with an upright phone.
 */
export function remapLandmarksForUiRotation(
  landmarks: Landmark[],
  rotation: CameraUiRotation,
): Landmark[] {
  if (rotation === 0) return landmarks;

  return landmarks.map((landmark) => {
    const { x, y } = landmark;
    // Phone tipped CCW (−90) → gravity-down was −x. Align to +y down, +x right.
    return { ...landmark, x: y, y: 1 - x };
  });
}
