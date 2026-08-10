import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { GangBanner } from '@/components/ui/gang-banner';
import {
  isWarDivision,
  WAR_DIVISION_BORDERS,
} from '@/lib/gang-wars/divisions';
import type { WarDivision } from '@/types';

interface GangBannerWithDivisionBorderProps {
  uri?: string | null;
  name?: string;
  division?: string | null;
  size?: number;
  /** 0→1 loop; when set, a highlight sweeps only across the division border ring. */
  shimmer?: SharedValue<number> | null;
}

/** Gang banner image framed by a division-colored border. */
export function GangBannerWithDivisionBorder({
  uri,
  name,
  division,
  size = 96,
  shimmer = null,
}: GangBannerWithDivisionBorderProps) {
  const div: WarDivision = isWarDivision(division) ? division : 'iron';
  const border = WAR_DIVISION_BORDERS[div];
  const outer = size + border.width * 2;

  const shimmerBandStyle = useAnimatedStyle(() => {
    if (!shimmer) return { opacity: 0 };
    const p = shimmer.value;
    return {
      opacity: interpolate(p, [0, 0.12, 0.45, 0.78, 1], [0, 0.85, 1, 0.55, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [-(outer + 24), outer + 28], Extrapolation.CLAMP) },
        { rotate: '-32deg' },
      ],
    };
  });

  return (
    <LinearGradient
      colors={border.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: outer,
        height: outer,
        borderRadius: 18,
        padding: border.width,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {shimmer ? (
        <Animated.View pointerEvents="none" style={[styles.shimmerBand, shimmerBandStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.2)',
              'rgba(255,255,255,0.95)',
              'rgba(255,255,255,0.2)',
              'transparent',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          zIndex: 1,
          backgroundColor: '#0a0a0a',
        }}
      >
        <GangBanner uri={uri} name={name} variant="thumb" size={size} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shimmerBand: {
    position: 'absolute',
    top: -28,
    width: 34,
    height: 220,
    zIndex: 0,
  },
});
