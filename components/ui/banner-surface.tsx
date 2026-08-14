import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { gradientColors, parseBannerStyle } from '@/lib/cosmetics';
import { useTheme } from '@/lib/gaingang-theme';
import type { Json } from '@/types/database';

interface BannerSurfaceProps extends ViewProps {
  /** Equipped banner cosmetic `style` jsonb. When null, falls back to GlassSurface. */
  bannerStyle?: Json | null;
  style?: StyleProp<ViewStyle>;
  /** Darken the gradient so light text stays readable. */
  scrimOpacity?: number;
}

/**
 * Card surface that paints an equipped profile banner as the background.
 * Without a banner, matches GlassSurface.
 */
export function BannerSurface({
  bannerStyle,
  style,
  scrimOpacity,
  children,
  ...props
}: BannerSurfaceProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.mode === 'dark';
  const banner = parseBannerStyle(bannerStyle ?? null);
  const resolvedScrim = scrimOpacity ?? (isDark ? 0.38 : 0.52);

  if (!banner) {
    return (
      <GlassSurface style={style} {...props}>
        {children}
      </GlassSurface>
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: isDark ? 1 : StyleSheet.hairlineWidth,
          borderColor: c.borderGlow,
          shadowColor: c.primary,
          shadowOffset: { width: 0, height: isDark ? 6 : 8 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: isDark ? 20 : 24,
          elevation: isDark ? 8 : 6,
        },
        style,
      ]}
      {...props}
    >
      <LinearGradient
        colors={gradientColors(banner.colors)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(5,7,15,${resolvedScrim})` },
        ]}
      />
      {children}
    </View>
  );
}
