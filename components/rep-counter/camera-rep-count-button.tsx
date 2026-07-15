import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  buildRepCounterSessionKey,
  serializeRepCounterQueue,
  type RepCounterQueueItem,
} from '@/lib/rep-counting/pending-result';
import {
  getCameraExerciseType,
  getCameraTrackingMode,
  supportsCameraTracking,
} from '@/lib/rep-counting/exercise-registry';

interface CameraRepCountButtonProps {
  exerciseId: string;
  exerciseName: string;
  unit: string;
  contextId?: string;
  sessionKey?: string;
  disabled?: boolean;
  /** Goal duration for hold exercises (plank). */
  targetSeconds?: number;
  /** Remaining camera exercises after this one (daily goal flow). */
  nextExercises?: RepCounterQueueItem[];
}

export function CameraRepCountButton({
  exerciseId,
  exerciseName,
  unit,
  contextId,
  sessionKey,
  disabled,
  targetSeconds,
  nextExercises,
}: CameraRepCountButtonProps) {
  const t = useThemeTokens();

  if (!supportsCameraTracking(exerciseName, unit)) {
    return null;
  }

  const type = getCameraExerciseType(exerciseName);
  const isHold = type ? getCameraTrackingMode(type) === 'hold' : false;

  const resolvedSessionKey =
    sessionKey ?? buildRepCounterSessionKey(exerciseId, contextId);

  function handlePress() {
    router.push({
      pathname: '/rep-counter',
      params: {
        exerciseId,
        exerciseName,
        sessionKey: resolvedSessionKey,
        contextId: contextId ?? '',
        unit,
        ...(isHold && targetSeconds != null
          ? { targetSeconds: String(targetSeconds) }
          : {}),
        ...(nextExercises && nextExercises.length > 0
          ? { exerciseQueue: serializeRepCounterQueue(nextExercises) }
          : {}),
      },
    });
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: t.buttonBg,
          borderColor: t.accent,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <Ionicons name="videocam" size={18} color={t.accent} />
        <Text style={{ color: t.heading, fontWeight: '700' }}>
          {isHold ? 'Time with camera' : 'Count with camera'}
        </Text>
      </View>
      <Text style={{ color: t.body, fontSize: 12, marginTop: 4 }}>
        {isHold
          ? 'Auto-time your hold with live pose tracking'
          : 'Auto-count reps with live pose tracking (POC)'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
