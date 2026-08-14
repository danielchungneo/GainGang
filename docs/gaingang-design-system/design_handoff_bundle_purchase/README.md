# Handoff: Creds Pack Purchase Celebration (GainGang)

## Overview
A bespoke "grand reveal" celebration for when a player completes a Creds-pack
purchase (real-money IAP) in the Armory: the CredPlate charges up, bursts into
a flash, coin + aura confetti falls, then a system panel counts up the Creds
granted and the new wallet balance before a pulsing CONTINUE button appears.

This **replaces** the generic `<RewardReveal>` currently reused for the Creds
top-up success moment in `components/shop-sheets.tsx` (`ShopCredsPacksSheet`,
the `topUpReveal` modal near the bottom of the file) — that component is built
for loot/rank rewards; this one is purpose-built for a Creds purchase.

## About the files in this bundle
- **`CredsPackReveal.tsx`** is **production-ready code**, not a reference —
  it's already written against this codebase's real modules (`CredPlate`,
  `fontFamily`, `CREDS_GOLD`/`CREDS_DEEP`, `react-native-reanimated`,
  `expo-linear-gradient`) and mirrors the structure/conventions of the
  existing `components/reward-reveal/RewardReveal.tsx`. Copy it directly into
  `components/creds-pack-reveal.tsx`.
- **`Bundle Purchase Animation.dc.html`** (+ `animations.jsx`, `support.js`) is
  the **HTML design reference** used to design the timeline and visuals —
  open it in a browser to preview/tune the animation timing and look before
  it's retuned in the .tsx. Not code to ship.

## Fidelity
High fidelity. Colors, type, spacing and timing are final-intent, taken
directly from the GainGang design system and the existing Creds/reward-reveal
components. The .tsx uses the real `CredPlate` SVG mark (weight-plate design)
instead of redrawing it.

## Integration
In `components/shop-sheets.tsx`:

1. Add the import:
   ```tsx
   import { CredsPackReveal } from '@/components/creds-pack-reveal';
   ```
2. Replace the `<RewardReveal>` block inside the `topUpReveal` Modal (near the
   end of `ShopCredsPacksSheet`) with:
   ```tsx
   {topUpReveal ? (
     <CredsPackReveal
       visible
       packLabel={topUpReveal.title}
       amount={topUpReveal.amount}
       priceLabel={topUpReveal.priceLabel}
       bestValue={topUpReveal.bestValue}
       balanceBefore={topUpReveal.balanceBefore}
       onContinue={() => setTopUpReveal(null)}
     />
   ) : null}
   ```
3. Extend the local `CredsTopUpReveal` type and the two `showTopUpReveal(...)`
   call sites (`handlePack`, `handleRestore`) to also pass `priceLabel`,
   `bestValue` (from the matched `CREDS_PACKS` entry — `false`/omit for
   restores), and `balanceBefore` (the wallet balance read just before the
   mutation resolves, so the ledger row has something to count up from — omit
   it and the row simply doesn't render).
4. The outer `<Modal transparent animationType="fade">` wrapper around
   `topUpReveal` can stay as-is; `CredsPackReveal` renders its own backdrop.

No other files need to change — `PurchaseReveal.tsx` (cosmetics purchases) and
`RewardReveal.tsx` (loot/rank rewards) are untouched and keep their existing
call sites.

## Timeline (seconds, from `CredsPackReveal.tsx`'s `TL` constant)
- `0.0 – 0.45` — backdrop fades in
- `0.1 – 1.7` — CredPlate charges: scales in, spins up, converging spark
  particles, screen-shake ramps with charge
- `1.7` — burst: white flash, shockwave ring, 14 plate shards fly outward
- `1.85` onward — continuous falling coin/aura confetti (loops until dismissed)
- `2.7 – 3.6` — system panel reveals: kicker → pack name → price/BEST VALUE
  badge → Creds amount counts up from 0
- `~4.75 – 5.7` — new balance counts up from `balanceBefore`
- `~6.05 – 6.45` — CONTINUE button fades in and idle-pulses (aura gradient glow)

Retune by editing the `TL` object — every animated style reads from it, so
shifting one timestamp cascades correctly downstream.

## Design Tokens
- Creds gold `#F5A524` (dark) / `#E0910F` (light), deep gold `#C97A0C` — via
  `CREDS_GOLD` / `CREDS_DEEP` in `lib/shop.ts`. Never invented ad hoc.
- Aura gradient `#4D8CFF → #9D4EDD` on the CTA only (primary-CTA convention).
  Gold is reserved for currency, matching `Currency Icon.dc.html`'s rule that
  gold never doubles as a generic accent.
- Type: Chakra Petch (`fontFamily.display`) for title/amount/CTA, JetBrains
  Mono (`fontFamily.mono`/`monoBold`) for labels/amounts, matching every other
  system-panel moment in the app (`RewardReveal`, `PurchaseReveal`).
- Panel chrome (header bar, corner brackets, top hairline, 20px radius) copies
  `RewardReveal.tsx`'s "system window" pattern for visual consistency across
  celebration moments.

## Assets
- Creds mark: `components/ui/cred-plate.tsx` (`CredPlate`) — reused as-is,
  never redrawn, per the existing Currency Icon rules doc.
- No new fonts, icons, or raster assets required.

## Files
- `CredsPackReveal.tsx` — the component to copy into `components/`.
- `Bundle Purchase Animation.dc.html` (+ `animations.jsx`, `support.js`) — the
  HTML animation reference. Open `Bundle Purchase Animation.dc.html` directly
  in a browser (double-click it) to preview.
