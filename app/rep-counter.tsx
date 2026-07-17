import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseSetupGuide } from '@/components/rep-counter/exercise-setup-guide';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  getCameraExerciseType,
  getCameraTrackingMode,
  SETUP_GUIDES,
} from '@/lib/rep-counting/exercise-registry';
import {
  nextCameraUiRotation,
  type CameraUiRotation,
} from '@/lib/rep-counting/landmark-orientation';
import {
  buildRepCounterSessionKey,
  parseRepCounterQueue,
  serializeRepCounterQueue,
  setPendingRepCount,
  type RepCounterQueueItem,
} from '@/lib/rep-counting/pending-result';
import { isRepCounterNativeSupported, repCounterUnsupportedMessage } from '@/lib/rep-counting/platform';
import {
  isCameraSetupSkipped,
  setCameraSetupSkipped,
} from '@/lib/rep-counting/setup-preference';
import type { CameraExerciseType, CameraTrackingMode } from '@/lib/rep-counting/types';

const RepCounterCamera = lazy(() =>
  import('@/components/rep-counter/rep-counter-camera').then((mod) => ({
    default: mod.RepCounterCamera,
  })),
);

const HoldCounterCamera = lazy(() =>
  import('@/components/rep-counter/hold-counter-camera').then((mod) => ({
    default: mod.HoldCounterCamera,
  })),
);

type SessionStep = 'setup' | 'active' | 'review';

function formatHoldReview(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function RepCounterScreen() {
  const params = useLocalSearchParams<{
    exerciseId: string;
    exerciseName: string;
    sessionKey?: string;
    contextId?: string;
    exerciseQueue?: string;
    unit?: string;
    targetSeconds?: string;
    targetReps?: string;
    mode?: string;
  }>();
  const t = useThemeTokens();
  const nativeSupported = isRepCounterNativeSupported();
  const isOnboarding = (Array.isArray(params.mode) ? params.mode[0] : params.mode) === 'onboarding';
  const autoFinishRef = useRef(false);

  const exerciseType = useMemo(
    () => getCameraExerciseType(params.exerciseName ?? ''),
    [params.exerciseName],
  );

  const trackingMode: CameraTrackingMode | null = exerciseType
    ? getCameraTrackingMode(exerciseType)
    : null;
  const isHold = trackingMode === 'hold';
  const guide = exerciseType ? SETUP_GUIDES[exerciseType] : null;
  const [step, setStep] = useState<SessionStep>('setup');
  const [trackedAmount, setTrackedAmount] = useState(0);
  const [dontShowSetupAgain, setDontShowSetupAgain] = useState(false);
  const [isSetupPreferenceReady, setIsSetupPreferenceReady] = useState(false);
  const [isHintModalVisible, setIsHintModalVisible] = useState(false);
  const [uiRotation, setUiRotation] = useState<CameraUiRotation>(0);

  const targetSeconds = useMemo(() => {
    const raw = Array.isArray(params.targetSeconds)
      ? params.targetSeconds[0]
      : params.targetSeconds;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
  }, [params.targetSeconds]);

  const targetReps = useMemo(() => {
    const raw = Array.isArray(params.targetReps) ? params.targetReps[0] : params.targetReps;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
  }, [params.targetReps]);

  const sessionKey =
    params.sessionKey ??
    buildRepCounterSessionKey(params.exerciseId ?? 'unknown', params.contextId);

  const exerciseQueue = useMemo(
    () => parseRepCounterQueue(
      Array.isArray(params.exerciseQueue) ? params.exerciseQueue[0] : params.exerciseQueue,
    ),
    [params.exerciseQueue],
  );
  const nextExercise = exerciseQueue[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    async function resolveInitialStep() {
      setTrackedAmount(0);
      setDontShowSetupAgain(false);
      setIsSetupPreferenceReady(false);
      setUiRotation(0);
      autoFinishRef.current = false;

      if (!exerciseType) {
        if (!cancelled) {
          setStep('setup');
          setIsSetupPreferenceReady(true);
        }
        return;
      }

      // Onboarding always shows camera tips first (no skip preference).
      if (isOnboarding) {
        if (!cancelled) {
          setStep('setup');
          setIsSetupPreferenceReady(true);
        }
        return;
      }

      const skipped = await isCameraSetupSkipped(exerciseType);
      if (cancelled) return;
      setStep(skipped ? 'active' : 'setup');
      setIsSetupPreferenceReady(true);
    }

    void resolveInitialStep();
    return () => {
      cancelled = true;
    };
  }, [params.exerciseId, sessionKey, exerciseType, isOnboarding]);

  useEffect(() => {
    if (!isOnboarding || !targetReps || isHold) return;
    if (trackedAmount < targetReps || autoFinishRef.current) return;

    autoFinishRef.current = true;
    setPendingRepCount(sessionKey, trackedAmount);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [isOnboarding, targetReps, isHold, trackedAmount, sessionKey]);

  async function handleStartCounting() {
    if (!isOnboarding && dontShowSetupAgain && exerciseType) {
      await setCameraSetupSkipped(exerciseType, true);
    }
    setStep('active');
  }

  function acceptAmount() {
    if (trackedAmount <= 0) return;
    setPendingRepCount(sessionKey, trackedAmount);
  }

  function handleFinish() {
    if (trackedAmount <= 0) return;
    acceptAmount();
    router.back();
  }

  function handleAcceptAndNext(next: RepCounterQueueItem) {
    acceptAmount();
    const remaining = exerciseQueue.slice(1);
    router.replace({
      pathname: '/rep-counter',
      params: {
        exerciseId: next.exerciseId,
        exerciseName: next.exerciseName,
        sessionKey: buildRepCounterSessionKey(next.exerciseId, params.contextId),
        contextId: params.contextId ?? '',
        unit: next.unit ?? '',
        targetSeconds:
          next.targetSeconds != null ? String(next.targetSeconds) : '',
        exerciseQueue:
          remaining.length > 0 ? serializeRepCounterQueue(remaining) : '',
      },
    });
  }

  if (!exerciseType || !guide || !trackingMode) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <Text style={{ color: t.heading, fontSize: 18, fontWeight: '700' }}>
            Exercise not supported
          </Text>
          <Text style={{ color: t.body, textAlign: 'center', marginTop: 8 }}>
            Camera tracking is not available for this exercise yet.
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
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>
              {isOnboarding ? 'Go back' : 'Log manually instead'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSetupPreferenceReady) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#22d3ee" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const activeSubtitle =
    isOnboarding && targetReps
      ? `${Math.min(trackedAmount, targetReps)} / ${targetReps}`
      : isHold
        ? step === 'active'
          ? 'Live hold'
          : step === 'review'
            ? 'Review hold'
            : 'Setup'
        : step === 'active'
          ? 'Live counting'
          : step === 'review'
            ? 'Review reps'
            : 'Setup';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#000' }]} edges={['bottom']}>
      <Header
        title={
          isOnboarding
            ? exerciseType === 'squat'
              ? 'Squat demo'
              : exerciseType === 'pushup'
                ? 'Push-up demo'
                : `${guide.title} demo`
            : guide.title
        }
        onClose={() => router.back()}
        subtitle={activeSubtitle}
        rightAction={
          step === 'active' && !isOnboarding ? (
            <View style={styles.activeHeaderActions}>
              <TouchableOpacity
                onPress={() => setIsHintModalVisible(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Show camera setup hints"
              >
                <Ionicons name="help-circle-outline" size={26} color="#F8FAFC" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setUiRotation((current) => nextCameraUiRotation(current));
                  void Haptics.selectionAsync();
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={
                  uiRotation === 0
                    ? 'Rotate UI sideways for floor exercises'
                    : 'Rotate UI upright'
                }
                accessibilityState={{ selected: uiRotation !== 0 }}
              >
                <Ionicons
                  name={
                    uiRotation === 0 ? 'phone-landscape-outline' : 'phone-portrait-outline'
                  }
                  size={24}
                  color={uiRotation === 0 ? '#F8FAFC' : '#22d3ee'}
                  style={uiRotation !== 0 ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep('review')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={isHold ? 'Finish hold' : 'Finish set'}
              >
                <Text style={{ color: '#22d3ee', fontWeight: '700', fontSize: 16 }}>Finish</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'active' && isOnboarding ? (
            <View style={styles.activeHeaderActions}>
              <TouchableOpacity
                onPress={() => setIsHintModalVisible(true)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Show camera setup hints"
              >
                <Ionicons name="help-circle-outline" size={26} color="#F8FAFC" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setUiRotation((current) => nextCameraUiRotation(current));
                  void Haptics.selectionAsync();
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={
                  uiRotation === 0
                    ? 'Rotate UI sideways for floor exercises'
                    : 'Rotate UI upright'
                }
                accessibilityState={{ selected: uiRotation !== 0 }}
              >
                <Ionicons
                  name={
                    uiRotation === 0 ? 'phone-landscape-outline' : 'phone-portrait-outline'
                  }
                  size={24}
                  color={uiRotation === 0 ? '#F8FAFC' : '#22d3ee'}
                  style={uiRotation !== 0 ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {step === 'setup' ? (
        <View style={styles.setupBody}>
          <ExerciseSetupGuide
            exerciseType={exerciseType}
            guide={guide}
            {...(isOnboarding
              ? {}
              : {
                  dontShowAgain: dontShowSetupAgain,
                  onDontShowAgainChange: setDontShowSetupAgain,
                })}
          />
          {isHold && targetSeconds ? (
            <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
              Goal: hold for {formatHoldReview(targetSeconds)}
              {targetSeconds >= 60 ? '' : ' seconds'}
            </Text>
          ) : null}
          {isOnboarding && targetReps ? (
            <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
              Goal: {targetReps} {guide.title.toLowerCase()}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              void handleStartCounting();
            }}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Ionicons name="play" size={18} color={t.accentOnPrimary} />
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700', fontSize: 16 }}>
              {isHold ? 'Start hold' : 'Start counting'}
            </Text>
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
            {isHold ? (
              <HoldCounterCamera
                targetSeconds={targetSeconds}
                initialElapsedSeconds={trackedAmount}
                onElapsedChange={setTrackedAmount}
                uiRotation={uiRotation}
              />
            ) : (
              <RepCounterCamera
                exerciseType={exerciseType as CameraExerciseType}
                onRepCountChange={setTrackedAmount}
                targetReps={isOnboarding ? targetReps : undefined}
                requirePermission
                uiRotation={uiRotation}
              />
            )}
          </Suspense>
        </View>
      ) : null}

      {step === 'review' ? (
        <View style={styles.reviewBody}>
          <Text style={styles.reviewCount}>
            {isHold ? formatHoldReview(trackedAmount) : trackedAmount}
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '600' }}>
            {isHold ? 'seconds held' : 'reps counted'}
          </Text>
          <Text style={{ color: '#CBD5E1', textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
            {isHold
              ? 'Accept this hold time to save your progress.'
              : 'Accept these reps to save your progress.'}
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
              disabled={trackedAmount <= 0}
              style={[
                styles.primaryBtn,
                { backgroundColor: trackedAmount > 0 ? t.accent : '#334155', flex: 1 },
              ]}
            >
              <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>
                {isHold
                  ? `Accept ${formatHoldReview(trackedAmount)}s`
                  : `Accept ${trackedAmount} reps`}
              </Text>
            </TouchableOpacity>
          </View>

          {nextExercise && trackedAmount > 0 ? (
            <TouchableOpacity
              onPress={() => handleAcceptAndNext(nextExercise)}
              style={[styles.nextBtn, { borderColor: t.accent }]}
              accessibilityRole="button"
              accessibilityLabel={`Accept and start ${nextExercise.exerciseName}`}
            >
              <Text style={{ color: t.heading, fontWeight: '700', flex: 1 }}>
                Accept & next: {nextExercise.exerciseName}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={t.accent} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={isHintModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsHintModalVisible(false)}
      >
        <SafeAreaView style={styles.hintModalSafe} edges={['top', 'bottom']}>
          <View style={styles.hintModalHeader}>
            <Text style={styles.hintModalTitle}>Camera hints</Text>
            <TouchableOpacity
              onPress={() => setIsHintModalVisible(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close camera hints"
            >
              <Ionicons name="close" size={28} color="#F8FAFC" />
            </TouchableOpacity>
          </View>
          <View style={styles.hintModalBody}>
            {isHintModalVisible ? (
              <ExerciseSetupGuide exerciseType={exerciseType} guide={guide} />
            ) : null}
            <TouchableOpacity
              onPress={() => setIsHintModalVisible(false)}
              style={[styles.primaryBtn, { backgroundColor: t.accent }]}
            >
              <Text style={{ color: t.accentOnPrimary, fontWeight: '700', fontSize: 16 }}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
  activeHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  setupBody: {
    flex: 1,
    padding: 20,
    gap: 16,
    backgroundColor: '#05070F',
  },
  hintModalSafe: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  hintModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  hintModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  hintModalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
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
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(14, 21, 36, 0.9)',
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
