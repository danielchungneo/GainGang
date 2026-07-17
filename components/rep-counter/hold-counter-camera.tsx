import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
import { createHoldCounter } from '@/lib/rep-counting/hold-counter';
import { iosPoseLandmarkerPlugin } from '@/lib/rep-counting/ios-pose-plugin';
import {
  remapLandmarksForUiRotation,
  type CameraUiRotation,
} from '@/lib/rep-counting/landmark-orientation';
import { normalizePoseLandmarks } from '@/lib/rep-counting/normalize-pose-landmarks';
import type { HoldCounterSnapshot, HoldPhase, Landmark } from '@/lib/rep-counting/types';

const BRIDGE_INTERVAL_MS = 66;

interface HoldCounterCameraProps {
  targetSeconds?: number;
  /** Resume from a previous hold when returning from review. */
  initialElapsedSeconds?: number;
  onElapsedChange?: (seconds: number) => void;
  onSnapshot?: (snapshot: HoldCounterSnapshot) => void;
  /** Header-controlled UI tip rotation for sideways filming. */
  uiRotation?: CameraUiRotation;
}

function formatHoldTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function HoldCounterCamera({
  targetSeconds,
  initialElapsedSeconds = 0,
  onElapsedChange,
  onSnapshot,
  uiRotation = 0,
}: HoldCounterCameraProps) {
  const device = useCameraDevice('front', {
    physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
  });
  const { hasPermission, requestPermission } = useCameraPermission();
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [trackingOk, setTrackingOk] = useState(false);
  const [fullyInFrame, setFullyInFrame] = useState(false);
  const [frameMessage, setFrameMessage] = useState('Get into plank position');
  const [phase, setPhase] = useState<HoldPhase>('waiting');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(true);

  const holdCounterRef = useRef(createHoldCounter('plank'));
  const lastElapsedRef = useRef(0);
  const lastCountdownRef = useRef(0);
  const lastPhaseRef = useRef<HoldPhase>('waiting');
  const lastBridgeAtRef = useRef(0);
  const uiRotationRef = useRef<CameraUiRotation>(uiRotation);
  uiRotationRef.current = uiRotation;
  const tickFlash = useSharedValue(0);
  const hasTarget = typeof targetSeconds === 'number' && targetSeconds > 0;

  const timeBadgeAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      tickFlash.value,
      [0, 1],
      [cameraHud.surface, cameraHud.flashBg],
    ),
    borderColor: interpolateColor(
      tickFlash.value,
      [0, 1],
      [cameraHud.border, cameraHud.flashBorder],
    ),
    transform: [{ scale: 1 + tickFlash.value * 0.06 }],
  }));

  useEffect(() => {
    setIsCameraActive(false);
    const timer = setTimeout(() => setIsCameraActive(true), 50);
    return () => clearTimeout(timer);
  }, [uiRotation]);

  useEffect(() => {
    const counter = createHoldCounter('plank');
    const seed = initialElapsedSeconds;
    if (seed > 0) {
      counter.seedElapsedSeconds(seed);
    }
    holdCounterRef.current = counter;
    lastElapsedRef.current = seed;
    lastCountdownRef.current = 0;
    lastPhaseRef.current = 'waiting';
    setElapsedSeconds(seed);
    setCountdownRemaining(0);
    setPhase('waiting');
    setLandmarks(null);
    setTrackingOk(false);
    setFullyInFrame(false);
    setFrameMessage(seed > 0 ? 'Get back into plank to continue' : 'Get into plank position');
    // Seed only on mount (e.g. "Keep going" from review). Do not re-run when elapsed ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only seed
  }, []);

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
      const snapshot = holdCounterRef.current.processFrame(forCounting);
      setLandmarks(normalized);
      setTrackingOk(snapshot.trackingOk);
      setFullyInFrame(snapshot.fullyInFrame);
      setFrameMessage(snapshot.frameMessage);
      setPhase(snapshot.phase);
      setElapsedSeconds(snapshot.elapsedSeconds);
      setCountdownRemaining(snapshot.countdownRemaining);
      onSnapshot?.(snapshot);

      if (snapshot.countdownRemaining !== lastCountdownRef.current) {
        if (snapshot.phase === 'countdown' && snapshot.countdownRemaining > 0) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        lastCountdownRef.current = snapshot.countdownRemaining;
      }

      if (snapshot.phase === 'holding' && lastPhaseRef.current !== 'holding') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      lastPhaseRef.current = snapshot.phase;

      if (snapshot.elapsedSeconds > lastElapsedRef.current) {
        lastElapsedRef.current = snapshot.elapsedSeconds;
        tickFlash.value = 0;
        tickFlash.value = withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(0, { duration: 280 }),
        );
        if (hasTarget && snapshot.elapsedSeconds === targetSeconds) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          void Haptics.selectionAsync();
        }
        onElapsedChange?.(snapshot.elapsedSeconds);
      }
    },
    [hasTarget, onElapsedChange, onSnapshot, targetSeconds, tickFlash],
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
          setFrameMessage('Get into plank position');
          return;
        }

        handlePoseResult(result.pose);
      }),
    [handlePoseResult],
  );

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
        <Text style={styles.message}>Camera permission is required to time your hold.</Text>
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

  const widestZoom = device.minZoom;
  const showWarning = phase === 'waiting' || phase === 'paused' || !fullyInFrame || !trackingOk;
  const targetMet = hasTarget && elapsedSeconds >= targetSeconds!;

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
              <Animated.View
                style={[
                  hud.metricBadge,
                  compact ? hud.metricBadgeCompact : null,
                  timeBadgeAnimatedStyle,
                ]}
              >
                <Text style={[hud.metricLabel, compact ? hud.metricLabelCompact : null]}>
                  Hold
                </Text>
                <Text
                  style={[
                    hud.metricValue,
                    compact ? hud.metricValueCompact : null,
                    targetMet ? { color: cameraHud.success } : null,
                  ]}
                >
                  {formatHoldTime(elapsedSeconds)}
                </Text>
                {hasTarget ? (
                  <Text style={[hud.metricSub, compact ? hud.metricSubCompact : null]}>
                    / {formatHoldTime(targetSeconds!)}
                  </Text>
                ) : null}
              </Animated.View>
            </View>

            <View style={[hud.hudBottom, compact ? hud.hudBottomCompact : null]}>
              {phase === 'countdown' ? (
                <View style={[hud.countdownBadge, compact ? hud.countdownBadgeCompact : null]}>
                  <Text
                    style={[hud.countdownValue, compact ? hud.countdownValueCompact : null]}
                  >
                    {countdownRemaining}
                  </Text>
                  <Text
                    style={[hud.countdownLabel, compact ? hud.countdownLabelCompact : null]}
                  >
                    Get ready
                  </Text>
                </View>
              ) : phase === 'resuming' ? (
                <View style={[hud.statusCard, compact ? hud.statusCardCompact : null]}>
                  <Text style={[hud.statusText, compact ? hud.statusTextCompact : null]}>
                    {frameMessage || `Hold steady — restarting in ${countdownRemaining}s`}
                  </Text>
                </View>
              ) : showWarning ? (
                <View style={[hud.warningCard, compact ? hud.warningCardCompact : null]}>
                  <Text
                    style={[hud.warningText, compact ? hud.warningTextCompact : null]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {frameMessage || (phase === 'paused' ? 'Resume your plank' : 'Get into plank')}
                  </Text>
                </View>
              ) : (
                <View style={[hud.statusCard, compact ? hud.statusCardCompact : null]}>
                  <Text style={[hud.statusText, compact ? hud.statusTextCompact : null]}>
                    {targetMet ? 'Target reached — keep holding or finish' : 'Holding — stay steady'}
                  </Text>
                </View>
              )}
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
  },
  message: {
    color: '#E8EDF7',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
});
