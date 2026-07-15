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

import { cameraHud, cameraHudStyles as hud } from '@/components/rep-counter/camera-hud-styles';
import { PoseSkeletonOverlay } from '@/components/rep-counter/pose-skeleton-overlay';
import { isDebugEnabled } from '@/lib/debug';
import { iosPoseLandmarkerPlugin } from '@/lib/rep-counting/ios-pose-plugin';
import { normalizePoseLandmarks } from '@/lib/rep-counting/normalize-pose-landmarks';
import { createRepCounter } from '@/lib/rep-counting/rep-counter';
import type { CameraExerciseType, Landmark, RepCounterSnapshot } from '@/lib/rep-counting/types';

const BRIDGE_INTERVAL_MS = 66;
const SHOW_ANGLE_DEBUG = isDebugEnabled();

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
  // Prefer multi-cam front devices so zoom can reach the wider FOV (iPhone
  // Camera app selfie "zoom out" / ~0.5x). Still returns a single-lens front cam if that's all there is.
  const device = useCameraDevice('front', {
    physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
  });
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
      [cameraHud.surface, cameraHud.flashBg],
    ),
    borderColor: interpolateColor(
      repFlash.value,
      [0, 1],
      [cameraHud.border, cameraHud.flashBorder],
    ),
    transform: [{ scale: 1 + repFlash.value * 0.08 }],
  }));

  const repValueAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(repFlash.value, [0, 1], [cameraHud.text, '#FFFFFF']),
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
        : exerciseType === 'situp' || exerciseType === 'crunch'
          ? 'Keep your torso and knees in frame'
          : exerciseType === 'plank'
            ? 'Get into plank position'
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
    [onRepCountChange, onSnapshot, repFlash],
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
              : exerciseType === 'situp' || exerciseType === 'crunch'
                ? 'Keep your torso and knees in frame'
                : exerciseType === 'plank'
                  ? 'Get into plank position'
                  : 'Step back — keep your full body in frame',
          );
          return;
        }

        handlePoseResult(result.pose);
      }),
    [exerciseType, handlePoseResult],
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

  // Widest FOV: on devices that support selfie zoom-out, minZoom < neutralZoom.
  const widestZoom = device.minZoom;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        zoom={widestZoom}
        pixelFormat="rgb"
        frameProcessor={frameProcessor}
      />

      <PoseSkeletonOverlay
        landmarks={landmarks}
        width={layout.width}
        height={layout.height}
        mirrored
      />

      <View style={hud.hudTop}>
        {!fullyInFrame || !trackingOk ? (
          <View style={hud.warningCard}>
            <Text style={hud.warningText}>
              {!fullyInFrame
                ? frameMessage
                : 'Reposition — keep joints in frame'}
            </Text>
          </View>
        ) : SHOW_ANGLE_DEBUG ? (
          <View style={hud.secondaryBadge}>
            <Text style={hud.secondaryLabel}>Angle</Text>
            <Text style={hud.secondaryValue}>{angle}°</Text>
            <Text style={hud.secondaryCaption}>{phase}</Text>
          </View>
        ) : null}
      </View>

      <View style={hud.hudBottom}>
        <Animated.View style={[hud.metricBadge, repBadgeAnimatedStyle]}>
          <Text style={hud.metricLabel}>Reps</Text>
          <Animated.Text style={[hud.metricValue, repValueAnimatedStyle]}>{repCount}</Animated.Text>
        </Animated.View>
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
    color: '#E8EDF7',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
});
