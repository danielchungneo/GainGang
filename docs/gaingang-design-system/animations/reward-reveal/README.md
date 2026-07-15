# Reward Reveal

An animated **reward-reveal overlay** for React Native, built for GainGang's Solo-Leveling "system window" aesthetic.

You *open a sealed rune-sigil*: it charges up (runes spin, charge particles pulled inward, cracks of light), then **bursts in a white flash** — and the reward is revealed emerging from the flash: a banner image, title, and a cascade of reward rows, capped with a pulsing CLAIM button.

Everything is data-driven, so one component covers any reward you hand out.

```
charge (sigil) ─▶ flash ─▶ reveal (banner + title + rows + claim)
```

---

## Install

Copy the `reward-reveal/` folder into your project (e.g. `src/components/reward-reveal/`).

It has one peer dependency — [Reanimated 3](https://docs.swmansion.com/react-native-reanimated/):

```bash
npm install react-native-reanimated
# then follow Reanimated's setup: add the Babel plugin (must be LAST in plugins)
# babel.config.js → plugins: ['react-native-reanimated/plugin']
```

The GainGang fonts are referenced by their `@expo-google-fonts` names
(`ChakraPetch_700Bold`, `JetBrainsMono_500Medium`, `HankenGrotesk_500Medium`).
Load them in your root layout, or search-and-replace the font constants at the
bottom of `RewardReveal.tsx` with whatever you already have loaded.

---

## Usage

```tsx
import { RewardReveal } from './components/reward-reveal/src';

function Screen() {
  const [show, setShow] = useState(false);

  return (
    <>
      <Button title="Open reward" onPress={() => setShow(true)} />

      <RewardReveal
        visible={show}
        onClaim={() => setShow(false)}
        tier="A"
        title="Shadow Sovereign's Gauntlets"
        subtitle="Awarded for completing the 30-day Iron Oath."
        bannerSource={require('./assets/gauntlets.png')}
        rewards={[
          { label: 'XP EARNED',      value: '+540',          icon: '✦', color: '#FFBD52' },
          { label: 'RANK PROGRESS',  value: 'B → A',         icon: '▲' },
          { label: 'TITLE UNLOCKED', value: 'Iron Disciple', icon: '❖', color: '#8FB4FF' },
        ]}
      />
    </>
  );
}
```

Render it **last** in your screen tree (or inside a full-screen `Modal`) so the
overlay sits on top. It fills its parent (`position: absolute`, all edges) and
ignores touches outside the panel (`pointerEvents="box-none"`), so it won't block
the UI underneath until it's visible.

The animation plays once each time `visible` flips to `true` and holds on the
final frame. Set `visible={false}` (typically from `onClaim`) to dismiss and reset.

A runnable example lives in [`example/RewardScreen.tsx`](./example/RewardScreen.tsx).

---

## Props

| Prop           | Type                                              | Default                | Notes |
| -------------- | ------------------------------------------------- | ---------------------- | ----- |
| `visible`      | `boolean`                                         | —                      | Flip to `true` to play; `false` to dismiss/reset. |
| `onClaim`      | `() => void`                                      | —                      | Fired when the CLAIM button is pressed. |
| `title`        | `string`                                          | —                      | Reward name (Chakra Petch display). Required. |
| `tier`         | `'aura' \| 'E' \| 'D' \| 'C' \| 'B' \| 'A' \| 'S'` | `'aura'`               | Recolours the whole reveal. `'aura'` = signature blue→violet; `E`–`S` = rank-tier colors. |
| `kicker`       | `string`                                          | `'NEW REWARD UNLOCKED'`| Mono label above the title. |
| `subtitle`     | `string`                                          | —                      | Short description line (Hanken Grotesk). Optional. |
| `bannerSource` | `ImageSourcePropType`                             | —                      | Hero image. Omit to show the auto emblem (first letter of the title on a sigil). |
| `rewards`      | `RewardRowData[]`                                 | `[]`                   | Reward rows that cascade in. Omit/empty to hide the list. |
| `claimLabel`   | `string`                                          | `'CLAIM REWARD'`       | CTA button text. |

### `RewardRowData`

| Field   | Type     | Notes |
| ------- | -------- | ----- |
| `label` | `string` | Small mono caption, e.g. `'XP EARNED'`. |
| `value` | `string` | Bold value, e.g. `'+540'` or `'B → A'`. |
| `icon`  | `string` | Glyph/emoji shown in the row's icon tile. Defaults to `'◆'`. |
| `color` | `string` | Optional hex that overrides the tier accent for this row's icon + check. |

---

## Retuning the timing

The whole animation is driven by **one clock shared value** (in seconds), and
every phase is derived from the `TL` timeline object near the top of
`RewardReveal.tsx`. Nudge those `[start, end]` pairs (and `burst` / `END`) to
speed things up, slow them down, or shift a beat — no need to touch the
individual animated styles.

## Platform notes (baked into the code as comments)

- **Hexagon core** — RN can't clip a `<View>` to a polygon without a lib. The
  sigil core uses a rotated rounded square, which reads as a crystal. For a true
  hexagon, swap it for a `react-native-svg` `<Polygon>` or a masked `<Image>`.
- **Blur / soft glow** — a plain `<View>` has no blur, so the light pillar and
  flash use flat radial-ish fills. For softer edges use `expo-blur` and
  `expo-linear-gradient`.
- **Gradients** — the CLAIM button and banner approximate gradients with layered
  fills. Drop in `expo-linear-gradient` if you want true gradients.
- **Shadows/glow** — rendered via `shadowColor`/`shadowRadius` (iOS). On Android
  these need `elevation` or a shadow lib (`react-native-shadow-2`) for a real glow.
