/**
 * Font loading helper. GainGang uses three Google fonts via @expo-google-fonts.
 *
 * Install:
 *   npx expo install expo-font \
 *     @expo-google-fonts/chakra-petch \
 *     @expo-google-fonts/jetbrains-mono \
 *     @expo-google-fonts/hanken-grotesk
 *
 * Usage in App.tsx:
 *
 *   import { useGainGangFonts } from './gaingang-rn/theme/fonts';
 *   const fontsLoaded = useGainGangFonts();
 *   if (!fontsLoaded) return null; // or <SplashScreen/>
 */
import { useFonts } from 'expo-font';
import { ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';

export function useGainGangFonts(): boolean {
  const [loaded] = useFonts({
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });
  return loaded;
}
