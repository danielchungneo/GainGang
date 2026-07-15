import type { Landmark } from '@/lib/rep-counting/types';

/** Angle at vertex B formed by segments A–B and C–B (degrees, 0–180). */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

/**
 * How far the origin→point vector lifts off horizontal (0 = flat, 90 = vertical).
 * Useful for torso curl: knee tucks barely change this; shoulder lifts do.
 */
export function elevationFromHorizontal(origin: Landmark, point: Landmark): number {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const fromHorizontal = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  return fromHorizontal > 90 ? 180 - fromHorizontal : fromHorizontal;
}

/** Pick left or right landmark triple based on average visibility. */
export function pickSide<T extends Landmark>(
  left: T,
  right: T,
): 'left' | 'right' {
  const leftScore = left.visibility;
  const rightScore = right.visibility;
  return leftScore >= rightScore ? 'left' : 'right';
}

/** Prefer the side whose landmark chain is most visible (side-profile friendly). */
export function pickBestLandmarkSide(
  leftPoints: Landmark[],
  rightPoints: Landmark[],
): 'left' | 'right' {
  const leftScore = leftPoints.reduce((sum, point) => sum + (point?.visibility ?? 0), 0);
  const rightScore = rightPoints.reduce((sum, point) => sum + (point?.visibility ?? 0), 0);
  return leftScore >= rightScore ? 'left' : 'right';
}
