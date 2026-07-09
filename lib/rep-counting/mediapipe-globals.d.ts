import type { HandDetectionResult } from 'expo-vision-camera-v4-mediapipe';
import type { Frame } from 'react-native-vision-camera';

declare global {
  /** Injected by expo-vision-camera-v4-mediapipe on Android frame processor thread. */
  // eslint-disable-next-line no-var
  var detectHandLandmarks: ((frame: import('react-native-vision-camera').Frame) => import('expo-vision-camera-v4-mediapipe').HandDetectionResult) | undefined;
}

export {};
