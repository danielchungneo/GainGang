import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { GlassSurface, ScreenBackground } from '@/components/ui';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { HUD_CONTENT_TOP_PAD } from '@/lib/app-hud';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

/** Placeholder shop — cosmetics for Creds. */
export default function ShopScreen() {
  const t = useThemeTokens();

  return (
    <ScreenBackground>
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: HUD_CONTENT_TOP_PAD,
          gap: spacing.md,
        }}
      >
        <Text style={[type.heading, { color: t.heading }]}>Shop</Text>
        <GlassSurface style={{ padding: spacing.lg, gap: spacing.sm }}>
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${t.accent}22`,
                borderWidth: 1,
                borderColor: `${t.accent}55`,
              }}
            >
              <Ionicons name="storefront" size={22} color={t.accent} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 17,
                  color: t.heading,
                }}
              >
                Coming soon
              </Text>
              <Text style={[type.bodySm, { color: t.body, lineHeight: 20 }]}>
                Spend Creds on titles, borders, banners, and more. The catalog is
                on the way.
              </Text>
            </View>
          </View>
        </GlassSurface>
      </View>
    </ScreenBackground>
  );
}
