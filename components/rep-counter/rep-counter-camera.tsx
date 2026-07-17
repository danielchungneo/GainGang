import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { CameraSidewaysStage } from '@/components/rep-counter/camera-sideways-stage';
import { PoseSkeletonOverlay } from '@/components/rep-counter/pose-skeleton-overlay';
import { isDebugEnabled } from '@/lib/debug';
import { iosPoseLandmarkerPlugin } from '@/lib/rep-counting/ios-pose-plugin';
import {
  remapLandmarksForUiRotation,
  type CameraUiRotation,
} from '@/lib/rep-counting/landmark-orientation';
import { normalizePoseLandmarks } from '@/lib/rep-counting/normalize-pose-landmarks';
import { createRepCounter } from '@/lib/rep-counting/rep-counter';
import type { CameraExerciseType, Landmark, RepCounterSnapshot } from '@/lib/rep-counting/types';

const BRIDGE_INTERVAL_MS = 66;
const SHOW_ANGLE_DEBUG = isDebugEnabled();

interface RepCounterCameraProps {
  exerciseType: CameraExerciseType;
  onRepCountChange?: (count: number) => void;
  onSnapshot?: (snapshot: RepCounterSnapshot) => void;
  /** When set, HUD shows progress toward this target (e.g. onboarding demo). */
  targetReps?: number;
  /** Stronger permission-denied UX with retry + Settings. */
  requirePermission?: boolean;
  /** Header-controlled UI tip rotation for sideways filming. */
  uiRotation?: CameraUiRotation;
}

export function RepCounterCamera({
  exerciseType,
  onRepCountChange,
  onSnapshot,
  targetReps,
  requirePermission = false,
  uiRotation = 0,
}: RepCounterCameraProps) {
  // Prefer multi-cam front devices so zoom can reach the wider FOV (iPhone
  // Camera app selfie "zoom out" / ~0.5x). Still returns a single-lens front cam if that's all there is.
  const device = useCameraDevice('front', {
    physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
  });
  const { hasPermission, requestPermission } = useCameraPermission();
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [trackingOk, setTrackingOk] = useState(false);
  const [fullyInFrame, setFullyInFrame] = useState(false);
  const [frameMessage, setFrameMessage] = useState('Keep your upper body in frame');
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<string>('—');
  const [angle, setAngle] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(true);

  const repCounterRef = useRef(createRepCounter(exerciseType));
  const lastRepRef = useRef(0);
  const lastBridgeAtRef = useRef(0);
  const uiRotationRef = useRef<CameraUiRotation>(uiRotation);
  uiRotationRef.current = uiRotation;
  const repFlash = useSharedValue(0);

  useEffect(() => {
    // Briefly pause the frame processor when tipping UI so worklets-core
    // doesn't lose its invoker across the Reanimated HUD update.
    setIsCameraActive(false);
    const timer = setTimeout(() => setIsCameraActive(true), 50);
    return () => clearTimeout(timer);
  }, [uiRotation]);

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
      // Overlay stays in camera/display space; counting uses gravity-aligned coords.
      const forCounting = remapLandmarksForUiRotation(normalized, uiRotationRef.current);
      const snapshot = repCounterRef.current.processFrame(forCounting);
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

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          {requirePermission
            ? 'Camera permission is required to continue. Allow access so GainGang can count your push-ups.'
            : 'Camera permission is required to count reps.'}
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => void requestPermission()}
          accessibilityRole="button"
          accessibilityLabel="Allow camera access"
        >
          <Text style={styles.permissionBtnLabel}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsLink}
          onPress={() => void Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Open device settings"
        >
          <Text style={styles.settingsLinkLabel}>Open Settings</Text>
        </TouchableOpacity>
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
    <CameraSidewaysStage
      rotation={uiRotation}
      camera={({ width, height }) => (
        <>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isCameraActive}
            zoom={widestZoom}
            pixelFormat="rgb"
            frameProcessor={frameProcessor}
          />
          <PoseSkeletonOverlay
            landmarks={landmarks}
            width={width}
            height={height}
            mirrored
          />
        </>
      )}
      hud={({ rotation }) => {
        const compact = rotation !== 0;
        return (
          <>
            <View style={[hud.hudTop, compact ? hud.hudTopCompact : null]}>
              {!fullyInFrame || !trackingOk ? (
                <View style={[hud.warningCard, compact ? hud.warningCardCompact : null]}>
                  <Text
                    style={[hud.warningText, compact ? hud.warningTextCompact : null]}
                    numberOfLines={compact ? 1 : undefined}
                    adjustsFontSizeToFit={compact}
                    minimumFontScale={0.75}
                  >
                    {!fullyInFrame
                      ? frameMessage
                      : 'Reposition — keep joints in frame'}
                  </Text>
                </View>
              ) : SHOW_ANGLE_DEBUG ? (
                <View style={[hud.secondaryBadge, compact ? hud.secondaryBadgeCompact : null]}>
                  <Text style={hud.secondaryLabel}>Angle</Text>
                  <Text style={[hud.secondaryValue, compact ? hud.secondaryValueCompact : null]}>
                    {angle}°
                  </Text>
                  <Text
                    style={[hud.secondaryCaption, compact ? hud.secondaryCaptionCompact : null]}
                  >
                    {phase}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[hud.hudBottom, compact ? hud.hudBottomCompact : null]}>
              <Animated.View
                style={[
                  hud.metricBadge,
                  compact ? hud.metricBadgeCompact : null,
                  repBadgeAnimatedStyle,
                ]}
              >
                <Text style={[hud.metricLabel, compact ? hud.metricLabelCompact : null]}>
                  {targetReps ? 'Goal' : 'Reps'}
                </Text>
                <Animated.Text
                  style={[
                    hud.metricValue,
                    compact ? hud.metricValueCompact : null,
                    repValueAnimatedStyle,
                  ]}
                >
                  {targetReps ? `${repCount}/${targetReps}` : repCount}
                </Animated.Text>
              </Animated.View>
            </View>
          </>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#05070F',
    gap: 16,
  },
  message: {
    color: '#E8EDF7',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: '#22d3ee',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  permissionBtnLabel: {
    color: '#041016',
    fontWeight: '700',
    fontSize: 16,
  },
  settingsLink: {
    paddingVertical: 8,
  },
  settingsLinkLabel: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
});
