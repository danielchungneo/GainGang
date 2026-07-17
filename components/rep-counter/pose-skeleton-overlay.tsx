import { Fragment, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Stop,
} from 'react-native-svg';

import {
  BODY_LANDMARK_INDICES,
  MIN_LANDMARK_VISIBILITY,
  POSE_CONNECTIONS,
} from '@/lib/rep-counting/pose-landmarks';
import type { Landmark } from '@/lib/rep-counting/types';
import { brand } from '@/lib/gaingang-theme';

const FADE_IN_MS = 320;
const FADE_OUT_MS = 280;
/** Soft ramp around the hard visibility cutoff so joints ease instead of popping. */
const VIS_SOFT_START = MIN_LANDMARK_VISIBILITY - 0.18;
const VIS_SOFT_END = MIN_LANDMARK_VISIBILITY + 0.22;

interface PoseSkeletonOverlayProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  mirrored?: boolean;
}

function visibilityOpacity(visibility: number): number {
  if (visibility <= VIS_SOFT_START) return 0;
  if (visibility >= VIS_SOFT_END) return 1;
  return (visibility - VIS_SOFT_START) / (VIS_SOFT_END - VIS_SOFT_START);
}

export function PoseSkeletonOverlay({
  landmarks,
  width,
  height,
  mirrored = false,
}: PoseSkeletonOverlayProps) {
  const [displayLandmarks, setDisplayLandmarks] = useState<Landmark[] | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useSharedValue(0);

  const hasLivePose = !!landmarks && landmarks.length > 0;
  const canLayout = width > 0 && height > 0;

  // Keep the last pose frozen while fading out.
  useEffect(() => {
    if (hasLivePose) {
      setDisplayLandmarks(landmarks);
    }
  }, [hasLivePose, landmarks]);

  useEffect(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (hasLivePose && canLayout) {
      opacity.value = withTiming(1, {
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    opacity.value = withTiming(0, {
      duration: FADE_OUT_MS,
      easing: Easing.in(Easing.cubic),
    });
    hideTimeoutRef.current = setTimeout(() => {
      setDisplayLandmarks(null);
      hideTimeoutRef.current = null;
    }, FADE_OUT_MS);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [hasLivePose, canLayout, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!displayLandmarks || !canLayout) {
    return null;
  }

  function toX(x: number) {
    const normalized = mirrored ? 1 - x : x;
    return normalized * width;
  }

  function toY(y: number) {
    return y * height;
  }

  const bodyLandmarks = BODY_LANDMARK_INDICES.map((index) => ({
    index,
    landmark: displayLandmarks[index],
  })).filter(
    (entry): entry is { index: number; landmark: Landmark } =>
      !!entry.landmark && visibilityOpacity(entry.landmark.visibility) > 0,
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, fadeStyle]}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ggBone" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={brand.blue} stopOpacity="1" />
            <Stop offset="100%" stopColor={brand.violet} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="ggJoint" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={brand.blueGlow} stopOpacity="1" />
            <Stop offset="100%" stopColor={brand.violetGlow} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {POSE_CONNECTIONS.map(([from, to]) => {
          const a = displayLandmarks[from];
          const b = displayLandmarks[to];
          if (!a || !b) return null;

          const boneOpacity = Math.min(
            visibilityOpacity(a.visibility),
            visibilityOpacity(b.visibility),
          );
          if (boneOpacity <= 0) return null;

          const x1 = toX(a.x);
          const y1 = toY(a.y);
          const x2 = toX(b.x);
          const y2 = toY(b.y);

          return (
            <Fragment key={`bone-${from}-${to}`}>
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={brand.blueGlow}
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.28 * boneOpacity}
              />
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="url(#ggBone)"
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.92 * boneOpacity}
              />
            </Fragment>
          );
        })}

        {bodyLandmarks.map(({ index, landmark }) => {
          const cx = toX(landmark.x);
          const cy = toY(landmark.y);
          const jointOpacity = visibilityOpacity(landmark.visibility);

          return (
            <Fragment key={`joint-${index}`}>
              <Circle
                cx={cx}
                cy={cy}
                r={9}
                fill={brand.violet}
                opacity={0.22 * jointOpacity}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={6.5}
                stroke={brand.blueGlow}
                strokeWidth={1.5}
                fill="none"
                opacity={0.85 * jointOpacity}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={4.5}
                fill="url(#ggJoint)"
                opacity={jointOpacity}
              />
            </Fragment>
          );
        })}
      </Svg>
    </Animated.View>
  );
}
