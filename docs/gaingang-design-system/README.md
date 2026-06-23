# GainGang Design System — React Native (Expo)

> _Calisthenics. Community. Quest._
> Solo Leveling's glowing "system-window" aesthetic over a grounded fitness app. Dark-first, blue→violet aura, monospace data, soft rounded cards. The E→S rank system is the hero.

A drop-in `theme/` + `components/` package — typed tokens, a light/dark theme hook, and the key components rebuilt as real React Native.

---

## 1. Install

Drop the `gaingang-rn/` folder into your repo (e.g. `src/gaingang-rn/`), then install peer deps:

```bash
npx expo install expo-linear-gradient react-native-svg expo-font
npx expo install @expo-google-fonts/chakra-petch \
  @expo-google-fonts/jetbrains-mono \
  @expo-google-fonts/hanken-grotesk
```

| Dependency | Used by |
|---|---|
| `expo-linear-gradient` | aura gradients (Button, QuestCard header, avatars, progress) |
| `react-native-svg` | hexagonal `RankBadge` |
| `expo-font` + `@expo-google-fonts/*` | Chakra Petch / JetBrains Mono / Hanken Grotesk |

---

## 2. Wire it up

```tsx
// App.tsx
import { GainGangProvider, useGainGangFonts } from './src/gaingang-rn';

export default function App() {
  const fontsLoaded = useGainGangFonts();
  if (!fontsLoaded) return null; // or your splash screen

  return (
    <GainGangProvider>           {/* dark-first by default */}
      <RootNavigator />
    </GainGangProvider>
  );
}
```

- `<GainGangProvider initialMode="light">` to start light.
- `<GainGangProvider followSystem>` to track the OS setting.
- Toggle at runtime: `const { toggle, mode } = useTheme();`

---

## 3. Use the tokens

Everything is a typed constant — no magic strings.

```tsx
import { useTheme, spacing, radius, type, ranks } from './src/gaingang-rn';

function Panel() {
  const { theme } = useTheme();
  return (
    <View style={{
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: radius.xl,
      padding: spacing.lg,
    }}>
      <Text style={[type.heading, { color: theme.colors.text }]}>The Iron Oath</Text>
      <Text style={[type.label, { color: ranks.C.glow }]}>C-RANK · HUNTER</Text>
    </View>
  );
}
```

**Token reference**

- `brand` — `blue` `#4D8CFF`, `violet` `#9D4EDD`, glows, deeps
- `ranks` / `rankOrder` — per-tier `color`, `glow`, `fill`, `name` for E D C B A S
- `spacing` — `xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48`
- `radius` — `sm 8 · md 11 · lg 14 · xl 18 · pill`
- `type` — presets: `display`, `heading`, `questTitle`, `rankLetter`, `label`, `data`, `body`…
- `fontFamily` — raw loaded font names
- `theme.colors` — `bg surface surface2 surface3 text textDim textMuted border borderGlow primary primaryGlow secondary secondaryGlow`
- `theme.aura` — the `[start, end]` gradient for the active mode

---

## 4. Components

```tsx
import {
  RankBadge, QuestCard, LeaderboardRow,
  Button, ProgressBar, XPBar,
  ReactionChip, StreakPill, RankChip,
} from './src/gaingang-rn';
```

```tsx
<RankBadge tier="S" size={88} showLabel />

<QuestCard
  kind="Daily Quest"
  title="The Iron Oath"
  description="200 push-ups as a Gang. 20 are yours."
  timeLeft="14h left"
  gang={{ current: 148, target: 200 }}
  individual={{ current: 20, target: 20 }}
  rewards={['+120 XP', '🎡 Reward Spin', '🛡 Streak +1']}
  onPressCta={() => log()}
/>

<LeaderboardRow position={1} name="Jinwoo K." initials="JK" reps={312} tier="B" completion={1} />
<LeaderboardRow position={3} name="You" initials="YOU" reps={240} tier="C" completion={0.86} isYou />

<XPBar level={12} fromTier="C" toTier="B" currentXp={2340} targetXp={3000} />

<Button label="LOG ACTIVITY" variant="primary" onPress={() => {}} />

<ReactionChip kind="fire" count={24} />
<StreakPill days={47} />
```

See `example/GangHomeScreen.tsx` for a full screen composed from these.

---

## 5. Notes & gotchas

- **Glows.** RN can't do CSS `box-shadow` spread. Colored glows use `shadowColor` + `shadowRadius` (crisp on iOS, approximated by `elevation` on Android — Android elevation shadows are neutral-colored). For pixel-matched glows on Android, wrap elements in `react-native-shadow-2` or a blurred `<Svg>` halo.
- **Hex badge.** The shape is `react-native-svg`; the surrounding glow is the parent View's shadow.
- **Fonts.** Names in `fontFamily` must match the loaded `@expo-google-fonts` exports exactly — don't rename.
- **Reactions/emoji** render with the system emoji font; that's intentional and on-brand here.
- This package is the **visual layer only** — no data, navigation, or auth. Feed it props from your own state.

---

_GainGang Design System v1.0 — Arise. ⚔_
