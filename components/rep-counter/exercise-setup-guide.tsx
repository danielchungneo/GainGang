import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { ExerciseSetupInfo } from '@/lib/rep-counting/types';

interface ExerciseSetupGuideProps {
  guide: ExerciseSetupInfo;
}

export function ExerciseSetupGuide({ guide }: ExerciseSetupGuideProps) {
  const t = useThemeTokens();

  return (
    <View style={[styles.card, { backgroundColor: 'rgba(14, 21, 36, 0.92)', borderColor: t.buttonBorder }]}>
      <View style={styles.header}>
        <Ionicons name="videocam-outline" size={22} color={t.accent} />
        <Text style={[styles.title, { color: t.heading }]}>Camera setup</Text>
      </View>

      <Text style={[styles.hint, { color: t.body }]}>
        {guide.cameraHint === 'side'
          ? 'Best angle: side view (profile)'
          : 'Best angle: front or side — pick one and stick with it'}
      </Text>

      {guide.tips.map((tip) => (
        <View key={tip} style={styles.tipRow}>
          <Text style={{ color: t.accent }}>•</Text>
          <Text style={[styles.tipText, { color: t.body }]}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
