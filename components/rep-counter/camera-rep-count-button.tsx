import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { buildRepCounterSessionKey } from '@/lib/rep-counting/pending-result';
import { supportsCameraRepCounting } from '@/lib/rep-counting/exercise-registry';

interface CameraRepCountButtonProps {
  exerciseId: string;
  exerciseName: string;
  unit: string;
  contextId?: string;
  sessionKey?: string;
  disabled?: boolean;
}

export function CameraRepCountButton({
  exerciseId,
  exerciseName,
  unit,
  contextId,
  sessionKey,
  disabled,
}: CameraRepCountButtonProps) {
  const t = useThemeTokens();

  if (unit !== 'reps' || !supportsCameraRepCounting(exerciseName)) {
    return null;
  }

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
        <Text style={{ color: t.heading, fontWeight: '700' }}>Count with camera</Text>
      </View>
      <Text style={{ color: t.body, fontSize: 12, marginTop: 4 }}>
        Auto-count reps with live pose tracking (POC)
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
