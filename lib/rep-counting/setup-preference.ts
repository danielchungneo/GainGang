import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CameraExerciseType } from '@/lib/rep-counting/types';

const STORAGE_KEY = 'gaingang.camera-setup-skipped';

async function readSkippedMap(): Promise<Partial<Record<CameraExerciseType, boolean>>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Partial<Record<CameraExerciseType, boolean>>;
  } catch {
    return {};
  }
}

export async function isCameraSetupSkipped(exerciseType: CameraExerciseType): Promise<boolean> {
  const skipped = await readSkippedMap();
  return skipped[exerciseType] === true;
}

export async function setCameraSetupSkipped(
  exerciseType: CameraExerciseType,
  skipped: boolean,
): Promise<void> {
  const current = await readSkippedMap();
  if (skipped) current[exerciseType] = true;
  else delete current[exerciseType];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}
