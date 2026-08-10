import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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
  useGangWarState,
  useSubmitGangWarAttempt,
  type SubmitGangWarAttemptResult,
} from '@/hooks/use-gang-wars';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount } from '@/lib/format';
import { fontFamily } from '@/lib/gaingang-theme';
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

const CONTRIBUTE_GREEN = '#4ADE80';

function wouldContributeToTopAttempts(score: number, topScores: number[]): boolean {
  if (topScores.length < 2) return true;
  return score > Math.min(...topScores);
}

function mergeTopScores(score: number, topScores: number[]): number[] {
  return [...topScores, score].sort((a, b) => b - a).slice(0, 2);
}

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
  const { data: war } = useGangWarState(gangId);

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
  const [topScores, setTopScores] = useState<number[]>([]);
  const autoFinishedRef = useRef(false);
  const amountRef = useRef(0);

  useEffect(() => {
    if (war?.my_top_scores) setTopScores(war.my_top_scores.map(Number));
  }, [war?.my_top_scores]);

  const willContribute = wouldContributeToTopAttempts(trackedAmount, topScores);
  const projectedTopScores = mergeTopScores(trackedAmount, topScores);

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

  function handleRetry() {
    autoFinishedRef.current = false;
    setTimerStarted(false);
    setTrackedAmount(0);
    if (sessionLimit) setSecondsLeft(sessionLimit);
    setStep('active');
  }

  async function handleSubmit() {
    if (trackedAmount < 0) return;
    if (!wouldContributeToTopAttempts(trackedAmount, topScores)) {
      handleRetry();
      return;
    }
    setStep('saving');
    setErrorMessage(null);
    try {
      const res = await submitAttempt.mutateAsync({
        matchId,
        gangId,
        score: trackedAmount,
      });
      setResult(res);
      setTopScores(mergeTopScores(res.score_submitted, topScores));
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
        <LinearGradient
          colors={['rgba(77,140,255,0.22)', 'transparent', 'rgba(74,222,128,0.08)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Header title="Contribution locked" onClose={() => router.back()} />
        <View style={[styles.centered, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.heroBadge}>
            <LinearGradient
              colors={['#4D8CFF', '#22C55E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBadgeGlow}
            >
              <MaterialCommunityIcons name="sword-cross" size={36} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={styles.doneEyebrow}>FOR THE GANG</Text>
          <Text style={styles.doneTitle}>You showed up</Text>
          <Text style={styles.doneSubtitle}>
            This try is on the board. Keep pushing your top two.
          </Text>

          <View style={styles.scoreHeroCard}>
            <Text style={styles.scoreHeroLabel}>This attempt</Text>
            <Text style={styles.scoreHeroValue}>
              {formatAmount(result.score_submitted, unit)}
            </Text>
          </View>

          <TopAttemptsPanel
            title="Your highest today"
            scores={topScores}
            unit={unit}
            highlightScore={result.score_submitted}
          />

          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Day total</Text>
              <Text style={styles.statValue}>
                {formatAmount(result.member_day_contribution, unit)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Gang week</Text>
              <Text style={styles.statValue}>
                {formatAmount(result.gang_week_score, unit)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.primaryBtn, styles.primaryBtnWide, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '800', fontSize: 16 }}>
              Back to War
            </Text>
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
              ? 'Hold until form breaks'
              : 'Live counting'
            : step === 'review'
              ? 'Review score'
              : 'War challenge setup'
        }
        rightAction={
          step === 'active' && !sessionLimit && !isHold ? (
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
          <ExerciseSetupGuide
            exerciseType={exerciseType}
            guide={guide}
            dontShowAgain={dontShowSetupAgain}
            onDontShowAgainChange={setDontShowSetupAgain}
          />
          {sessionLimit && !isHold ? (
            <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
              Timer starts on your first rep — then {sessionLimit} seconds.
            </Text>
          ) : isHold ? (
            <Text style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
              Get into form to start the countdown. Your score locks the moment form breaks.
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
                endOnBreak
                onElapsedChange={setTrackedAmount}
                onHoldComplete={(seconds) => {
                  if (autoFinishedRef.current) return;
                  autoFinishedRef.current = true;
                  setTrackedAmount(seconds);
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setStep('review');
                }}
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
        <View style={styles.reviewShell}>
          <LinearGradient
            colors={
              willContribute
                ? ['rgba(74,222,128,0.16)', 'transparent', 'rgba(77,140,255,0.14)']
                : ['rgba(148,163,184,0.12)', 'transparent', 'rgba(77,140,255,0.1)']
            }
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.reviewBody, { paddingBottom: insets.bottom + 24 }]}>
            <View
              style={[
                styles.contributePill,
                {
                  backgroundColor: willContribute
                    ? 'rgba(74,222,128,0.16)'
                    : 'rgba(148,163,184,0.12)',
                  borderColor: willContribute
                    ? 'rgba(74,222,128,0.45)'
                    : 'rgba(148,163,184,0.25)',
                },
              ]}
            >
              <View
                style={[
                  styles.contributeDot,
                  { backgroundColor: willContribute ? CONTRIBUTE_GREEN : '#94A3B8' },
                ]}
              />
              <Text
                style={{
                  color: willContribute ? CONTRIBUTE_GREEN : '#94A3B8',
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 13,
                  letterSpacing: 0.3,
                }}
              >
                {willContribute
                  ? topScores.length >= 2
                    ? 'Replaces your 2nd best'
                    : 'Counts toward your top 2'
                  : 'Below your 2nd best — retry'}
              </Text>
            </View>

            <Text style={styles.reviewEyebrow}>This attempt</Text>
            <Text style={styles.reviewScore}>
              {isHold ? formatHoldReview(trackedAmount) : trackedAmount}
            </Text>
            <Text style={styles.reviewUnit}>{isHold ? 'seconds' : unit}</Text>

            <TopAttemptsPanel
              title="Your highest today"
              scores={topScores}
              unit={unit}
              previewScore={willContribute ? trackedAmount : undefined}
              projectedScores={willContribute ? projectedTopScores : undefined}
            />

            {willContribute ? (
              <TouchableOpacity
                onPress={() => void handleSubmit()}
                style={[styles.primaryBtn, styles.primaryBtnWide, { backgroundColor: CONTRIBUTE_GREEN }]}
              >
                <Text style={{ color: '#052E16', fontWeight: '800', fontSize: 16 }}>
                  Submit Reps
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleRetry}
                style={[styles.primaryBtn, styles.primaryBtnWide, { backgroundColor: t.accent }]}
              >
                <Text style={{ color: t.accentOnPrimary, fontWeight: '800', fontSize: 16 }}>
                  Retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function TopAttemptsPanel({
  title,
  scores,
  unit,
  highlightScore,
  previewScore,
  projectedScores,
}: {
  title: string;
  scores: number[];
  unit: ExerciseUnit;
  highlightScore?: number;
  previewScore?: number;
  projectedScores?: number[];
}) {
  const display = projectedScores ?? scores;
  const emptySlots = Math.max(0, 2 - display.length);
  const previewIndex =
    previewScore != null && projectedScores
      ? projectedScores.findIndex((score) => score === previewScore)
      : -1;

  return (
    <View style={styles.topPanel}>
      <Text style={styles.topPanelTitle}>{title}</Text>
      {display.length === 0 ? (
        <Text style={styles.topPanelEmpty}>No attempts yet — yours can be first</Text>
      ) : (
        <View style={styles.topSlots}>
          {display.map((score, index) => {
            const isPreview = index === previewIndex;
            const isHighlight =
              !isPreview &&
              highlightScore != null &&
              score === highlightScore &&
              display.findIndex((s) => s === highlightScore) === index;
            return (
              <View
                key={`${score}-${index}`}
                style={[
                  styles.topSlot,
                  (isHighlight || isPreview) && styles.topSlotHot,
                ]}
              >
                <Text style={styles.topSlotRank}>
                  {index === 0 ? 'Best' : '2nd'}
                </Text>
                <Text
                  style={[
                    styles.topSlotValue,
                    (isHighlight || isPreview) && { color: CONTRIBUTE_GREEN },
                  ]}
                >
                  {formatAmount(score, unit)}
                </Text>
                {isPreview ? (
                  <Text style={styles.topSlotTag}>NEW</Text>
                ) : isHighlight ? (
                  <Text style={styles.topSlotTag}>IN</Text>
                ) : null}
              </View>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, index) => (
            <View key={`empty-${index}`} style={[styles.topSlot, styles.topSlotEmpty]}>
              <Text style={styles.topSlotRank}>
                {display.length + index === 0 ? 'Best' : '2nd'}
              </Text>
              <Text style={styles.topSlotEmptyText}>Open</Text>
            </View>
          ))}
        </View>
      )}
    </View>
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
  reviewShell: { flex: 1 },
  reviewBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  contributePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  contributeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  reviewEyebrow: {
    color: '#94A3B8',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: fontFamily.bodySemi,
  },
  reviewScore: {
    color: '#F8FAFC',
    fontSize: 64,
    lineHeight: 70,
    fontFamily: fontFamily.display,
    fontVariant: ['tabular-nums'],
  },
  reviewUnit: {
    color: '#94A3B8',
    fontSize: 15,
    marginBottom: 8,
  },
  topPanel: {
    width: '100%',
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(14, 21, 36, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(77, 140, 255, 0.28)',
    gap: 10,
  },
  topPanelTitle: {
    color: '#8FB4FF',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: fontFamily.bodySemi,
  },
  topPanelEmpty: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  topSlots: {
    gap: 8,
  },
  topSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  topSlotHot: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
  },
  topSlotEmpty: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  topSlotRank: {
    color: '#7D8AA8',
    fontSize: 12,
    fontFamily: fontFamily.bodySemi,
    minWidth: 36,
  },
  topSlotValue: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 18,
    fontFamily: fontFamily.bodySemi,
    fontVariant: ['tabular-nums'],
  },
  topSlotEmptyText: {
    flex: 1,
    color: '#64748B',
    fontSize: 14,
  },
  topSlotTag: {
    color: CONTRIBUTE_GREEN,
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: fontFamily.bodySemi,
  },
  heroBadge: {
    marginBottom: 8,
  },
  heroBadgeGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneEyebrow: {
    color: CONTRIBUTE_GREEN,
    fontSize: 12,
    letterSpacing: 1.6,
    fontFamily: fontFamily.bodySemi,
    marginTop: 8,
  },
  doneTitle: {
    color: '#F8FAFC',
    fontSize: 30,
    fontFamily: fontFamily.display,
    marginTop: 4,
    textAlign: 'center',
  },
  doneSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
    maxWidth: 280,
  },
  scoreHeroCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(77,140,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(77,140,255,0.3)',
    marginTop: 8,
  },
  scoreHeroLabel: {
    color: '#8FB4FF',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: fontFamily.bodySemi,
  },
  scoreHeroValue: {
    color: '#F8FAFC',
    fontSize: 40,
    fontFamily: fontFamily.display,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  statRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(14, 21, 36, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(77, 140, 255, 0.22)',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(143, 180, 255, 0.3)',
  },
  statLabel: {
    color: '#7D8AA8',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: fontFamily.bodySemi,
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontFamily: fontFamily.bodySemi,
    fontVariant: ['tabular-nums'],
  },
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
  primaryBtnWide: {
    alignSelf: 'stretch',
    marginTop: 18,
    paddingVertical: 16,
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
