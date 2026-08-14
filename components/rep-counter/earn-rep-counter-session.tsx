import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseSetupGuide } from '@/components/rep-counter/exercise-setup-guide';
import { useAuth } from '@/context/auth-context';
import { useLogActivity } from '@/hooks/use-activities';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useDailyGoal } from '@/hooks/use-weekly-plans';
import { saveDailyGoalExerciseDelta } from '@/lib/daily-goal-save';
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
import { grantTemporaryScreenTime, MIN_TEMPORARY_UNLOCK_MINUTES } from '@/lib/screen-time-lock';
import type { CameraTrackingMode } from '@/lib/rep-counting/types';
import type { ExerciseCategory, ExerciseUnit } from '@/types';

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

type SessionStep = 'setup' | 'active' | 'review' | 'saving' | 'error';

export interface EarnRepCounterSessionProps {
  exerciseId: string;
  exerciseName: string;
  unit: Extract<ExerciseUnit, 'reps' | 'seconds'>;
  targetAmount: number;
  unlockMinutes: number;
  dailyGoalId?: string;
  dailyGoalExerciseId?: string;
  gangId?: string;
  category?: ExerciseCategory;
}

function formatHoldReview(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function EarnRepCounterSession({
  exerciseId,
  exerciseName,
  unit,
  targetAmount,
  unlockMinutes,
  dailyGoalId: dailyGoalIdProp,
  dailyGoalExerciseId: dailyGoalExerciseIdProp,
  gangId: gangIdProp,
  category,
}: EarnRepCounterSessionProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const logActivity = useLogActivity();
  const dailyGoalId = dailyGoalIdProp?.trim() || undefined;
  const dailyGoalExerciseId = dailyGoalExerciseIdProp?.trim() || undefined;
  const gangId = gangIdProp?.trim() || undefined;
  const { data: dailyGoal } = useDailyGoal(dailyGoalId);

  const exerciseType = getCameraExerciseType(exerciseName);
  const trackingMode: CameraTrackingMode | null = exerciseType
    ? getCameraTrackingMode(exerciseType)
    : null;
  const isHold = trackingMode === 'hold';
  const guide = exerciseType ? SETUP_GUIDES[exerciseType] : null;
  const nativeSupported = isRepCounterNativeSupported();

  const [step, setStep] = useState<SessionStep>('setup');
  const [trackedAmount, setTrackedAmount] = useState(0);
  const [dontShowSetupAgain, setDontShowSetupAgain] = useState(false);
  const [isSetupPreferenceReady, setIsSetupPreferenceReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoFinishRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveInitialStep() {
      setTrackedAmount(0);
      setDontShowSetupAgain(false);
      setIsSetupPreferenceReady(false);
      autoFinishRef.current = false;

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
  }, [exerciseId, exerciseType]);

  useEffect(() => {
    if (step !== 'active' || targetAmount <= 0) return;
    if (trackedAmount < targetAmount || autoFinishRef.current) return;

    autoFinishRef.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('review');
  }, [step, targetAmount, trackedAmount]);

  async function handleStartCounting() {
    if (dontShowSetupAgain && exerciseType) {
      await setCameraSetupSkipped(exerciseType, true);
    }
    setStep('active');
  }

  async function handleClaim() {
    if (trackedAmount < targetAmount || !userId) return;
    setStep('saving');
    setErrorMessage(null);

    try {
      if (dailyGoalId && dailyGoalExerciseId && dailyGoal) {
        const exercise = dailyGoal.exercises.find((ex) => ex.id === dailyGoalExerciseId);
        if (!exercise) {
          throw new Error('Could not find that exercise on today’s goal.');
        }
        await saveDailyGoalExerciseDelta({
          exercise,
          goal: dailyGoal,
          delta: trackedAmount,
          logActivity,
          userId,
        });
      } else if (dailyGoalId && dailyGoalExerciseId && !dailyGoal) {
        throw new Error('Still loading today’s goal. Try again in a moment.');
      } else {
        await logActivity.mutateAsync({
          gangId,
          exerciseId,
          exerciseName,
          category,
          unit,
          amount: trackedAmount,
        });
      }

      const grant = await grantTemporaryScreenTime(unlockMinutes, {
        allowBelowMinimum: __DEV__ && unlockMinutes < MIN_TEMPORARY_UNLOCK_MINUTES,
      });
      if (!grant.unlocked) {
        throw new Error(
          'Could not unlock apps. Make sure Focus lock is on and apps are currently locked.',
        );
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Dismiss the fullScreenModal rep-counter first so Today isn't left
      // presented as a sheet, then land on the earn confirmation screen.
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace({
        pathname: '/earn-screen-time',
        params: { grantedMinutes: String(grant.minutes) },
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not claim screen time');
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
            Camera tracking is not available for this earn offer.
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
          <Text style={{ color: t.body, marginTop: 12 }}>Unlocking apps…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]}>
        <Header title="Earn screen time" onClose={() => router.back()} />
        <View style={styles.centered}>
          <Text style={{ color: t.heading, fontSize: 18, fontWeight: '700' }}>
            Could not unlock
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#05070F' }]} edges={['left', 'right']}>
      {step !== 'review' ? (
        <Header
          title={guide.title}
          subtitle={`Earn ${unlockMinutes} min · target ${targetAmount}${isHold ? 's' : ''}`}
          onClose={() => router.back()}
        />
      ) : null}

      {step === 'setup' ? (
        <View style={[styles.setupBody, { paddingBottom: insets.bottom + 16 }]}>
          <ExerciseSetupGuide
            exerciseType={exerciseType}
            guide={guide}
            dontShowAgain={dontShowSetupAgain}
            onDontShowAgainChange={setDontShowSetupAgain}
          />
          <TouchableOpacity
            onPress={() => void handleStartCounting()}
            style={[styles.primaryBtn, { backgroundColor: t.accent }]}
          >
            <Text style={{ color: t.accentOnPrimary, fontWeight: '700' }}>Start</Text>
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
                targetSeconds={targetAmount}
                onElapsedChange={setTrackedAmount}
              />
            ) : (
              <RepCounterCamera
                exerciseType={exerciseType}
                targetReps={targetAmount}
                onRepCountChange={setTrackedAmount}
                requirePermission
              />
            )}
          </Suspense>
        </View>
      ) : null}

      {step === 'review' ? (
        <ClaimScreenTimeView
          exerciseName={guide.title}
          amountLabel={isHold ? formatHoldReview(trackedAmount) : String(trackedAmount)}
          unitLabel={isHold ? 'seconds held' : unit === 'reps' ? 'reps completed' : unit}
          unlockMinutes={unlockMinutes}
          bottomInset={insets.bottom}
          onClaim={() => void handleClaim()}
          onClose={() => router.back()}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ClaimScreenTimeView({
  exerciseName,
  amountLabel,
  unitLabel,
  unlockMinutes,
  bottomInset,
  onClaim,
  onClose,
}: {
  exerciseName: string;
  amountLabel: string;
  unitLabel: string;
  unlockMinutes: number;
  bottomInset: number;
  onClaim: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const appear = useSharedValue(0);
  const badgeScale = useSharedValue(0.7);

  useEffect(() => {
    appear.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    badgeScale.value = withDelay(80, withSpring(1, { damping: 12, stiffness: 160 }));
  }, [appear, badgeScale]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 18 }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <View style={styles.claimRoot}>
      <LinearGradient
        colors={['#0B1224', '#05070F', '#07101F']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Ionicons name="close" size={28} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Target complete</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <Animated.View style={[styles.claimBody, contentStyle]}>
        <Animated.View style={[styles.claimBadgeWrap, badgeStyle]}>
          <View style={styles.claimGlow} pointerEvents="none" />
          <LinearGradient
            colors={['rgba(77,140,255,0.35)', 'rgba(77,140,255,0.08)']}
            style={styles.claimBadgeRing}
          >
            <View style={styles.claimBadgeInner}>
              <Ionicons name="phone-portrait-outline" size={36} color="#8FB4FF" />
              <View style={styles.claimBadgeCheck}>
                <Ionicons name="checkmark" size={16} color="#05070F" />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.claimEyebrow}>{exerciseName}</Text>
        <Text style={styles.claimHeadline}>You earned it</Text>
        <Text style={styles.claimSub}>
          Unlock your restricted apps for a focused burst of screen time.
        </Text>

        <View style={styles.claimStats}>
          <View style={styles.claimStat}>
            <Text style={styles.claimStatValue}>{amountLabel}</Text>
            <Text style={styles.claimStatLabel}>{unitLabel}</Text>
          </View>
          <View style={styles.claimStatDivider} />
          <View style={styles.claimStat}>
            <Text style={styles.claimStatValue}>{unlockMinutes}</Text>
            <Text style={styles.claimStatLabel}>min screen time</Text>
          </View>
        </View>
      </Animated.View>

      <View style={[styles.claimFooter, { paddingBottom: Math.max(bottomInset, 16) + 8 }]}>
        <Pressable
          onPress={onClaim}
          accessibilityRole="button"
          accessibilityLabel={`Claim ${unlockMinutes} minutes of screen time`}
          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
        >
          <LinearGradient
            colors={['#6BA0FF', '#4D8CFF', '#3A74E0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.claimButton}
          >
            <Ionicons name="lock-open-outline" size={20} color="#FFFFFF" />
            <Text style={styles.claimButtonLabel}>Claim screen time</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Header({
  title,
  subtitle,
  onClose,
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
      <View style={styles.headerRight} />
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
  headerRight: { minWidth: 28 },
  headerTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  claimRoot: {
    flex: 1,
  },
  claimBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  claimBadgeWrap: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  claimGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(77,140,255,0.14)',
  },
  claimBadgeRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(143,180,255,0.35)',
  },
  claimBadgeInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(5,7,15,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBadgeCheck: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8FB4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimEyebrow: {
    fontFamily: fontFamily.bodySemi,
    color: '#8FB4FF',
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  claimHeadline: {
    fontFamily: fontFamily.display,
    color: '#F8FAFC',
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  claimSub: {
    marginTop: 10,
    color: '#AEB8D0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  claimStats: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(77,140,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(77,140,255,0.22)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 320,
  },
  claimStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  claimStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(143,180,255,0.28)',
  },
  claimStatValue: {
    fontFamily: fontFamily.display,
    color: '#F8FAFC',
    fontSize: 32,
    lineHeight: 36,
    fontVariant: ['tabular-nums'],
  },
  claimStatLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  claimFooter: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    paddingVertical: 18,
    shadowColor: '#4D8CFF',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  claimButtonLabel: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bodySemi,
    fontSize: 17,
    letterSpacing: 0.2,
  },
});
