import { Fragment } from 'react';
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

interface PoseSkeletonOverlayProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  mirrored?: boolean;
}

export function PoseSkeletonOverlay({
  landmarks,
  width,
  height,
  mirrored = false,
}: PoseSkeletonOverlayProps) {
  if (!landmarks || landmarks.length === 0 || width <= 0 || height <= 0) {
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
    landmark: landmarks[index],
  })).filter(
    (entry): entry is { index: number; landmark: Landmark } =>
      !!entry.landmark && entry.landmark.visibility >= MIN_LANDMARK_VISIBILITY,
  );

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
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
        const a = landmarks[from];
        const b = landmarks[to];
        if (!a || !b) return null;
        if (a.visibility < MIN_LANDMARK_VISIBILITY || b.visibility < MIN_LANDMARK_VISIBILITY) {
          return null;
        }

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
              opacity={0.28}
            />
            <Line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="url(#ggBone)"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.92}
            />
          </Fragment>
        );
      })}

      {bodyLandmarks.map(({ index, landmark }) => {
        const cx = toX(landmark.x);
        const cy = toY(landmark.y);

        return (
          <Fragment key={`joint-${index}`}>
            <Circle cx={cx} cy={cy} r={9} fill={brand.violet} opacity={0.22} />
            <Circle
              cx={cx}
              cy={cy}
              r={6.5}
              stroke={brand.blueGlow}
              strokeWidth={1.5}
              fill="none"
              opacity={0.85}
            />
            <Circle cx={cx} cy={cy} r={4.5} fill="url(#ggJoint)" opacity={1} />
          </Fragment>
        );
      })}
    </Svg>
  );
}
