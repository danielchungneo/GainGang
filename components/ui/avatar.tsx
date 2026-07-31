import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  gradientColors,
  parseBorderStyle,
  type CosmeticBorderStyle,
} from '@/lib/cosmetics';
import { initials } from '@/lib/format';
import type { Json } from '@/types/database';

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  /** Raw cosmetic style jsonb, or a parsed border style. */
  borderStyle?: Json | CosmeticBorderStyle | null;
}

function resolveBorder(
  borderStyle?: Json | CosmeticBorderStyle | null,
): CosmeticBorderStyle | null {
  if (!borderStyle) return null;
  if (
    typeof borderStyle === 'object' &&
    !Array.isArray(borderStyle) &&
    'colors' in borderStyle &&
    Array.isArray((borderStyle as CosmeticBorderStyle).colors)
  ) {
    const colors = (borderStyle as CosmeticBorderStyle).colors;
    if (colors.length > 0 && typeof colors[0] === 'string') {
      return borderStyle as CosmeticBorderStyle;
    }
  }
  return parseBorderStyle(borderStyle as Json);
}

export function Avatar({ name, uri, size = 44, borderStyle }: AvatarProps) {
  const { isLight, accent } = useThemeTokens();
  const radius = size / 2;
  const border = resolveBorder(borderStyle);
  const ringWidth = border?.width ?? 0;
  const outerSize = border ? size + ringWidth * 2 : size;
  const outerRadius = outerSize / 2;

  const inner = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      transition={150}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: isLight
          ? 'rgba(2,132,199,0.12)'
          : 'rgba(0,212,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: accent, fontWeight: '700', fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );

  if (!border) return inner;

  return (
    <LinearGradient
      colors={gradientColors(border.colors)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerRadius,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: border.glow ?? border.colors[0],
        shadowOpacity: 0.55,
        shadowRadius: size * 0.18,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: isLight ? '#fff' : '#0B1220',
        }}
      >
        {inner}
      </View>
    </LinearGradient>
  );
}
