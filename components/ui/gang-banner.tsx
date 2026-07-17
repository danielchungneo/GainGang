import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, type } from '@/lib/gaingang-theme';

interface GangBannerProps {
  uri?: string | null;
  name?: string;
  /** `preview` = edit/create form; `thumb` = list/switcher tile. */
  variant?: 'preview' | 'thumb';
  size?: number;
  isUploading?: boolean;
  showCameraBadge?: boolean;
}

export function GangBanner({
  uri,
  name,
  variant = 'preview',
  size,
  isUploading = false,
  showCameraBadge = false,
}: GangBannerProps) {
  const t = useThemeTokens();
  const isThumb = variant === 'thumb';
  const boxSize = size ?? (isThumb ? 48 : 140);
  const radius = isThumb ? 12 : 20;

  const image = uri ? (
    <Image
      source={{ uri }}
      style={{ width: boxSize, height: boxSize, borderRadius: radius }}
      contentFit="cover"
      transition={150}
    />
  ) : (
    <View
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: radius,
        backgroundColor: t.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: isThumb ? 0 : 1,
        borderColor: t.buttonBorder,
      }}
    >
      <Ionicons
        name={isThumb ? 'people' : 'image-outline'}
        size={isThumb ? 22 : 36}
        color={t.accentOnPrimary}
      />
    </View>
  );

  if (isThumb) return image;

  return (
    <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
      <View style={{ width: boxSize, height: boxSize }}>
        {image}
        {showCameraBadge ? (
          <View
            style={[
              styles.cameraBadge,
              {
                backgroundColor: t.accent,
                borderColor: t.buttonBg,
              },
            ]}
          >
            {isUploading ? (
              <ActivityIndicator color={t.accentOnPrimary} size="small" />
            ) : (
              <Ionicons name="camera" size={16} color={t.accentOnPrimary} />
            )}
          </View>
        ) : null}
        {isUploading && !showCameraBadge ? (
          <View style={[styles.uploadingOverlay, { borderRadius: radius }]}>
            <ActivityIndicator color={t.accentOnPrimary} />
          </View>
        ) : null}
      </View>

      {showCameraBadge ? (
        <Text
          style={{
            color: t.accent,
            fontFamily: fontFamily.bodySemi,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {isUploading ? 'Uploading…' : uri ? 'Change banner' : 'Upload banner'}
        </Text>
      ) : null}

      {!uri && !showCameraBadge && name ? (
        <Text style={[type.bodySm, { color: t.body, textAlign: 'center' }]}>
          Banner for {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
