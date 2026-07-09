import { NativeModules, Platform } from 'react-native';

import { isIosPoseLandmarkerAvailable } from '@/lib/rep-counting/ios-pose-plugin';

/** True when the Vision Camera native module is present in the dev client. */
export function isVisionCameraLinked(): boolean {
  return !!NativeModules.CameraView;
}

/** Pose detection available when Vision Camera + platform pose plugin are linked. */
export function isRepCounterNativeSupported(): boolean {
  if (!isVisionCameraLinked()) return false;
  if (Platform.OS === 'ios') return isIosPoseLandmarkerAvailable();
  if (Platform.OS === 'android') return true;
  return false;
}

export function repCounterUnsupportedMessage(): string {
  if (Platform.OS === 'web') {
    return 'Camera rep counting requires a native dev build on a physical device.';
  }
  if (!isVisionCameraLinked()) {
    return 'Your dev client was built before Vision Camera was added. Rebuild to enable camera rep counting.';
  }
  if (Platform.OS === 'ios' && !isIosPoseLandmarkerAvailable()) {
    return 'Your iOS dev client is missing the MediaPipe pose plugin. Rebuild with the latest native config.';
  }
  return 'Camera rep counting requires a dev client build on a physical device.';
}
