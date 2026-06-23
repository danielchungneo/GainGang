/**
 * ScreenBackground — the GainGang screen shell.
 *
 * Renders the theme canvas with a "system window" HUD treatment:
 *   - diagonal blue→violet aura wash
 *   - faint quest-board grid
 *   - corner bracket accents
 *   - top system beam glow
 *
 * Uses react-native-svg only (no expo-linear-gradient) so the shell
 * works in every runtime without a native gradient adapter.
 */
import { useId } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewProps,
} from "react-native";
import Svg, {
  Defs,
  Line,
  Pattern,
  Rect,
  Stop,
  LinearGradient as SvgGradient,
} from "react-native-svg";

import { useTheme } from "@/lib/gaingang-theme";

const GRID_SIZE = 48;
const BRACKET_SIZE = 28;
const BRACKET_INSET = 20;

interface BackgroundDecorProps {
  width: number;
  height: number;
  isLight: boolean;
  auraId: string;
  beamId: string;
  patternId: string;
}

function BackgroundDecor({
  width,
  height,
  isLight,
  auraId,
  beamId,
  patternId,
}: BackgroundDecorProps) {
  const beamHeight = height * 0.42;
  const inset = BRACKET_INSET;
  const arm = BRACKET_SIZE;
  const strokeW = 1.5;

  const gridStroke = isLight
    ? "rgba(47,109,255,0.06)"
    : "rgba(77,140,255,0.07)";
  const bracketColor = isLight
    ? "rgba(47,109,255,0.28)"
    : "rgba(77,140,255,0.38)";

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <SvgGradient id={auraId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop
            offset="0%"
            stopColor={isLight ? "#2F6DFF" : "#4D8CFF"}
            stopOpacity={isLight ? 0.1 : 0.14}
          />
          <Stop offset="45%" stopColor={isLight ? "#2F6DFF" : "#4D8CFF"} stopOpacity={0} />
          <Stop
            offset="100%"
            stopColor={isLight ? "#7B2FDE" : "#9D4EDD"}
            stopOpacity={isLight ? 0.08 : 0.1}
          />
        </SvgGradient>

        <SvgGradient id={beamId} x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop
            offset="0%"
            stopColor={isLight ? "#2F6DFF" : "#4D8CFF"}
            stopOpacity={isLight ? 0.16 : 0.2}
          />
          <Stop offset="100%" stopColor={isLight ? "#2F6DFF" : "#4D8CFF"} stopOpacity={0} />
        </SvgGradient>

        <Pattern
          id={patternId}
          width={GRID_SIZE}
          height={GRID_SIZE}
          patternUnits="userSpaceOnUse"
        >
          <Line
            x1={0}
            y1={GRID_SIZE}
            x2={GRID_SIZE}
            y2={GRID_SIZE}
            stroke={gridStroke}
            strokeWidth={0.5}
          />
          <Line
            x1={GRID_SIZE}
            y1={0}
            x2={GRID_SIZE}
            y2={GRID_SIZE}
            stroke={gridStroke}
            strokeWidth={0.5}
          />
        </Pattern>
      </Defs>

      <Rect width={width} height={height} fill={`url(#${auraId})`} />
      <Rect width={width} height={beamHeight} fill={`url(#${beamId})`} />
      <Rect width={width} height={height} fill={`url(#${patternId})`} />

      {/* <Line
        x1={inset}
        y1={inset + arm}
        x2={inset}
        y2={inset}
        stroke={bracketColor}
        strokeWidth={strokeW}
      />
      <Line
        x1={inset}
        y1={inset}
        x2={inset + arm}
        y2={inset}
        stroke={bracketColor}
        strokeWidth={strokeW}
      />
      <Line
        x1={width - inset - arm}
        y1={inset}
        x2={width - inset}
        y2={inset}
        stroke={bracketColor}
        strokeWidth={strokeW}
      />
      <Line
        x1={width - inset}
        y1={inset}
        x2={width - inset}
        y2={inset + arm}
        stroke={bracketColor}
        strokeWidth={strokeW}
      />
      <Line
        x1={inset}
        y1={height - inset - arm}
        x2={inset}
        y2={height - inset}
        stroke={bracketColor}
        strokeWidth={strokeW}
      />
      <Line
        x1={inset}
        y1={height - inset}
        x2={inset + arm}
        y2={height - inset}
        stroke={bracketColor}
        strokeWidth={strokeW}
      />
      <Line
        x1={width - inset - arm}
        y1={height - inset}
        x2={width - inset}
        y2={height - inset}
        stroke={bracketColor}
        strokeWidth={strokeW}
      />
      <Line
        x1={width - inset}
        y1={height - inset - arm}
        x2={width - inset}
        y2={height - inset}
        stroke={bracketColor}
        strokeWidth={strokeW}
      /> */}
    </Svg>
  );
}

export function ScreenBackground({ children, style, ...props }: ViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isLight = theme.mode === "light";
  const { width, height } = useWindowDimensions();
  const uid = useId().replace(/:/g, "");
  const auraId = `gg-aura-${uid}`;
  const beamId = `gg-beam-${uid}`;
  const patternId = `gg-grid-${uid}`;

  return (
    <View
      className="flex-1"
      style={[{ backgroundColor: c.bg }, style]}
      {...props}
    >
      <BackgroundDecor
        width={width}
        height={height}
        isLight={isLight}
        auraId={auraId}
        beamId={beamId}
        patternId={patternId}
      />

      {children}
    </View>
  );
}
