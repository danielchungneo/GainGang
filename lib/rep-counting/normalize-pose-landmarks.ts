import { Platform } from 'react-native';

import type { Landmark } from '@/lib/rep-counting/types';

/** Portrait-space normalization for iOS front-camera MediaPipe output. */
export function normalizePoseLandmarks(landmarks: Landmark[]): Landmark[] {
  if (Platform.OS !== 'ios') return landmarks;

  return landmarks.map((landmark) => ({
    ...landmark,
    x: landmark.y,
    y: landmark.x,
  }));
}
