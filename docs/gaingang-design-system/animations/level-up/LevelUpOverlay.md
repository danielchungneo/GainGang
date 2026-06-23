## LevelUpOverlay

A ~3.5-second celebration modal that fires when a player levels up. Built with `react-native-reanimated` + `expo-linear-gradient` — fully native, no WebView.

### Install

```bash
npx expo install react-native-reanimated expo-linear-gradient
```

Add the Reanimated Babel plugin to `babel.config.js` (must be last):

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

### Import

```tsx
import { LevelUpOverlay } from './gaingang-rn';
```

### Usage

```tsx
import React, { useState } from 'react';
import { Button, View } from 'react-native';
import { LevelUpOverlay } from './gaingang-rn';

export function ProfileScreen() {
  const [showLevelUp, setShowLevelUp] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      {/* ...screen content... */}

      <Button title="Level up" onPress={() => setShowLevelUp(true)} />

      <LevelUpOverlay
        visible={showLevelUp}
        fromLevel={12}
        toLevel={13}
        onDismiss={() => setShowLevelUp(false)}
      />
    </View>
  );
}
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | — | Mounts and triggers the animation |
| `fromLevel` | `number` | `12` | Level before the gain (shown in card) |
| `toLevel` | `number` | `13` | New level reached (shown in stamp) |
| `onDismiss` | `() => void` | — | Called when backdrop is tapped |

### Animation timeline

| Time | Event |
|---|---|
| 0 ms | Dark overlay fades in |
| 200 ms | Level card slides up |
| 800 ms | XP bar sweeps to 100% |
| 1 400 ms | Screen flash burst |
| 1 460 ms | "LEVEL UP" stamp springs in (spring bounce, covers full card) |
| 2 040 ms | Aura rings burst outward ×3 (staggered) |

Re-triggering `visible={true}` replays from the start.

### Platform notes

- **Glows on iOS** — colored `shadowColor` on the badge and ring gives a full blue glow.
- **Glows on Android** — elevation shadows are neutral-colored; the border glow (via `interpolateColor`) is still visible. For pixel-matched colored glows on Android, use `@shopify/react-native-skia` or `react-native-shadow-2`.
- The card `borderColor` animates dim → bright using `interpolateColor` on the UI thread — no JS thread jank.
- All animation values are Reanimated shared values — plays and resets fully on the UI thread.
