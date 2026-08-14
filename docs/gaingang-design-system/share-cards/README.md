# Share cards — integration

Three 9:16 story cards for the Share Activity screen. The day's exercise list is the
hero; day streak and total reps sit below; the GainGang mark + wordmark anchors the card.

## Files

| File | Goes to |
| --- | --- |
| `activity-share-card.tsx` | `components/activity-share-card.tsx` (replaces the existing file) |
| `share-card-data.ts` | `components/share-card-data.ts` |
| `assets/gaingang-mark.svg` | `assets/branding/` — reference only; the card draws the mark inline |
| `assets/gaingang-mark-mono.svg` | `assets/branding/` |

## Dependencies

None new. Uses `expo-linear-gradient`, `react-native-svg`, `@expo/vector-icons` and
`react-native-view-shot`, all already in `package.json`. The gradient numerals are
SVG text rather than MaskedView, specifically to avoid adding a dependency.

Fonts `ChakraPetch_700Bold`, `ChakraPetch_600SemiBold` and `JetBrainsMono_500Medium`
must be loaded in the root layout — they already are.

## API

```tsx
<ActivityShareCard activity={activity} variant="branded" />
<ActivityShareCard activity={activity} variant="transparent" />
<ActivityShareCard activity={activity} variant="photo" photo={{ uri: photoUri }} />
```

Same `activity` + `variant` contract as the card it replaces, so
`app/activity/share.tsx` needs only:

1. `SHARE_CARD_MIN_HEIGHT` → `SHARE_CARD_HEIGHT` (fixed 640 for a true 9:16).
2. Add `'photo'` to `VARIANTS` once a photo source is wired, plus a third
   `ViewShot` ref in `activeCaptureRef()`. Leave it out until then.

## Capture

Render at 360×640, capture at 3× for a 1080×1920 story asset:

```ts
const uri = await captureRef(ref, {
  format: 'png',
  quality: 1,
  result: 'tmpfile',
  width: SHARE_CARD_WIDTH * 3,
  height: SHARE_CARD_HEIGHT * 3,
});
```

The transparent variant relies on PNG alpha — keep `format: 'png'` and do not set a
`backgroundColor` on the `ViewShot` wrapper.

## Notes

- `MAX_SHARE_EXERCISES` is 5; longer logs truncate rather than shrink the type. If you
  want a "+3 more" line instead, add it under the list in the hero block.
- `totalReps` sums only `unit === 'reps'` lines, so a plank-only day shows 0. Swap in
  an XP or duration stat there if that reads badly.
- Amounts drop the word "reps" (`50` / `Push Ups`) but keep other units (`3m`, `2.5 mi`).
