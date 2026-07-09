import type { Landmark } from '@/lib/rep-counting/types';

/** Angle at vertex B formed by segments A–B and C–B (degrees, 0–180). */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
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
