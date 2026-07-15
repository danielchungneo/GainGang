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

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  CAMERA_SETUP_VIDEO,
  EXERCISE_TUTORIAL_VIDEOS,
} from '@/lib/rep-counting/exercise-registry';
import type { CameraExerciseType, ExerciseSetupInfo } from '@/lib/rep-counting/types';

interface ExerciseSetupGuideProps {
  exerciseType: CameraExerciseType;
  guide: ExerciseSetupInfo;
  dontShowAgain?: boolean;
  onDontShowAgainChange?: (value: boolean) => void;
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
    cameraSetupPlayer.pause();
    exercisePlayer.play();
  }, [pageIndex, cameraSetupPlayer, exercisePlayer]);

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pagerSize.width <= 0) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pagerSize.width);
    setPageIndex(Math.min(1, Math.max(0, nextIndex)));
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
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.dotsRow} accessibilityRole="tablist">
        {[0, 1].map((index) => (
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
