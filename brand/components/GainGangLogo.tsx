/**
 * GainGangLogo
 *
 * Full combination mark: hexagonal glyph + GAIN GANG wordmark.
 * Optionally shows the tagline "CALISTHENICS · COMMUNITY" below.
 *
 * Requirements:
 *   npx expo install react-native-svg
 *   @expo-google-fonts/chakra-petch   (ChakraPetch_700Bold loaded in root layout)
 *   @expo-google-fonts/jetbrains-mono (JetBrainsMono_400Regular)
 *
 * Note on gradient text:
 *   The "GANG" half of the wordmark ideally uses a blue→violet gradient.
 *   This component defaults to solid violet (#C77DFF / #7B2FDE) for
 *   zero-dependency usage. See README for the full MaskedView + LinearGradient
 *   gradient text implementation.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography } from '@/brand/constants/brand';
import { GainGangMark } from './GainGangMark';

export type LogoSize  = 'xs' | 'sm' | 'md' | 'lg';
export type LogoTheme = 'dark' | 'light';

interface GainGangLogoProps {
  /**
   * Preset size:
   *   'xs' — tiny / tab bar  (icon 20, wordmark 13px)
   *   'sm' — nav bar header  (icon 28, wordmark 17px)
   *   'md' — card / moderate (icon 40, wordmark 26px)
   *   'lg' — hero / splash   (icon 72, wordmark 46px)
   */
  size?: LogoSize;
  /** 'dark' = white wordmark (default) · 'light' = dark navy wordmark */
  theme?: LogoTheme;
  /** Render "CALISTHENICS · COMMUNITY" tagline below wordmark */
  showTagline?: boolean;
  /** Extra style on the outer container */
  style?: ViewStyle;
}

const SizeMap: Record<LogoSize, {
  icon: number;
  fontSize: number;
  gap: number;
  tagSize: number;
  letterSpacing: number;
}> = {
  xs: { icon: 20, fontSize: 13, gap: 6,  tagSize: 7,  letterSpacing: -0.3 },
  sm: { icon: 28, fontSize: 17, gap: 9,  tagSize: 8,  letterSpacing: -0.3 },
  md: { icon: 40, fontSize: 26, gap: 12, tagSize: 10, letterSpacing: -0.5 },
  lg: { icon: 72, fontSize: 46, gap: 18, tagSize: 11, letterSpacing: -0.8 },
};

export const GainGangLogo: React.FC<GainGangLogoProps> = ({
  size    = 'md',
  theme   = 'dark',
  showTagline = false,
  style,
}) => {
  const { icon, fontSize, gap, tagSize, letterSpacing } = SizeMap[size];
  const isDark = theme === 'dark';

  const gainColor = isDark ? '#FFFFFF' : Colors.textDark;
  // Solid violet fallback — swap for GradientText wrapper if MaskedView is available
  const gangColor = isDark ? Colors.auraViolet : '#7B2FDE';

  return (
    <View style={[styles.container, { gap }, style]}>
      <GainGangMark size={icon} variant="gradient" />

      <View>
        <Text
          style={[styles.wordmark, { fontSize, letterSpacing }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          <Text style={{ color: gainColor }}>{'GAIN '}</Text>
          <Text style={{ color: gangColor }}>GANG</Text>
        </Text>

        {showTagline && (
          <Text
            style={[styles.tagline, { fontSize: tagSize, color: Colors.systemBlue }]}
            allowFontScaling={false}
          >
            CALISTHENICS · COMMUNITY
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: Typography.display700,
    lineHeight: undefined,
  },
  tagline: {
    fontFamily: Typography.mono400,
    letterSpacing: 2.8,
    marginTop: 4,
    textTransform: 'uppercase',
    opacity: 0.72,
  },
});
