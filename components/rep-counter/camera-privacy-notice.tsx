import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily } from '@/lib/gaingang-theme';

interface CameraPrivacyNoticeProps {
  /** Slightly larger copy for onboarding / full-screen contexts. */
  size?: 'default' | 'large';
}

/** Clear assurance that the camera stream is live-only — never recorded or stored. */
export function CameraPrivacyNotice({ size = 'default' }: CameraPrivacyNoticeProps) {
  const t = useThemeTokens();
  const isLarge = size === 'large';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Privacy notice: GainGang does not record or store video. The camera is only used live to confirm reps."
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: isLarge ? 14 : 12,
        paddingHorizontal: isLarge ? 14 : 12,
        borderRadius: 14,
        backgroundColor: `${t.accent}14`,
        borderWidth: 1,
        borderColor: `${t.accent}33`,
      }}
    >
      <View
        style={{
          width: isLarge ? 32 : 28,
          height: isLarge ? 32 : 28,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${t.accent}22`,
          marginTop: 1,
        }}
      >
        <Ionicons
          name="shield-checkmark"
          size={isLarge ? 18 : 16}
          color={t.accent}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: fontFamily.bodySemi,
            fontSize: isLarge ? 14 : 13,
            color: t.heading,
          }}
        >
          Nothing is recorded
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.body,
            fontSize: isLarge ? 13 : 12,
            lineHeight: isLarge ? 19 : 17,
            color: t.body,
          }}
        >
          GainGang only uses your camera live to confirm reps. No video is saved
          or uploaded anywhere.
        </Text>
      </View>
    </View>
  );
}
