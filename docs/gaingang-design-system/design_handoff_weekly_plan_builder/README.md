# Handoff: Weekly Plan Builder redesign (gang/new-goal)

## Overview
A redesign of GainGang's weekly plan builder — the screen a gang leader uses to set the week's
daily goals (`app/gang/new-goal.tsx`). The current screen is a long vertical list: pick a day chip,
scroll, pick a category, scroll, type targets into text inputs, repeat seven times. The redesign
replaces that with a **persistent 7-day board** pinned under the header and a **fixed edit panel**
below it, so the whole week is always visible and switching days never scrolls the page. Targets are
set with steppers instead of the keyboard, and a "Copy to rest" action fills the remaining empty
days from the selected day in one tap.

The data model is unchanged: a weekly plan holds one `daily_goal` per weekday, each with a set of
exercises carrying a per-member `individual_target`; the gang target is `individual_target × member_count`;
there is an `is_adaptive` flag on the plan. Days are **not** categorized — categories belong to
exercises only, and are used purely to filter the exercise picker.

## About the Design Files
`WeeklyPlanBuilder.dc.html` in this bundle is a **design reference created in HTML** — a clickable
prototype of intended look and behavior, not production code to copy. Implement it in the existing
GainGang React Native / Expo codebase using its established patterns: `ScreenBackground`,
`GlassSurface`, `KeyboardAwareScrollView`, `ExerciseIcon`, `useThemeTokens()` tokens, NativeWind
classes, and the existing `useExercises` / `useWeeklyPlan` / `useCreateWeeklyPlan` /
`useUpdateWeeklyPlan` hooks and `buildDaysPayload`. Colors below are the dark-theme literals from
the prototype; map each to its `useThemeTokens()` equivalent rather than hard-coding, and build the
light theme in parallel per `docs/DESIGN_SYSTEM.md`.

## Fidelity
**High-fidelity.** Final layout, colors, typography, spacing and interaction model. Recreate the UI
closely; substitute theme tokens for the literal hex values and RN glow (`shadowColor`) for CSS
`box-shadow`.

## Screens / Views

### Weekly Plan Builder (single screen, replaces NewGoalScreen)
**Purpose:** the gang leader builds or edits one week of daily goals and publishes it.

**Layout** — full-screen, dark canvas `#05070f`, safe-area top. Vertical flex, three fixed regions
plus one scroll region:

1. **Header** (padding `8px 20px 14px`, row, gap `14px`)
   - Close button: 36×36, radius 12, 1px border `rgba(125,165,255,.14)`, X glyph `#aeb8d0`.
   - Middle block: mono kicker `IRON WOLVES · 6 MEMBERS` (JetBrains Mono 10px, letter-spacing `.2em`,
     uppercase, `#7d8aa8`), then title `Week of Jun 23` (Chakra Petch 600, 26px, line-height 1).
   - Right block, right-aligned: mono label `DAYS SET` (10px, `.14em`, `#7d8aa8`) over
     `4/7` (Chakra Petch 700, 20px, `#8fb4ff`; the `/7` at 14px `#5b678c`).

2. **Week board** (padding `0 20px 14px`) — `display:grid; grid-template-columns:repeat(7,1fr); gap:6px`.
   Each cell: radius 13, padding `9px 2px 8px`, column flex, centered, gap `6px`, containing
   (a) day letters `MON`…`SUN` (JetBrains Mono 700, 10px, `.06em`),
   (b) a 26px-tall bottom-aligned stack of up to 4 volume pips (14×3px, radius 2, gap 2px),
   (c) a footer label: `2 EX` when the day has exercises, `REST` when empty
       (JetBrains Mono 8px, uppercase).
   Three cell states:
   - **Selected**: background `linear-gradient(160deg, rgba(77,140,255,.28), rgba(157,78,221,.2))`,
     1px border `rgba(77,140,255,.55)`, glow `0 0 18px -5px rgba(77,140,255,.7)`;
     day text `#ffffff`, footer `#cfdcff`, pips `#cfdcff` opacity 1.
   - **Filled, unselected**: background `#0e1524`, 1px border `rgba(125,165,255,.14)`;
     day text `#aeb8d0`, footer `#7d8aa8`, pips `#4d8cff` opacity .7.
   - **Empty (rest)**: transparent, 1px **dashed** border `rgba(125,165,255,.16)`;
     day text `#5b678c`, footer `#4a5474`, no pips.
   Below the board: a 1px divider `rgba(125,165,255,.12)` inset `0 20px`.

3. **Day panel** (flex:1, scrolls internally, padding `16px 20px 0`, column gap `14px`)
   - Row: left = mono date `MON, JUN 23` (10px, `.2em`, `#7d8aa8`) over day name `Monday`
     (Chakra Petch 700, 24px). Right = "Copy to rest" pill: padding `7px 12px`, radius 999,
     1px border `rgba(125,165,255,.14)`, copy icon + mono label 10px `#8fb4ff` uppercase.
   - **Exercise cards**, one per exercise on the day: background `#0e1524`, 1px border
     `rgba(125,165,255,.14)`, radius 14, padding `12px 14px`, column gap `10px`.
     - Top row: exercise name (Hanken Grotesk 600, 16px, `#e8edf7`), flex:1; then a 28×28 remove
       button (X glyph `#5b678c`).
     - Bottom row (row, gap 12): **stepper** — background `#131c30`, 1px border
       `rgba(125,165,255,.14)`, radius 12, overflow hidden; a 46×46 minus tap target (`#aeb8d0`),
       a center block min-width 78px showing the target (Chakra Petch 700, 22px, `#e8edf7`) over
       mono `REPS / MEMBER` (9px, `.14em`, `#7d8aa8`), then a 46×46 plus tap target (`#8fb4ff`).
       Beside it: mono `GANG TARGET` (9px, `.16em`, `#7d8aa8`) over the computed gang total
       (Chakra Petch 700, 19px, `#8fb4ff`).
   - **Rest-day empty state** (only when the day has no exercises): 1px dashed border
     `rgba(125,165,255,.18)`, radius 14, padding 18, centered — `Rest day` (Chakra Petch 600, 17px)
     over `Add an exercise below to make it a training day.` (13px, `#7d8aa8`).
   - **Add section**: mono heading `ADD TO MONDAY` (10px, `.2em`, `#7d8aa8`), then a horizontally
     scrolling category **filter row** (chips: padding `7px 12px`, radius 999, mono 10px `.1em`
     uppercase, nowrap — active `rgba(77,140,255,.2)` bg / `#cfdcff` text / 1px `rgba(77,140,255,.5)`;
     idle `#131c30` / `#7d8aa8` / 1px `rgba(125,165,255,.14)`), then wrapping **exercise chips**:
     padding `9px 13px`, radius 11, background `rgba(77,140,255,.07)`, 1px border
     `rgba(77,140,255,.22)`, plus icon `#8fb4ff` + name (Hanken Grotesk 600, 14px, `#cfdcff`, nowrap).
     Filter values: `All, Chest, Back, Legs, Core, Cardio, Full body`. Chips already on the day are
     excluded from the list.

4. **Footer** (flex-shrink 0, padding `12px 20px 26px`, gradient scrim to `#05070f`, column gap 10)
   - **Adaptive row**: background `#0e1524`, 1px border `rgba(125,165,255,.14)`, radius 12,
     padding `11px 14px`; label `Adaptive plan` (Hanken Grotesk 600, 14px) over
     `Targets rise next week on a clean sweep` (12px, `#7d8aa8`); right = 48×28 switch, radius 999,
     padding 3, thumb 22×22 white circle. On = `linear-gradient(120deg,#4d8cff,#9d4edd)`, thumb right;
     off = `#1d2840`, thumb left. (Use the RN `Switch` already in the codebase.)
   - **Primary CTA**: height 52, radius 14, `linear-gradient(120deg,#4d8cff,#9d4edd)`,
     glow `0 8px 24px -6px rgba(77,140,255,.6)`, label `PUBLISH WEEKLY PLAN`
     (Chakra Petch 700, 15px, `.04em`, `#fff`). In edit mode the label becomes `SAVE CHANGES`.

Decorative: two radial glow blobs behind content — `rgba(77,140,255,.18)` 360px top-left,
`rgba(157,78,221,.12)` 420px right at ~600px down. Both clipped by the screen.

## Interactions & Behavior
- **Tap a board cell** → selects that day; the panel header, exercise list and `ADD TO <DAY>`
  heading all switch to it. No scroll position change; the board stays put.
- **Tap an add chip** → appends that exercise to the selected day with a default target
  (reps 20, seconds 60, miles 2) and removes it from the add list.
- **Stepper −/+** → adjusts the per-member target by the unit step (reps 5, seconds 15, miles 0.5),
  clamped to a minimum of one step. The gang target readout updates live. Tapping the number itself
  should open the numeric keypad for direct entry (prototype does not implement this).
- **Remove (X)** on an exercise card → drops it from the day and returns it to the add list.
- **Category filter chip** → filters the add list; `All` clears the filter. Filter is UI-only state.
- **Copy to rest** → copies the selected day's exercise set (with targets) into every **later** day
  that is still empty. Non-empty days are left alone.
- **Adaptive switch** → toggles `is_adaptive` on the plan.
- **Publish / Save** → `buildDaysPayload(days)` then `useCreateWeeklyPlan` (or
  `useUpdateWeeklyPlan` when `planId` is present), then `router.back()`.
- Board pip count is capped at 4 regardless of exercise count.
- Empty days are legal (rest days). Validation stays as today: block publish if **no** day has any
  exercise, with the error text `Add at least one exercise to your weekly plan`.
- Loading: spinner in `accent` while an existing plan loads; disable the CTA while the mutation
  is pending and swap the label for an `ActivityIndicator`.

## State Management
```
plan: Record<dayOfWeek /*1–7*/, { exercises: { exerciseId, name, unit, target }[] }>
selectedDay: number      // 1–7, defaults to Monday (or today's weekday)
pickerFilter: string     // 'All' | exercise category
isAdaptive: boolean
error: string | null
```
Prefill `plan` from `useWeeklyPlan(planId)` when editing (see `buildDaysFromPlan` in the current
screen — drop its `category` field). Exercise library comes from `useExercises`; the prototype's
static list is placeholder data only.

## Design Tokens
Colors: canvas `#05070f`; surface `#0e1524`; surface2 `#131c30`; surface3 `#1d2840`;
border `rgba(125,165,255,.14)`; border dashed `rgba(125,165,255,.16–.18)`;
divider `rgba(125,165,255,.12)`; aura gradient `#4d8cff → #9d4edd` at 120deg;
accent text `#8fb4ff`; accent soft `#cfdcff`; violet accent `#c77dff`;
text `#e8edf7`; textDim `#aeb8d0`; textMuted `#7d8aa8`; quietest `#5b678c` / `#4a5474`.
Spacing: 2, 6, 8, 10, 12, 14, 16, 20, 26. Radius: 9, 11, 12, 13, 14, 999.
Type: Chakra Petch 600/700 (titles, numbers) · JetBrains Mono 400/700 (labels, units, stats) ·
Hanken Grotesk 600 (exercise names, body). Glows: `0 0 18px -5px rgba(77,140,255,.7)` (selected cell),
`0 8px 24px -6px rgba(77,140,255,.6)` (CTA). Tap targets: 46×46 steppers, 52 CTA height.

## Assets
No image assets. Icons are inline SVG stand-ins (close, copy, plus, minus) — replace with the
project's Ionicons equivalents (`close`, `copy-outline`, `add`, `remove`). Exercise rows in the
prototype have no icon; use the existing `ExerciseIcon` component at size 28 to the left of the
exercise name if desired. Fonts load from Google Fonts in the prototype; the app already ships them.

## Files
- `WeeklyPlanBuilder.dc.html` — the prototype (interactive: day switching, add/remove, steppers,
  filter, copy-to-rest, adaptive toggle). Values and handlers live in the `class Component` block at
  the bottom of the file; markup is inline-styled above it.
- Current implementation being replaced: `app/gang/new-goal.tsx`.
