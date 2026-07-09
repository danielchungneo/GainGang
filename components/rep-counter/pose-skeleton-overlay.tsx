import Svg, { Circle, Line } from 'react-native-svg';

import { BODY_LANDMARK_INDICES, MIN_LANDMARK_VISIBILITY, POSE_CONNECTIONS } from '@/lib/rep-counting/pose-landmarks';
import type { Landmark } from '@/lib/rep-counting/types';

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

  const bodyLandmarks = BODY_LANDMARK_INDICES.map((index) => landmarks[index]).filter(
    (landmark): landmark is Landmark =>
      !!landmark && landmark.visibility >= MIN_LANDMARK_VISIBILITY,
  );

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      {POSE_CONNECTIONS.map(([from, to]) => {
        const a = landmarks[from];
        const b = landmarks[to];
        if (!a || !b) return null;
        if (a.visibility < MIN_LANDMARK_VISIBILITY || b.visibility < MIN_LANDMARK_VISIBILITY) {
          return null;
        }

        return (
          <Line
            key={`${from}-${to}`}
            x1={toX(a.x)}
            y1={toY(a.y)}
            x2={toX(b.x)}
            y2={toY(b.y)}
            stroke="#22d3ee"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}

      {bodyLandmarks.map((landmark, index) => (
        <Circle
          key={`joint-${index}`}
          cx={toX(landmark.x)}
          cy={toY(landmark.y)}
          r={5}
          fill="#fbbf24"
          opacity={0.95}
        />
      ))}
    </Svg>
  );
}
