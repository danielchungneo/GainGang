# Handoff: Shop / Armory Screen (GainGang)

## Overview
Design for the `app/(tabs)/shop.tsx` screen, which is currently a "Coming soon" placeholder.
The Armory is where players spend **Creds** on cosmetics: rotating stock, a featured drop,
one horizontal row per category, an item detail sheet with a live leaderboard preview, a
purchase confirm modal, and a Creds-packs (IAP) sheet.

Product decisions baked into this design:
- Sells **titles, avatar/icon borders, banners, cosmetic crates**; companions are a teaser.
- Stock is **fully rotating with timers** (featured drop countdown, per-row restock timers, "1 LEFT" scarcity).
- **Tap opens a detail sheet** with the item previewed live on the player's leaderboard row.
- Purchase = **confirm modal → existing reward reveal** (`components/reward-reveal.tsx`).
- Creds are earned daily; **Creds packs** are also purchasable with real money. Packs sell Creds only, never cosmetics.
- Tone: gritty gym-locker armory.

## About the Design Files
`ShopScreen.dc.html` in this bundle is a **design reference created in HTML** — a prototype
showing intended look and layout, not production code to copy. The task is to **recreate it in
the GainGang Expo / React Native codebase** using its existing patterns:
`ScreenBackground`, `GlassSurface`, `useThemeTokens()`, `lib/gaingang-theme` (`fontFamily`,
`spacing`, `type`), `HUD_CONTENT_TOP_PAD`, `CredsBalance`, `CredPlate`, Ionicons, and
`expo-linear-gradient`. Do not port raw CSS.

Light theme is required (the app has full parity). All hex values below are the **dark** values;
derive light-mode equivalents through `useThemeTokens()` exactly as the existing screens do —
surfaces `t.surface`/`t.surface2`, text `t.heading`/`t.body`/`t.placeholder`, borders `t.buttonBorder`.

## Fidelity
**High fidelity.** Colors, type, spacing, and copy are final-intent. Recreate closely, but always
prefer an existing component/token over a literal from this doc when the two conflict.

## Screens / Views

### 1. Storefront (the tab screen)
Purpose: browse rotating stock, see the featured drop, jump into a category item.

Layout (top → bottom, inside `ScreenBackground`):
1. **Header row** — `paddingHorizontal: spacing.lg`, `paddingTop: HUD_CONTENT_TOP_PAD`.
   Left: mono kicker `SPEND YOUR CREDS` (JetBrains Mono 10, letterSpacing 0.22em, `t.placeholder`)
   above title `Armory` (Chakra Petch 700, 32).
   Right: existing `<CredsBalance amount={…} />` with a trailing 24×24 circular **+** button
   (bg `rgba(245,165,36,0.18)`, border `rgba(245,165,36,0.5)`, gold plus glyph) that opens the Creds packs sheet.
2. **ScrollView** with `gap: 8` between sections (design was compressed to fit one screen; in the
   real app this scrolls, so `spacing.md` between sections is fine and preferred).
3. **Featured drop**
   - Section head row: `◆ FEATURED DROP` (mono 10, 0.22em, #F5A524) / right `04:12:38 LEFT` (mono 10, `t.placeholder`) — live countdown.
   - Card: radius 18, border 1.5px `rgba(245,165,36,0.6)`, bg `t.surface` (#0E1524),
     shadow gold glow (`shadowColor: '#F5A524'`).
   - Art block height 92–150 (taller is better when it scrolls): LinearGradient 135°
     `#3A2A10 → #1A1526 62% → #0E1524`, overlaid with diagonal hazard stripes
     (repeating 115° gold at 9% alpha, 10px stripe / 26px gap) and a radial gold bloom.
     Centered: gold gradient pill (`#F5A524 → #C97A0C`) with the title in Chakra Petch 700 19, color #2C1D0B,
     and under it `TITLE · A-RANK` (mono 9.5, 0.2em, `rgba(255,215,135,0.85)`).
   - Body: description (Hanken Grotesk 13.5, line-height 1.5, `t.body`), then a row:
     primary buy button (flex 1, radius 13, gold gradient, CredPlate + `1,800 CREDS` in Chakra Petch 700 15 / 0.1em on #2C1D0B)
     and a 48×48 secondary "preview" button (radius 13, 1px `t.buttonBorder`, eye icon).
4. **Category rows** — repeated pattern, one per cosmetic kind (Crates, Titles, Borders, Banners):
   - Head row: name (Chakra Petch 600, 19, `t.heading`, flex 1) + right meta
     (`RESTOCK 2D 04H` or `4 IN STOCK`, mono 9.5, 0.16em, `t.placeholder`).
   - Horizontal `FlatList`/`ScrollView`, `gap: 12`, `paddingHorizontal: spacing.lg`.
   - **Crate card** 150 wide: art block (radius top 15, tier-tinted gradient, Ionicons `cube-outline` 46 in tier color),
     then name (Hanken 600 13.5), odds line (mono 9, tier color, e.g. `B–S RANK ODDS`), price row (CredPlate 14 + mono 700 13).
     Border 1px in tier color at ~45% alpha.
   - **Title card** 168 wide: 44–52px preview plate (radius 10, tier color at 10% bg / 30% border) showing the
     title rendered in Chakra Petch 700 15 in the tier color, then a row of `D · TITLE` (mono 9, tier color) and price.
     Scarcity badge sits on the top edge: pill `1 LEFT`, bg tier color, mono 8.5 700, dark text.
   - **Border card** 118 wide, centered: 46px avatar ring (3px gradient padding around a `t.surface3` disc),
     name (Hanken 600 12.5), price. Owned items render at `opacity: 0.5` with `OWNED` (mono 10, `t.placeholder`) in place of price.
5. **Companions teaser** (optional, place after the last row): dashed 1px `rgba(125,165,255,0.24)` card,
   44px icon tile, `FORGING` kicker + one line of body copy. Matches the existing inventory "Companions" coming-soon panel.
6. **Tab bar** — existing app tab bar; Shop tab active in `#F5A524` (this is the one place the tab tint is gold, matching the currency).

### 2. Item detail sheet
Purpose: preview before buying.
- Storefront dims behind (`rgba(5,7,15,0.6) → 0.94` overlay); bottom sheet radius 26 top corners,
  bg `t.surface`, top border 1.5px in the item's rarity color, upward glow shadow in the same color, 44×4 grab handle.
- Hero: rarity kicker `S RANK · TITLE · 1 LEFT` (mono 9.5, 0.22em, rarity color) → the item preview at hero size
  (title = radius-14 plate, rarity color at 11% bg / 45% border, rarity glow, Chakra Petch 700 27, `whiteSpace: nowrap` equivalent —
  keep it one line, shrink type for long names) → description centered, max width 300, Hanken 13.5 / 1.55.
- **Live preview**: label `LIVE PREVIEW — YOUR LEADERBOARD ROW` (mono 9.5, 0.2em), then the real
  `CosmeticsLeaderboardPreview` component with the shop item passed as an override —
  reuse the same override mechanism inventory's god mode uses (`godModeOverrideForItem`).
- Price block: balance strip (radius 13, `rgba(44,29,11,0.6)`, border `rgba(245,165,36,0.3)`, `YOUR BALANCE` + CredPlate + amount),
  then the primary CTA (radius 14, **aura gradient** `#4D8CFF → #9D4EDD`, blue glow, `BUY · 3,200` Chakra Petch 700 16 / 0.12em, white).
- Insufficient funds: CTA stays enabled and the caption below reads `720 CREDS SHORT — TAP TO TOP UP`
  (mono 10, #FF5C89) — tapping routes to the Creds packs sheet rather than dead-ending.

### 3. Confirm modal
- Centered card 330 wide, radius 20, bg `t.surface`, 1px `rgba(245,165,36,0.7)`, gold glow; gold radial bloom behind it.
- Header strip: `◆ CONFIRM PURCHASE` (mono 10, 0.2em, #F5A524) on `rgba(245,165,36,0.1)`.
- Item name (Chakra Petch 700 22, rarity color) + sub (mono 9.5, `B–S RANK ODDS · ONE ROLL`).
- Ledger block (radius 13, `t.surface2`): `BALANCE` 2,480 / `COST` − 950 (in #FF5C89) / divider / `REMAINING` in gold with CredPlate.
- Primary: gold gradient, lock-open icon + `SPEND 950 CREDS`. Secondary: text-only `CANCEL` (mono 11, 0.16em, `t.placeholder`).
- On success → play the existing `RewardReveal` (same call shape as `app/inventory.tsx` uses), with
  `kicker="PURCHASED"`. For a deterministic (non-crate) cosmetic, the reveal is a short confirmation;
  for a crate, it is the full roll.

### 4. Creds packs sheet (IAP)
- Same sheet chrome as #2, top border gold. Above the sheet: 70px Creds hex mark with gold drop shadow
  and two mono lines: `CREDS ARE EARNED DAILY —` / `TOP UP IF YOU'RE IN A HURRY`.
- Header: `TOP UP` kicker + `Cred Bundles` (Chakra Petch 700 25).
- Three rows (radius 14, `t.surface2`, 1px `t.buttonBorder`), each: Creds mark, amount (mono 700 16–17),
  descriptor (mono 9.5, 0.14em), price pill on the right.
  - 500 — `HUSTLE BUNDLE` — $0.99
  - 6,500 — `BEAST BUNDLE` — $9.99 — **highlighted**: gold 1.5px border, `rgba(245,165,36,0.08)` bg,
    gold glow, `BEST VALUE` badge on the top edge, filled gold price pill.
  - 15,000 — `APEX BUNDLE` — $19.99
- Footer copy: "Bundles buy Creds only. Every cosmetic in the Shop is reachable by showing up."
- Product IDs / IAP setup: `docs/IAP_SETUP.md`.

## Interactions & Behavior
- Tap any catalog card → detail sheet (`Modal` + slide-up, matching existing sheets e.g. `gang-members-sheet`).
- Tap BUY → confirm modal. Tap SPEND → mutation → `RewardReveal` → sheet and modal both dismiss, balance animates to new value.
- Tap the balance chip's **+**, or the "CREDS SHORT" caption → Creds packs sheet.
- Countdown timers tick every second (featured) / every minute (row restock). When a timer hits zero,
  invalidate the shop query and re-fetch stock rather than mutating locally.
- Sold-out / owned items: card at `opacity: 0.5`, price replaced with `OWNED` or `SOLD OUT`, tap still opens the
  detail sheet (preview stays useful) but the CTA is replaced with a disabled `OWNED` state.
- Pull-to-refresh on the storefront using the existing `usePullToRefresh` hook.
- Loading: `ActivityIndicator` in `t.accent`, matching `inventory.tsx`. Error: message in #FF5C89 under the header.

## State Management
- `useCredsBalance()` (or profile field) — balance for the header chip, detail sheet, confirm ledger.
- New `useShopStock()` query — rotating stock: featured item, per-category items, each with
  `price`, `rarity`, `stock_remaining`, `rotation_ends_at`.
- New `usePurchaseCosmetic()` mutation → server-side RPC that checks balance, decrements Creds,
  grants the cosmetic (or rolls the crate) and returns `CrateReward[]` in the same shape
  `parseCrateContents` already handles, so `RewardReveal` needs no changes. On success invalidate
  `ownedCosmetics`, `profile`, and shop stock.
- Local UI state: `selectedItem`, `confirmVisible`, `revealVisible`, `packsVisible`, `error`.
- Price and stock must never be trusted client-side — the RPC is the authority.

## Design Tokens
Colors (dark):
- Canvas #05070F · Surface #0E1524 · Surface2 #131C30 · Surface3 #1D2840
- Text #E8EDF7 · Dim #AEB8D0 · Muted #7D8AA8
- Border `rgba(125,165,255,0.14)` · Border glow `rgba(77,140,255,0.35)`
- Aura gradient #4D8CFF → #9D4EDD (primary CTAs)
- Creds gold #F5A524 (dark) / #E0910F (light); deep gold #C97A0C; ink on gold #2C1D0B
- Rank tiers: E slate #8B8F9C · D teal #2DD4BF · C blue #4D8CFF · B violet #9D4EDD · A gold #F5A524 · S crimson #FF5C89

Spacing 4 / 8 / 16 / 24 / 32 / 48. Radius 8 / 10 / 13 / 14 / 15 / 18 / 20 / 26 / pill.
Type: Chakra Petch 600–700 (titles, prices, CTAs) · JetBrains Mono 400–700 (labels, amounts, timers) ·
Hanken Grotesk 400–700 (body). Never mix roles.
Glow: gold `0 0 26px rgba(245,165,36,0.6)` on featured/currency; aura blue on primary CTA; rarity color on the detail sheet.

## Assets
- Creds mark: the hex coin from `Currency Icon.dc.html` (1A "Hex Coin") — already implemented as
  `components/ui/cred-plate.tsx`. Reuse it; do not re-draw the SVG.
- All other icons are Ionicons (`cube`, `storefront`, `eye`, `lock-open`, `paw`), already a dependency.
- No raster assets.

## Files
- `ShopScreen.dc.html` — the four-frame design reference (storefront, detail sheet, confirm, Creds packs).
  Open in any browser.
- Existing code this should build on: `app/(tabs)/shop.tsx` (placeholder to replace),
  `app/inventory.tsx` (crate/reveal patterns to mirror), `components/creds-balance.tsx`,
  `components/ui/cred-plate.tsx`, `components/cosmetics-leaderboard-preview.tsx`,
  `components/reward-reveal.tsx`, `hooks/use-cosmetics.ts`, `lib/rewards.ts`, `lib/gaingang-theme`.
