import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

import { PoseSkeletonOverlay } from '@/components/rep-counter/pose-skeleton-overlay';
import { iosPoseLandmarkerPlugin } from '@/lib/rep-counting/ios-pose-plugin';
import { normalizePoseLandmarks } from '@/lib/rep-counting/normalize-pose-landmarks';
import { createRepCounter } from '@/lib/rep-counting/rep-counter';
import type { CameraExerciseType, Landmark, RepCounterSnapshot } from '@/lib/rep-counting/types';

const BRIDGE_INTERVAL_MS = 66;

interface RepCounterCameraProps {
  exerciseType: CameraExerciseType;
  onRepCountChange?: (count: number) => void;
  onSnapshot?: (snapshot: RepCounterSnapshot) => void;
}

export function RepCounterCamera({
  exerciseType,
  onRepCountChange,
  onSnapshot,
}: RepCounterCameraProps) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [trackingOk, setTrackingOk] = useState(false);
  const [fullyInFrame, setFullyInFrame] = useState(false);
  const [frameMessage, setFrameMessage] = useState('Keep your upper body in frame');
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<string>('—');
  const [angle, setAngle] = useState(0);

  const repCounterRef = useRef(createRepCounter(exerciseType));
  const lastRepRef = useRef(0);
  const lastBridgeAtRef = useRef(0);
  const repFlash = useSharedValue(0);

  const repBadgeAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      repFlash.value,
      [0, 1],
      ['rgba(5, 7, 15, 0.72)', 'rgba(34, 197, 94, 0.9)'],
    ),
    borderColor: interpolateColor(
      repFlash.value,
      [0, 1],
      ['rgba(34, 211, 238, 0.35)', 'rgba(74, 222, 128, 1)'],
    ),
    transform: [{ scale: 1 + repFlash.value * 0.08 }],
  }));

  const repValueAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(repFlash.value, [0, 1], ['#F8FAFC', '#FFFFFF']),
  }));

  useEffect(() => {
    repCounterRef.current = createRepCounter(exerciseType);
    lastRepRef.current = 0;
    setRepCount(0);
    setPhase('—');
    setAngle(0);
    setLandmarks(null);
    setTrackingOk(false);
    setFullyInFrame(false);
    setFrameMessage(
      exerciseType === 'pushup'
        ? 'Keep your upper body in frame'
        : 'Step back — keep your full body in frame',
    );
  }, [exerciseType]);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handlePoseResult = useCallback(
    (pose: Landmark[]) => {
      const normalized = normalizePoseLandmarks(pose);
      const snapshot = repCounterRef.current.processFrame(normalized);
      setLandmarks(normalized);
      setTrackingOk(snapshot.trackingOk);
      setFullyInFrame(snapshot.fullyInFrame);
      setFrameMessage(snapshot.frameMessage);
      setRepCount(snapshot.repCount);
      setPhase(snapshot.phase);
      setAngle(Math.round(snapshot.angle));
      onSnapshot?.(snapshot);

      if (snapshot.repCount > lastRepRef.current) {
        lastRepRef.current = snapshot.repCount;
        repFlash.value = 0;
        repFlash.value = withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0, { duration: 450 }),
        );
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onRepCountChange?.(snapshot.repCount);
      }
    },
    [onRepCountChange, onSnapshot],
  );

  const onPoseDetected = useMemo(
    () =>
      Worklets.createRunOnJS((result: { pose?: Landmark[] }) => {
        const now = Date.now();
        if (now - lastBridgeAtRef.current < BRIDGE_INTERVAL_MS) return;
        lastBridgeAtRef.current = now;

        if (!result.pose || result.pose.length === 0) {
          setTrackingOk(false);
          setFullyInFrame(false);
          setFrameMessage(
      exerciseType === 'pushup'
        ? 'Keep your upper body in frame'
        : 'Step back — keep your full body in frame',
    );
          return;
        }

        handlePoseResult(result.pose);
      }),
    [handlePoseResult],
  );

  // Platform.OS is unreliable inside worklets — use separate processors and pick on the JS thread.
  const iosFrameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!iosPoseLandmarkerPlugin) return;

      const result = iosPoseLandmarkerPlugin.call(frame) as unknown as Landmark[] | null;
      if (Array.isArray(result) && result.length >= 33) {
        onPoseDetected({ pose: result });
      }
    },
    [onPoseDetected],
  );

  const androidFrameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const detect = global.detectHandLandmarks;
      if (typeof detect !== 'function') return;

      const result = detect(frame);
      if (result?.pose && result.pose.length > 0) {
        onPoseDetected({ pose: result.pose as Landmark[] });
      }
    },
    [onPoseDetected],
  );

  const frameProcessor = Platform.OS === 'ios' ? iosFrameProcessor : androidFrameProcessor;

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Camera permission is required to count reps.</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>No front camera found on this device.</Text>
      </View>
    );
  }

  if (Platform.OS === 'ios' && !iosPoseLandmarkerPlugin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          Pose detection plugin not loaded. Rebuild your iOS dev client with the latest native config.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        pixelFormat="rgb"
        frameProcessor={frameProcessor}
      />

      <PoseSkeletonOverlay
        landmarks={landmarks}
        width={layout.width}
        height={layout.height}
        mirrored
      />

      <View style={styles.hudTop}>
        <Animated.View style={[styles.repBadge, repBadgeAnimatedStyle]}>
          <Text style={styles.repLabel}>REPS</Text>
          <Animated.Text style={[styles.repValue, repValueAnimatedStyle]}>{repCount}</Animated.Text>
        </Animated.View>
      </View>

      <View style={styles.hudBottom}>
        {!fullyInFrame || !trackingOk ? (
          <View style={styles.warningPill}>
            <Text style={styles.warningText}>
              {!fullyInFrame
                ? frameMessage
                : 'Reposition — keep joints in frame'}
            </Text>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <Text style={styles.statText}>Phase: {phase}</Text>
            <Text style={styles.statText}>Angle: {angle}°</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#05070F',
  },
  message: {
    color: '#E5E7EB',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  hudTop: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  repBadge: {
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  repLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  repValue: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 52,
  },
  hudBottom: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  warningPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  warningText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: 'rgba(5, 7, 15, 0.72)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
});
