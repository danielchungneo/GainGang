## StreakContinueOverlay

A ~2-second celebration modal that plays on the **first exercise of the day** when the personal streak bumps. Built with `react-native-reanimated` — fully native, no WebView / Lottie.

### Import

```tsx
import { StreakContinueOverlay } from '@/components/streak-continue-overlay';
```

### Usage

```tsx
<StreakContinueOverlay
  visible={showStreak}
  fromDays={4}
  toDays={5}
  onDismiss={() => setShowStreak(false)}
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | — | Mounts and triggers the animation |
| `fromDays` | `number` | `0` | Streak before today's first exercise |
| `toDays` | `number` | `1` | Streak after today's first exercise |
| `onDismiss` | `() => void` | — | Called when backdrop / card is tapped |

### Animation timeline

| Time | Event |
|---|---|
| 0 ms | Dark warm overlay fades in |
| 160 ms | Card slides up; flame + previous count appear |
| 200 ms | Ember particles loop upward |
| 700 ms | Flash burst; count springs to `toDays`; `+1` floats up |
| 980–1260 ms | Aura rings burst outward ×3 (staggered) |

Copy switches automatically: **STREAK STARTED** when `fromDays === 0`, otherwise **STREAK CONTINUES**.

### Celebration queue

On a save that also completes the daily goal / levels up, play in order:

1. `StreakContinueOverlay`
2. `GoalCompleteOverlay`
3. `LevelUpOverlay`

Only fires when `last_active_on !== today` before the save.
