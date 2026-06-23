# GainGang — Brand Assets for Expo React Native

Ready-to-integrate brand package: SVG/PNG assets, React Native components, and design tokens.

---

## What's included

```
gaingang-brand/
├── README.md
├── app.json-snippet.json          ← merge into your app.json / app.config.ts
├── assets/
│   ├── icon.svg                   ← vector source (authoritative)
│   ├── icon.png                   ← 1024×1024 app icon
│   ├── adaptive-icon.png          ← 1024×1024 Android adaptive (transparent bg)
│   ├── splash.png                 ← 2048×2048 splash screen
│   └── favicon.png                ← 32×32 web favicon
└── brand/
    ├── components/
    │   ├── GainGangMark.tsx       ← SVG hex glyph (react-native-svg)
    │   ├── GainGangLogo.tsx       ← Full combination mark
    │   └── index.ts
    └── constants/
        └── brand.ts               ← Colors, Gradients, Typography, Spacing, Radius
```

Copy `brand/` → `your-project/src/brand/`
Copy `assets/` → `your-project/assets/gaingang/`

---

## Installation

```bash
# Required
npx expo install react-native-svg
npx expo install expo-font
npx expo install expo-linear-gradient

# Fonts (Google Fonts via Expo)
npx expo install @expo-google-fonts/chakra-petch
npx expo install @expo-google-fonts/jetbrains-mono
npx expo install @expo-google-fonts/hanken-grotesk

# Optional — gradient text (GANG wordmark) + Android glow
npx expo install @react-native-masked-view/masked-view
```

---

## Font setup

In `app/_layout.tsx` (Expo Router) or `App.tsx`:

```tsx
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { ChakraPetch_700Bold, ChakraPetch_600SemiBold, ChakraPetch_400Regular } from '@expo-google-fonts/chakra-petch';
import { JetBrainsMono_700Bold, JetBrainsMono_500Medium, JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { HankenGrotesk_700Bold, HankenGrotesk_600SemiBold, HankenGrotesk_500Medium, HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ChakraPetch_700Bold, ChakraPetch_600SemiBold, ChakraPetch_400Regular,
    JetBrainsMono_700Bold, JetBrainsMono_500Medium, JetBrainsMono_400Regular,
    HankenGrotesk_700Bold, HankenGrotesk_600SemiBold, HankenGrotesk_500Medium, HankenGrotesk_400Regular,
  });

  React.useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  return <Slot />;
}
```

---

## app.json

```json
{
  "expo": {
    "icon": "./assets/gaingang/icon.png",
    "splash": {
      "image": "./assets/gaingang/splash.png",
      "backgroundColor": "#05070F",
      "resizeMode": "contain"
    },
    "ios": { "icon": "./assets/gaingang/icon.png" },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/gaingang/adaptive-icon.png",
        "backgroundColor": "#0E1524"
      }
    },
    "web": { "favicon": "./assets/gaingang/favicon.png" }
  }
}
```

---

## Component usage

### GainGangMark — icon only

```tsx
import { GainGangMark } from 'src/brand/components';

<GainGangMark size={40} />                      // gradient (default)
<GainGangMark size={40} variant="white" />      // white hex, dark chevron
<GainGangMark size={40} variant="dark" />       // dark hex, white chevron
<GainGangMark size={40} variant="blue" />       // solid System Blue
<GainGangMark size={24} innerBorder={false} />  // force no inner ring
```

### GainGangLogo — combination mark

```tsx
import { GainGangLogo } from 'src/brand/components';

<GainGangLogo size="xs" />                         // tab bars (icon 20, text 13)
<GainGangLogo size="sm" theme="dark" />            // nav bar  (icon 28, text 17)
<GainGangLogo size="md" theme="dark" />            // cards    (icon 40, text 26)
<GainGangLogo size="lg" theme="dark" showTagline/> // hero     (icon 72, text 46)
<GainGangLogo size="md" theme="light" />           // light bg
```

---

## Brand tokens

```tsx
import { Colors, Gradients, Typography, Spacing, Radius, RankColors } from 'src/brand/constants/brand';

// Surfaces
Colors.void       // #05070F — root bg
Colors.surface1   // #0E1524 — cards, nav
Colors.surface2   // #131C30 — elevated cards

// Brand
Colors.systemBlue   // #4D8CFF
Colors.questViolet  // #9D4EDD

// Rank tiers (E → S)
RankColors.E  // #64748B  grey
RankColors.D  // #2DD4BF  teal
RankColors.C  // #4D8CFF  blue
RankColors.B  // #9D4EDD  violet
RankColors.A  // #F5A524  gold
RankColors.S  // #FF3D71  crimson

// Gradients → pass directly to expo-linear-gradient
import { LinearGradient } from 'expo-linear-gradient';
<LinearGradient colors={Gradients.brand} start={{x:0.1,y:0}} end={{x:0.9,y:1}} />

// Typography
Typography.display700  // 'ChakraPetch_700Bold'   — titles, rank, wordmark
Typography.mono400     // 'JetBrainsMono_400Regular' — labels, stats, tags
Typography.body400     // 'HankenGrotesk_400Regular' — body copy
```

---

## Gradient text (GANG wordmark)

Components use solid violet as a safe default. For true gradient text:

```tsx
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';

export const GradientText = ({ children, style }) => (
  <MaskedView maskElement={<Text style={style}>{children}</Text>}>
    <LinearGradient colors={['#8FB4FF', '#C77DFF']} start={{x:0,y:0}} end={{x:1,y:0}}>
      <Text style={[style, { opacity: 0 }]}>{children}</Text>
    </LinearGradient>
  </MaskedView>
);
```

---

## Glow effects

```tsx
// iOS — native shadow
const glowBlue = {
  shadowColor: '#4D8CFF',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.65,
  shadowRadius: 12,
};

// Android + iOS — react-native-shadow-2
import { Shadow } from 'react-native-shadow-2';
<Shadow distance={12} startColor="rgba(77,140,255,0.5)" offset={[0,0]}>
  <GainGangMark size={40} />
</Shadow>
```

---

## AI integration prompt

Paste this when prompting Claude, Cursor, or Copilot to build new screens:

> I'm building **GainGang**, a social calisthenics app with a Solo Leveling RPG aesthetic.
> Brand assets live in `src/brand/`. Rules:
> 1. **Colors** — never hardcode hex; always use `Colors.*` from `brand.ts`.
> 2. **Logo** — use `GainGangMark` (icon only) or `GainGangLogo` (combination mark).
> 3. **Fonts** — Chakra Petch (`Typography.display*`) for titles/rank/buttons; JetBrains Mono (`Typography.mono*`) for labels, stats, system tags; Hanken Grotesk (`Typography.body*`) for body copy.
> 4. **Theme** — dark-first: root bg = `Colors.void`, cards = `Colors.surface1`.
> 5. **Ranks** — hexagonal badge shapes, colors escalate E→D→C→B→A→S via `RankColors[tier]`.
> 6. **Buttons** — primary CTA uses `Gradients.brand` with `expo-linear-gradient`; XP bars use `Gradients.xp`.
> 7. **Glow** — on dark surfaces, rank badges and the logo mark get `shadowColor: Colors.systemBlue, shadowRadius: 12, shadowOpacity: 0.65` (iOS) or `react-native-shadow-2` (Android).
> 8. **Borders** — `Colors.borderSubtle` by default; `Colors.borderMedium` for emphasis.
