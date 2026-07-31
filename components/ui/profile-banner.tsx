import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { gradientColors, parseBannerStyle } from '@/lib/cosmetics';
import type { Json } from '@/types/database';

interface ProfileBannerProps {
  styleJson?: Json | null;
  height?: number;
}

/** Gradient profile banner driven by a cosmetic style jsonb. */
export function ProfileBanner({ styleJson, height = 96 }: ProfileBannerProps) {
  const style = parseBannerStyle(styleJson ?? null);
  if (!style) return null;

  return (
    <View
      style={{
        height,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: -28,
      }}
    >
      <LinearGradient
        colors={gradientColors(style.colors)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}
