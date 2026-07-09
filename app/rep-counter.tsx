import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseSetupGuide } from '@/components/rep-counter/exercise-setup-guide';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getCameraExerciseType, SETUP_GUIDES } from '@/lib/rep-counting/exercise-registry';
import {
  buildRepCounterSessionKey,
  setPendingRepCount,
} from '@/lib/rep-counting/pending-result';
import { isRepCounterNativeSupported, repCounterUnsupportedMessage } from '@/lib/rep-counting/platform';
import type { CameraExerciseType } from '@/lib/rep-counting/types';

const RepCounterCamera = lazy(() =>
  import('@/components/rep-counter/rep-counter-camera').then((mod) => ({
    default: mod.RepCounterCamera,
  })),
);

type SessionStep = 'setup' | 'active' | 'review';

export default function RepCounterScreen() {
  const params = useLocalSearchParams<{
    exerciseId: string;
    exerciseName: string;
    sessionKey?: string;
    contextId?: string;
  }>();
  const t = useThemeTokens();
  const nativeSupported = isRepCounterNativeSupported();

  const exerciseType = useMemo(
    () => getCameraExerciseType(params.exerciseName ?? ''),
    [params.exerciseName],
  );

  const guide = exerciseType ? SETUP_GUIDES[exerciseType] : null;
  const [step, setStep] = useState<SessionStep>('setup');
  const [repCount, setRepCount] = useState(0);

  const sessionKey =
    params.sessionKey ??
    buildRepCounterSessionKey(params.exerciseId ?? 'unknown', params.contextId);

  function handleFinish() {
    if (repCount <= 0) return;
    setPendingRepCount(sessionKey, repCount);
    router.back();
  }

  if (!exerciseType || !guide) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <Text style={{ color: t.heading, fontSize: 18, fontWeight: '700' }}>
            Exercise not supported
          </Text>
          <Text style={{ color: t.body, textAlign: 'center', marginTop: 8 }}>
            Camera rep counting is only available for push-ups, squats, and sit-ups in this POC.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!nativeSupported) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <Header title={guide.title} onClose={() => router.back()} />
        <View style={styles.centered}>
          <Ionicons name="phone-portrait-outline" size={48} color={t.accent} />
          <Text style={{ color: t.heading, fontSize: 18, fontWeight: '700', marginTop: 16 }}>
            Dev client required
          </Text>
          <Text style={{ color: t.body, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            {repCounterUnsupportedMessage()}
          </Text>
          <Text style={{ color: t.body, textAlign: 'center', marginTop: 12, fontSize: 13, opacity: 0.8 }}>
            Run: npm run build:dev:ios
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Log manually instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#000' }]} edges={['bottom']}>
      <Header
        title={guide.title}
        onClose={() => router.back()}
        subtitle={step === 'active' ? 'Live counting' : step === 'review' ? 'Review reps' : 'Setup'}
        rightAction={
          step === 'active' ? (
            <TouchableOpacity
              onPress={() => setStep('review')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Finish set"
            >
              <Text style={{ color: '#22d3ee', fontWeight: '700', fontSize: 16 }}>Finish</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {step === 'setup' ? (
        <View style={styles.setupBody}>
          <ExerciseSetupGuide guide={guide} />
          <TouchableOpacity
            onPress={() => setStep('active')}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Ionicons name="play" size={18} color={t.accentOnPrimary} />
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700', fontSize: 16 }}>Start counting</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {step === 'active' ? (
        <View style={styles.cameraBody}>
          <Suspense
            fallback={
              <View style={styles.centered}>
                <ActivityIndicator color="#22d3ee" size="large" />
              </View>
            }
          >
            <RepCounterCamera
              exerciseType={exerciseType as CameraExerciseType}
              onRepCountChange={setRepCount}
            />
          </Suspense>
        </View>
      ) : null}

      {step === 'review' ? (
        <View style={styles.reviewBody}>
          <Text style={styles.reviewCount}>{repCount}</Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '600' }}>reps counted</Text>
          <Text style={{ color: '#CBD5E1', textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
            Accept these reps to save your progress.
          </Text>

          <View style={styles.reviewActions}>
            <TouchableOpacity
              onPress={() => setStep('active')}
              style={[styles.secondaryBtn, { borderColor: t.buttonBorder, flex: 1 }]}
            >
              <Text style={{ color: t.heading, fontWeight: '600' }}>Keep going</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFinish}
              disabled={repCount <= 0}
              style={[
                styles.primaryBtn,
                { backgroundColor: repCount > 0 ? t.accent : '#334155', flex: 1 },
              ]}
            >
              <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Accept {repCount} reps</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Header({
  title,
  subtitle,
  onClose,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  rightAction?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={28} color="#F8FAFC" />
      </TouchableOpacity>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ?? <View style={{ width: 56 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(5, 7, 15, 0.85)',
    zIndex: 10,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  setupBody: {
    flex: 1,
    padding: 20,
    gap: 20,
    backgroundColor: '#05070F',
    justifyContent: 'center',
  },
  cameraBody: {
    flex: 1,
  },
  reviewBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#05070F',
  },
  reviewCount: {
    color: '#F8FAFC',
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 76,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    width: '100%',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(14, 21, 36, 0.9)',
  },
});
