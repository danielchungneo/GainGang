import { Platform } from 'react-native';
import { VisionCameraProxy } from 'react-native-vision-camera';

type PosePlugin = ReturnType<typeof VisionCameraProxy.initFrameProcessorPlugin>;

let cachedPlugin: PosePlugin | null | undefined;

function initIosPosePlugin(): PosePlugin | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedPlugin !== undefined) return cachedPlugin;

  try {
    cachedPlugin = VisionCameraProxy.initFrameProcessorPlugin('poseLandmarker', {});
  } catch {
    cachedPlugin = null;
  }

  return cachedPlugin;
}

/** Initialized once; safe to capture in frame processor worklets. */
export const iosPoseLandmarkerPlugin = initIosPosePlugin();

export function getIosPoseLandmarkerPlugin(): PosePlugin | null {
  return iosPoseLandmarkerPlugin;
}

export function isIosPoseLandmarkerAvailable(): boolean {
  return getIosPoseLandmarkerPlugin() != null;
}
