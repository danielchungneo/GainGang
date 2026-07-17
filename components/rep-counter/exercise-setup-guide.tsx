import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { cameraHud } from '@/components/rep-counter/camera-hud-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  CAMERA_SETUP_VIDEO,
  EXERCISE_TUTORIAL_VIDEOS,
} from '@/lib/rep-counting/exercise-registry';
import type { CameraExerciseType, ExerciseSetupInfo } from '@/lib/rep-counting/types';
import { brand, radius } from '@/lib/gaingang-theme/tokens';

const PAGE_COUNT = 3;

interface ExerciseSetupGuideProps {
  exerciseType: CameraExerciseType;
  guide: ExerciseSetupInfo;
  dontShowAgain?: boolean;
  onDontShowAgainChange?: (value: boolean) => void;
}

/** Phone tipping sideways — plus the live-camera control to tap afterward. */
function OrientationTipVisual({
  accent,
  isActive,
}: {
  accent: string;
  isActive: boolean;
}) {
  const progress = useSharedValue(0);
  const buttonPulse = useSharedValue(0);

  useEffect(() => {
    if (!isActive) {
      progress.value = 0;
      buttonPulse.value = 0;
      return;
    }

    const pulseUpMs = 220;
    const pulseDownMs = 280;
    const pulseTotalMs = (pulseUpMs + pulseDownMs) * 2; // ~1s double-pulse
    const afterPulsePauseMs = 350; // brief beat, then tip
    const rotateMs = 1100;
    const holdHorizontalMs = 1800;
    const holdVerticalMs = 1400;
    // Quiet start, then pulse in the couple seconds right before the tip.
    const idleBeforePulseMs = 400;
    const timeUntilRotateMs = idleBeforePulseMs + pulseTotalMs + afterPulsePauseMs;
    const afterPulseRestMs =
      afterPulsePauseMs + rotateMs + holdHorizontalMs + rotateMs + holdVerticalMs;

    buttonPulse.value = withRepeat(
      withSequence(
        withDelay(idleBeforePulseMs, withTiming(1, { duration: pulseUpMs, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: pulseDownMs, easing: Easing.in(Easing.quad) }),
        withTiming(1, { duration: pulseUpMs, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: pulseDownMs, easing: Easing.in(Easing.quad) }),
        withDelay(afterPulseRestMs, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );

    progress.value = withRepeat(
      withSequence(
        withDelay(
          timeUntilRotateMs,
          withTiming(1, { duration: rotateMs, easing: Easing.inOut(Easing.cubic) }),
        ),
        withDelay(
          holdHorizontalMs,
          withTiming(0, { duration: rotateMs, easing: Easing.inOut(Easing.cubic) }),
        ),
        withDelay(holdVerticalMs, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [buttonPulse, isActive, progress]);

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 90])}deg` }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + buttonPulse.value * 0.16 }],
  }));

  const buttonGlowStyle = useAnimatedStyle(() => ({
    opacity: buttonPulse.value * 0.5,
    transform: [{ scale: 1 + buttonPulse.value * 0.55 }],
  }));

  return (
    <View style={orientStyles.stage} accessibilityLabel="Phone rotating sideways demo">
      <View style={orientStyles.phoneSlot}>
        <Animated.View style={[orientStyles.phone, phoneStyle]}>
          <View style={orientStyles.phoneBezel}>
            <View style={orientStyles.dynamicIsland} />
            <View style={orientStyles.phoneScreenContent}>
              <View style={orientStyles.homeIndicator} />
            </View>
          </View>
          <View style={[orientStyles.sideButton, orientStyles.silentSwitch]} />
          <View style={[orientStyles.sideButton, orientStyles.volumeUp]} />
          <View style={[orientStyles.sideButton, orientStyles.volumeDown]} />
          <View style={[orientStyles.sideButton, orientStyles.powerButton]} />
        </Animated.View>
      </View>

      <View style={orientStyles.buttonCallout}>
        <View style={orientStyles.buttonAnchor}>
          <Animated.View style={[orientStyles.buttonGlow, buttonGlowStyle]} />
          <Animated.View style={[orientStyles.orientBtn, buttonStyle]}>
            <Ionicons name="phone-landscape-outline" size={26} color={brand.blueGlow} />
          </Animated.View>
        </View>
        <Text style={[orientStyles.buttonCalloutLabel, { color: accent }]}>Tap to rotate</Text>
      </View>
    </View>
  );
}

export function ExerciseSetupGuide({
  exerciseType,
  guide,
  dontShowAgain = false,
  onDontShowAgainChange,
}: ExerciseSetupGuideProps) {
  const t = useThemeTokens();
  const showDontShowAgain = typeof onDontShowAgainChange === 'function';
  const [pagerSize, setPagerSize] = useState({ width: 0, height: 0 });
  const [pageIndex, setPageIndex] = useState(0);

  const cameraSetupPlayer = useVideoPlayer(CAMERA_SETUP_VIDEO, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });
  const exercisePlayer = useVideoPlayer(EXERCISE_TUTORIAL_VIDEOS[exerciseType], (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    if (pageIndex === 0) {
      exercisePlayer.pause();
      cameraSetupPlayer.play();
      return;
    }
    if (pageIndex === 1) {
      cameraSetupPlayer.pause();
      exercisePlayer.play();
      return;
    }
    cameraSetupPlayer.pause();
    exercisePlayer.pause();
  }, [pageIndex, cameraSetupPlayer, exercisePlayer]);

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pagerSize.width <= 0) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pagerSize.width);
    setPageIndex(Math.min(PAGE_COUNT - 1, Math.max(0, nextIndex)));
  }

  return (
    <View style={[styles.card, { backgroundColor: 'rgba(14, 21, 36, 0.92)', borderColor: t.buttonBorder }]}>
      <View
        style={styles.pager}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          const nextWidth = Math.round(width);
          const nextHeight = Math.round(height);
          if (
            nextWidth > 0 &&
            nextHeight > 0 &&
            (nextWidth !== pagerSize.width || nextHeight !== pagerSize.height)
          ) {
            setPagerSize({ width: nextWidth, height: nextHeight });
          }
        }}
      >
        {pagerSize.width > 0 && pagerSize.height > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            decelerationRate="fast"
            style={{ width: pagerSize.width, height: pagerSize.height }}
          >
            <View style={[styles.page, { width: pagerSize.width, height: pagerSize.height }]}>
              <VideoView
                player={cameraSetupPlayer}
                style={styles.video}
                contentFit="contain"
                nativeControls={false}
                accessibilityLabel="Camera setup tutorial"
              />
              <View style={styles.pageFooter}>
                <View style={styles.header}>
                  <Ionicons name="phone-portrait-outline" size={22} color={t.accent} />
                  <Text style={[styles.title, { color: t.heading }]}>Camera setup</Text>
                </View>
                <Text style={[styles.hint, { color: t.body }]}>
                  Prop your phone against a wall or mount it on a tripod so it stays steady.
                </Text>
                <View style={styles.tipRow}>
                  <Text style={{ color: t.accent }}>•</Text>
                  <Text style={[styles.tipText, { color: t.body }]}>
                    Leave enough space in frame for your full movement.
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Text style={{ color: t.accent }}>•</Text>
                  <Text style={[styles.tipText, { color: t.body }]}>
                    Keep the phone still once recording starts.
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.page, { width: pagerSize.width, height: pagerSize.height }]}>
              <VideoView
                player={exercisePlayer}
                style={styles.video}
                contentFit="contain"
                nativeControls={false}
                accessibilityLabel={`${guide.title} positioning tutorial`}
              />
              <View style={styles.pageFooter}>
                <View style={styles.header}>
                  <Ionicons name="body-outline" size={22} color={t.accent} />
                  <Text style={[styles.title, { color: t.heading }]}>Body position</Text>
                </View>
                <Text style={[styles.hint, { color: t.body }]}>
                  {guide.cameraHint === 'side'
                    ? 'Best angle: side view (profile)'
                    : 'Best angle: front or side view'}
                </Text>
                {guide.tips.map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Text style={{ color: t.accent }}>•</Text>
                    <Text style={[styles.tipText, { color: t.body }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.page, { width: pagerSize.width, height: pagerSize.height }]}>
              <OrientationTipVisual accent={t.accent} isActive={pageIndex === 2} />
              <View style={styles.pageFooter}>
                <View style={styles.header}>
                  <Ionicons name="phone-landscape-outline" size={22} color={t.accent} />
                  <Text style={[styles.title, { color: t.heading }]}>Need more width?</Text>
                </View>
                <Text style={[styles.hint, { color: t.body }]}>
                  Tip your phone on its side for planks, sit-ups, and other sideways moves — then
                  rotate the on-screen controls so they stay readable.
                </Text>
                <View style={styles.tipRow}>
                  <Text style={{ color: t.accent }}>•</Text>
                  <Text style={[styles.tipText, { color: t.body }]}>
                    Tap the landscape button in the camera header (next to Finish).
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Text style={{ color: t.accent }}>•</Text>
                  <Text style={[styles.tipText, { color: t.body }]}>
                    The camera preview stays the same; only the UI and counting adjust.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.dotsRow} accessibilityRole="tablist">
        {Array.from({ length: PAGE_COUNT }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: pageIndex === index ? t.accent : 'rgba(148, 163, 184, 0.45)',
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: pageIndex === index }}
          />
        ))}
      </View>

      {showDontShowAgain ? (
        <Pressable
          onPress={() => onDontShowAgainChange(!dontShowAgain)}
          style={styles.dontShowRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontShowAgain }}
          accessibilityLabel="Don't show this tip again"
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: dontShowAgain ? t.accent : t.buttonBorder,
                backgroundColor: dontShowAgain ? t.accent : 'transparent',
              },
            ]}
          >
            {dontShowAgain ? (
              <Ionicons name="checkmark" size={14} color={t.accentOnPrimary} />
            ) : null}
          </View>
          <Text style={[styles.dontShowLabel, { color: t.body }]}>
            Don{"'"}t show this tip again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  pager: {
    flex: 1,
  },
  page: {
    gap: 12,
  },
  video: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#000',
  },
  pageFooter: {
    gap: 10,
    flexShrink: 0,
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
    lineHeight: 18,
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
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dontShowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dontShowLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});

const orientStyles = StyleSheet.create({
  stage: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#05070F',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  phoneSlot: {
    width: 150,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 78,
    height: 158,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    padding: 3.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  phoneBezel: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: '#000',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dynamicIsland: {
    alignSelf: 'center',
    marginTop: 8,
    width: 34,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  phoneScreenContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  homeIndicator: {
    alignSelf: 'center',
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(232, 237, 247, 0.55)',
  },
  sideButton: {
    position: 'absolute',
    backgroundColor: '#2C2C2E',
    borderRadius: 1,
  },
  silentSwitch: {
    left: -2,
    top: 28,
    width: 2,
    height: 10,
  },
  volumeUp: {
    left: -2,
    top: 46,
    width: 2,
    height: 16,
  },
  volumeDown: {
    left: -2,
    top: 66,
    width: 2,
    height: 16,
  },
  powerButton: {
    right: -2,
    top: 52,
    width: 2,
    height: 28,
  },
  buttonCallout: {
    alignItems: 'center',
    gap: 10,
  },
  buttonAnchor: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: brand.blueGlow,
  },
  orientBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cameraHud.surfaceStrong,
    borderWidth: 1,
    borderColor: cameraHud.borderStrong,
  },
  buttonCalloutLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
