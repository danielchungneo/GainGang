import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseSetupGuide } from '@/components/rep-counter/exercise-setup-guide';
import {
  useSubmitGangWarAttempt,
  type SubmitGangWarAttemptResult,
} from '@/hooks/use-gang-wars';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount } from '@/lib/format';
import {
  getCameraExerciseType,
  getCameraTrackingMode,
  SETUP_GUIDES,
} from '@/lib/rep-counting/exercise-registry';
import { isRepCounterNativeSupported, repCounterUnsupportedMessage } from '@/lib/rep-counting/platform';
import {
  isCameraSetupSkipped,
  setCameraSetupSkipped,
} from '@/lib/rep-counting/setup-preference';
import type { CameraTrackingMode } from '@/lib/rep-counting/types';
import type { ExerciseUnit } from '@/types';

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

type SessionStep = 'setup' | 'active' | 'review' | 'saving' | 'done' | 'error';

export interface GangWarRepCounterSessionProps {
  matchId: string;
  gangId: string;
  exerciseId: string;
  exerciseName: string;
  unit: Extract<ExerciseUnit, 'reps' | 'seconds'>;
  timeLimitSeconds?: number | null;
}

function formatHoldReview(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GangWarRepCounterSession({
  matchId,
  gangId,
  exerciseName,
  unit,
  timeLimitSeconds,
}: GangWarRepCounterSessionProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const nativeSupported = isRepCounterNativeSupported();
  const submitAttempt = useSubmitGangWarAttempt();

  const exerciseType = useMemo(
    () => getCameraExerciseType(exerciseName),
    [exerciseName],
  );
  const trackingMode: CameraTrackingMode | null = exerciseType
    ? getCameraTrackingMode(exerciseType)
    : null;
  const isHold = trackingMode === 'hold';
  const guide = exerciseType ? SETUP_GUIDES[exerciseType] : null;
  const sessionLimit =
    timeLimitSeconds && timeLimitSeconds > 0 ? timeLimitSeconds : 60;

  const [step, setStep] = useState<SessionStep>('setup');
  const [trackedAmount, setTrackedAmount] = useState(0);
  const [dontShowSetupAgain, setDontShowSetupAgain] = useState(false);
  const [isSetupPreferenceReady, setIsSetupPreferenceReady] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(sessionLimit);
  const [timerStarted, setTimerStarted] = useState(false);
  const [result, setResult] = useState<SubmitGangWarAttemptResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoFinishedRef = useRef(false);
  const amountRef = useRef(0);

  useEffect(() => {
    amountRef.current = trackedAmount;
  }, [trackedAmount]);

  useEffect(() => {
    let cancelled = false;
    async function resolveInitialStep() {
      setTrackedAmount(0);
      setDontShowSetupAgain(false);
      setIsSetupPreferenceReady(false);
      autoFinishedRef.current = false;
      setTimerStarted(false);
      setSecondsLeft(sessionLimit);
      if (!exerciseType) {
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
  }, [exerciseType, matchId, gangId, sessionLimit]);

  useEffect(() => {
    if (step !== 'active' || !sessionLimit || timerStarted) return;
    if (trackedAmount < 1) return;
    setTimerStarted(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [step, sessionLimit, timerStarted, trackedAmount]);

  useEffect(() => {
    if (step !== 'active' || !sessionLimit || !timerStarted) return;
    setSecondsLeft(sessionLimit);
    autoFinishedRef.current = false;
    const startedAt = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, sessionLimit - elapsed);
      setSecondsLeft(left);
      if (left <= 0 && !autoFinishedRef.current) {
        autoFinishedRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTrackedAmount(amountRef.current);
        setStep('review');
      }
    }, 100);
    return () => clearInterval(id);
  }, [step, sessionLimit, timerStarted]);

  async function handleStartCounting() {
    if (dontShowSetupAgain && exerciseType) {
      await setCameraSetupSkipped(exerciseType, true);
    }
    setTimerStarted(false);
    setTrackedAmount(0);
    setSecondsLeft(sessionLimit);
    setStep('active');
  }

  async function handleSubmit() {
    if (trackedAmount < 0) return;
    setStep('saving');
    setErrorMessage(null);
    try {
      const res = await submitAttempt.mutateAsync({
        matchId,
        gangId,
        score: trackedAmount,
      });
      setResult(res);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not save attempt');
      setStep('error');
    }
  }

  if (!exerciseType || !guide || !trackingMode) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <Text style={{ color: t.heading, fontSize: 18, fontWeight: '700' }}>
            Exercise not supported
          </Text>
          <Text style={{ color: t.body, textAlign: 'center', marginTop: 8 }}>
            Camera tracking is not available for this challenge yet.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Go back</Text>
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

  if (step === 'saving') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#22d3ee" size="large" />
          <Text style={{ color: t.body, marginTop: 12 }}>Saving attempt…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <Header title="War attempt" onClose={() => router.back()} />
        <View style={styles.centered}>
          <Text style={{ color: t.heading, fontSize: 18, fontWeight: '700' }}>
            Save failed
          </Text>
          <Text style={{ color: t.body, textAlign: 'center', marginTop: 8 }}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            onPress={() => setStep('review')}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'done' && result) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <Header title="War attempt logged" onClose={() => router.back()} />
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={56} color={t.accent} />
          <Text style={{ color: t.heading, fontSize: 22, fontWeight: '800', marginTop: 16 }}>
            Attempt counted
          </Text>
          <Text style={{ color: t.body, marginTop: 8, textAlign: 'center' }}>
            This try: {formatAmount(result.score_submitted, unit)}
            {'\n'}
            Your top-2 today: {formatAmount(result.member_day_contribution, unit)}
            {'\n'}
            Gang week: {formatAmount(result.gang_week_score, unit)}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryBtn, { backgroundColor: t.accent, marginTop: 24 }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Back to War</Text>
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
        subtitle={
          step === 'active'
            ? isHold
              ? 'Hold as long as you can'
              : 'Live counting'
            : step === 'review'
              ? 'Review score'
              : 'War challenge setup'
        }
        rightAction={
          step === 'active' && !sessionLimit ? (
            <TouchableOpacity
              onPress={() => setStep('review')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={isHold ? 'Finish hold' : 'Finish set'}
            >
              <Text style={{ color: '#22d3ee', fontWeight: '700', fontSize: 16 }}>Finish</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {step === 'setup' ? (
        <View style={styles.setupBody}>
          <ExerciseSetupGuide
            exerciseType={exerciseType}
            guide={guide}
            dontShowAgain={dontShowSetupAgain}
            onDontShowAgainChange={setDontShowSetupAgain}
          />
          {sessionLimit ? (
            <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
              Timer starts on your first rep — then {sessionLimit} seconds.
            </Text>
          ) : (
            <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
              Hold as long as you can, then tap Finish.
            </Text>
          )}
          <TouchableOpacity
            onPress={() => void handleStartCounting()}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Start challenge</Text>
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
                onElapsedChange={setTrackedAmount}
              />
            ) : (
              <RepCounterCamera
                exerciseType={exerciseType}
                onRepCountChange={setTrackedAmount}
                requirePermission
                renderBottomHud={
                  sessionLimit
                    ? ({
                        repCount,
                        badgeAnimatedStyle,
                        valueAnimatedStyle,
                      }) =>
                        timerStarted ? (
                          <Animated.View
                            style={[styles.challengeHud, badgeAnimatedStyle]}
                          >
                            <View style={styles.challengeHudCell}>
                              <Text style={styles.challengeHudLabel}>Reps</Text>
                              <Animated.Text
                                style={[styles.challengeHudValue, valueAnimatedStyle]}
                              >
                                {repCount}
                              </Animated.Text>
                            </View>
                            <View style={styles.challengeHudDivider} />
                            <View style={styles.challengeHudCell}>
                              <Text style={styles.challengeHudLabel}>Time</Text>
                              <Text style={styles.challengeHudValue}>
                                {formatCountdown(secondsLeft)}
                              </Text>
                            </View>
                          </Animated.View>
                        ) : (
                          <Animated.View
                            style={[styles.challengeHint, badgeAnimatedStyle]}
                          >
                            <Text style={styles.challengeHintText}>
                              Your time will start when you complete your first rep
                            </Text>
                          </Animated.View>
                        )
                    : undefined
                }
              />
            )}
          </Suspense>
        </View>
      ) : null}

      {step === 'review' ? (
        <View style={[styles.centered, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>Your score</Text>
          <Text style={{ color: '#F8FAFC', fontSize: 56, fontWeight: '800', marginTop: 8 }}>
            {isHold ? formatHoldReview(trackedAmount) : trackedAmount}
          </Text>
          <Text style={{ color: '#94A3B8', marginTop: 4 }}>
            {isHold ? 'seconds' : unit}
          </Text>
          <TouchableOpacity
            onPress={() => void handleSubmit()}
            style={[styles.primaryBtn, { backgroundColor: t.accent, marginTop: 28 }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Submit Attempt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              autoFinishedRef.current = false;
              setTimerStarted(false);
              setTrackedAmount(0);
              if (sessionLimit) setSecondsLeft(sessionLimit);
              setStep('active');
            }}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
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
      <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
        <Ionicons name="close" size={28} color="#F8FAFC" />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  setupBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
    justifyContent: 'space-between',
  },
  cameraBody: { flex: 1 },
  challengeHud: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 21, 36, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(77, 140, 255, 0.35)',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 20,
  },
  challengeHudCell: { alignItems: 'center', minWidth: 84 },
  challengeHudDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(143, 180, 255, 0.35)',
  },
  challengeHudLabel: {
    color: '#7D8AA8',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  challengeHudValue: {
    color: '#F8FAFC',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  challengeHint: {
    maxWidth: '88%',
    backgroundColor: 'rgba(14, 21, 36, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(77, 140, 255, 0.35)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  challengeHintText: {
    color: '#E8EDF7',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
    zIndex: 30,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { minWidth: 56, alignItems: 'flex-end' },
  headerTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
});
