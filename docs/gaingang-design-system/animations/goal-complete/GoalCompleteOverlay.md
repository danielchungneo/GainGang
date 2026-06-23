## GoalCompleteOverlay

A celebration modal that plays when **all exercises** in a daily goal are completed. Built with `react-native-reanimated` + `expo-linear-gradient` — no WebView, fully native.

### Install

```bash
npx expo install react-native-reanimated expo-linear-gradient
```

Add the Reanimated Babel plugin to `babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'], // must be last
};
```

### Import

```tsx
import { GoalCompleteOverlay } from './gaingang-rn';
```

### Basic usage

```tsx
import React, { useState } from 'react';
import { Button, View } from 'react-native';
import { GoalCompleteOverlay } from './gaingang-rn';

export function QuestScreen() {
  const [showCelebration, setShowCelebration] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Button title="Complete daily goal" onPress={() => setShowCelebration(true)} />

      <GoalCompleteOverlay
        visible={showCelebration}
        questTitle="Push Day"
        questKind="Daily Goal"
        xpEarned={120}
        exercises={[
          { name: 'Push-ups', unit: 'reps', from: 40, target: 50 },
          { name: 'Dips', unit: 'reps', from: 8, target: 15 },
          { name: 'Plank', unit: 'seconds', from: 45, target: 60 },
        ]}
        onDismiss={() => setShowCelebration(false)}
      />
    </View>
  );
}
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | — | Mounts and plays the animation |
| `questTitle` | `string` | `'The Iron Oath'` | Title shown on the card |
| `questKind` | `string` | `'Daily Goal'` | Label above the title |
| `description` | `string` | auto | Subtitle; defaults to "All N exercises complete." |
| `xpEarned` | `number` | `50` | XP shown in the pill at the end |
| `exercises` | `GoalCompleteExerciseTarget[]` | — | Each exercise gets a staggered progress bar |
| `yourTarget` | `{ from, target }` | — | **Deprecated.** Single-bar fallback for legacy flows |
| `onDismiss` | `() => void` | — | Called when backdrop is tapped |

#### `GoalCompleteExerciseTarget`

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Exercise label shown above the bar |
| `unit` | `'reps' \| 'seconds' \| 'miles'` | Drives amount formatting |
| `from` | `number` | Starting progress before this session |
| `target` | `number` | Individual target — bar animates to this value |

### Animation timeline

| Time | Event |
|---|---|
| 0ms | Dark overlay fades in |
| 200ms | Quest card slides up |
| 780ms + stagger | Each exercise bar fills (160ms apart) |
| After last bar | Card glow intensifies |
| +80ms | "Goal Complete ✓" stamps in (spring bounce) |
| +160–460ms | Aura rings burst outward (staggered ×3) |
| +700ms | +XP pill drifts up |

Celebration (stamp, rings, XP) only fires after **every** bar finishes animating.

### Platform notes

- **Glows on iOS** — colored `shadowColor` gives the blue glow on ring + card.
- **Glows on Android** — Android elevation shadows are neutral-colored; the glows will be softer.
- The card `borderColor` animates from dim → bright blue using `interpolateColor` from Reanimated.
- Plays once per `visible` toggle; re-triggering `visible={true}` replays from the start.
