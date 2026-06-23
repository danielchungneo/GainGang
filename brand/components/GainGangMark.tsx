/**
 * GainGangMark
 *
 * The standalone hexagonal glyph mark. Renders via react-native-svg.
 * Works at any size; the inner border ring auto-hides below 36px.
 *
 * Requirements:
 *   npx expo install react-native-svg
 */
import React from 'react';
import Svg, { Polygon, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export type GainGangMarkVariant = 'gradient' | 'white' | 'dark' | 'blue';

interface GainGangMarkProps {
  /** Rendered size in logical pixels. Default: 40 */
  size?: number;
  /**
   * Color variant:
   *   'gradient' — blue→violet gradient (default, use on dark surfaces)
   *   'white'    — white hex, dark chevron (monochrome on dark)
   *   'dark'     — dark hex, white chevron (monochrome on light)
   *   'blue'     — solid System Blue #4D8CFF
   */
  variant?: GainGangMarkVariant;
  /**
   * Show the inner hexagon border ring (adds depth at display sizes).
   * Defaults to true when size ≥ 36.
   */
  innerBorder?: boolean;
}

let _idCount = 0;

export const GainGangMark: React.FC<GainGangMarkProps> = ({
  size = 40,
  variant = 'gradient',
  innerBorder,
}) => {
  // Stable unique gradient ID per mounted instance
  const gradId = React.useRef(`ggMark_${++_idCount}`).current;
  const showBorder = innerBorder ?? size >= 36;

  const hexFill =
    variant === 'gradient' ? `url(#${gradId})`
    : variant === 'white'  ? 'rgba(255,255,255,0.92)'
    : variant === 'blue'   ? '#4D8CFF'
    : /* dark */              '#0D1426';

  const chevronFill = variant === 'white' ? '#05070F' : 'white';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {variant === 'gradient' && (
        <Defs>
          <LinearGradient id={gradId} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0%" stopColor="#4D8CFF" />
            <Stop offset="100%" stopColor="#9D4EDD" />
          </LinearGradient>
        </Defs>
      )}

      {/* Hexagon body */}
      <Polygon
        points="50,3 97,26 97,74 50,97 3,74 3,26"
        fill={hexFill}
      />

      {/* Inner border ring — depth detail at larger sizes */}
      {showBorder && (
        <Polygon
          points="50,8 92,28 92,72 50,92 8,72 8,28"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1.5}
        />
      )}

      {/* Upward chevron glyph */}
      <Path
        d="M 22,71 L 50,27 L 78,71 L 64,71 L 50,46 L 36,71 Z"
        fill={chevronFill}
      />
    </Svg>
  );
};
