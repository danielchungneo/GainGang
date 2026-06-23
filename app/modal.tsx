import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { DarkGlass, Glass } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Reusable modal route kept from the boilerplate as a starting pattern.
// TODO: Repurpose this for a real GainGang flow (e.g. create group, set daily
// goal, or send encouragement) — or remove it and its <Stack.Screen name="modal" />
// registration in app/_layout.tsx if you don't need a modal yet.

export default function ModalScreen() {
  const isLight = useColorScheme() !== 'dark';
  const heading = isLight ? Glass.textPrimary : DarkGlass.textPrimary;
  const body = isLight ? Glass.textSecondary : DarkGlass.textSecondary;
  const accent = isLight ? '#0284c7' : DarkGlass.neonCyan;

  return (
    <ScreenBackground>
      <View className="flex-1 justify-center px-5">
        <GlassSurface style={{ padding: 24, gap: 12 }}>
          <Text style={{ color: heading }} className="text-2xl font-bold">
            Modal
          </Text>
          <Text style={{ color: body }} className="text-sm leading-5">
            A reusable modal screen. Build your GainGang flow here.
          </Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-2">
            <Text style={{ color: accent }} className="font-semibold">
              Close
            </Text>
          </TouchableOpacity>
        </GlassSurface>
      </View>
    </ScreenBackground>
  );
}
