# Gang Wars — Requirements

**Status:** Staging implementation in progress  
**Last updated:** 2026-08-10  
**Related:** [FEATURE_TODO.md](./FEATURE_TODO.md) · War tab placeholder `app/(tabs)/war.tsx`  
**Reuse:** Monday 2 AM ET rollover pattern (`rollover_weekly_plans` / `rollover_weekly_challenges`)

---

## 1. Summary

Gang Wars is a weekly, division-based head-to-head competition between two gangs. Each day Mon–Sun, both gangs get the same timed exercise challenge. Member attempts contribute to a gang score. At week end, the winner promotes a division and receives crates; the loser demotes. Matching and promotion/demotion run on the same Monday morning job window as weekly plan / challenge rollover.

---

## 2. Goals

- Give gangs a recurring competitive loop beyond personal weekly challenges.
- Make the War tab scoreboard-first: **our reps vs their reps**.
- Keep matchups strictly reciprocal (A vs B means B vs A).
- Prefer human–human matchups; use a bot opponent only when a gang would otherwise be unpaired.
- Scale rewards with division.
- Favor full gangs — score is a raw sum; size is balanced by the existing gang member cap.

---

## 3. Non-goals (v1)

- Seasons / ELO beyond the fixed division ladder.
- Cross-division matchups.
- Best-of series or multi-week tournaments.
- Betting / currency stakes (crates only).
- Changing personal weekly challenges (separate feature; wars have their own daily exercises).
- Per-capita or top-N scoring (intentionally not used).
- Push / in-app notifications for war events (match start, daily reminder, win/loss) — **future state**.

---

## 4. Divisions

Ordered lowest → highest:

| Order | Division |
|------:|----------|
| 1 | Iron |
| 2 | Bronze |
| 3 | Silver |
| 4 | Gold |
| 5 | Emerald |
| 6 | Diamond |
| 7 | Crystal |
| 8 | Onyx |

**Rules**

- Each **eligible** gang has exactly one current division.
- **Win** → promote one division (Onyx stays Onyx).
- **Lose** → demote one division (Iron stays Iron).
- Matchups only within the **same division** (after last week’s promotions/demotions, before next matching).

**New gangs:** start in **Iron**.

---

## 5. Eligibility

A gang can be matched if:

- `is_system = false` (human gang), and
- `eligible_for_gang_competitions = true` (field already exists), and
- Has at least one member at matching time.

**Not eligible for human–human matching as opponents:**

- System/bot gangs (see §9). They only appear as filler opponents.

**User with no gang**

- War tab shows join / create CTA (same spirit as Gain empty state).

**Gang created / joined mid-week without a match**

- War tab: message that they wait until next Monday’s matching to enter a war.
- No mid-week matching in v1.

---

## 6. Schedule

| Event | When |
|-------|------|
| War week | Monday 00:00 → Sunday 23:59:59 in **America/New_York** (same week model as plans) |
| Daily challenge day | Calendar day in ET (Mon day 1 … Sun day 7) |
| Resolve + promote/demote + award crates + create next week’s matchups | Monday ~**2:00 AM ET**, same window as weekly plan / challenge rollover |

**Job requirements**

- Postgres function + `pg_cron` hourly tick + `app_settings` last-run guard (same pattern as `rollover_weekly_plans`).
- Idempotent; service-role only; optional `p_force` for ops.
- Order of operations on Monday morning:

  1. Close any still-open war week whose `ends_on` is in the past.
  2. Determine winners/losers (including tie-breakers).
  3. Grant win crates to all members of the winning gang.
  4. Apply division changes.
  5. Create next week’s matchups for all eligible human gangs.

---

## 7. Matching

### 7.1 Constraints

- **Strictly head-to-head:** one opponent per gang per week. If A is matched with B, B’s opponent is A — never A–B and B–C.
- Match only gangs in the **same division**.
- Prefer **human vs human**.
- If an odd number of human gangs remain in a division after pairing, the leftover gang matches a **bot** for that division (see §9).
- Pairing algorithm v1 may be random within division.
- **No rematch avoidance** — the same opponent (human or bot) may be paired again in consecutive weeks.

### 7.2 Reciprocal storage

Store one **match** row (or equivalent) with `gang_a_id`, `gang_b_id` (bot id allowed), `week_starts_on`, `division`, status — not two one-way rows that can diverge.

### 7.3 Mid-week membership

- Gangs already in a match keep that match for the week.
- Members who **join** a matched gang mid-week **may contribute immediately** to that gang’s remaining days / today’s challenge.
- Members who **leave** stop contributing; prior attempts remain on the gang score.

---

## 8. Daily challenges & scoring

### 8.1 Exercise rotation

Five exercises, each a **60-second max-reps** camera challenge (same family as existing timed weekly challenges), in fixed cycle order:

1. Push-ups  
2. Sit-ups  
3. Squats  
4. Crunches  
5. Lunges  

**Cycling:** one global day-counter advances every calendar day (ET). Each war day uses `exercises[rotation_index % 5]`, then the index increments. The cycle **continues across week boundaries** — it does not reset on Monday. Within a 7-day week, two exercises from the five will appear twice; which ones depend on where the global index sits that week.

Same exercise for every match on a given day (deterministic, shared by both sides). Persist `rotation_index` in settings/DB (same idea as weekly challenge `rotation_index`).

### 8.2 Attempts

- Members may attempt the **day’s** exercise **unlimited** times.
- Only the member’s **highest two** attempt scores for that day count toward the gang.
- Attempts require camera / native rep counter (same trust model as weekly challenges).
- Only attempts on the correct exercise for that day count.
- **Attempts are gang-scoped:** when the user is viewing a specific gang on the War tab, an attempt counts **only for that gang**, not for every gang they belong to. Same physical session does not auto-apply across gangs.

### 8.3 Gang day score & week score

- **Member day contribution** = sum of their top 2 attempt scores that day **for that gang’s match**.
- **Gang day score** = sum of all members’ day contributions (no per-capita / top-N). Large gangs are intentional; size is limited by the existing member cap.
- **Gang week score** = sum of gang day scores Mon–Sun.
- Higher week score wins, unless tied (see §8.4).

### 8.4 Ties

When week scores are equal, apply tie-breakers in order:

1. **Fewer members wins** — gang with the smaller roster at resolve time wins.
2. If member counts are also equal — **first entry wins** — the gang whose earliest `gang_war_attempt` (or equivalent) in this match was recorded first wins.

Winner still promotes and gets crates; loser demotes.

---

## 9. Bot (system) opponents

When a human gang cannot be paired with another human in its division:

- Match them against the **division’s war bot** (system gang).
- Bot is **not** a normal discoverable crew for social purposes beyond appearing as the opponent on the War screen.
- Existing `gangs.is_system` / `eligible_for_gang_competitions = false` / `create_system_gang` are the foundation; wars may use a `war_bot` / division link.

### 9.1 Bot names (by division)

| Division | Bot gang name |
|----------|---------------|
| Iron | Iron Deficiency |
| Bronze | Bronze Age Bros |
| Silver | Silver Spoon Squatters |
| Gold | Gold Diggers |
| Emerald | Green Machines |
| Diamond | Ice Cold Gainz |
| Crystal | Crystal Cartel |
| Onyx | Onyx Order |

### 9.2 Bot scores

- **Pre-determined reps per day** (not live “players”).
- Difficulty **scales up with division** (Iron easiest → Onyx hardest).
- Exact tables (reps per day × division) TBD in build — store as data, not hard-coded magic in UI.

Bot day scores are the assigned daily totals. For UI and running week totals during an active war:

- **Only reveal bot reps for days up to and including today (ET).**
- Future days’ assigned bot reps must **not** appear in the opponent total or day breakdown until that day arrives.
- Example: if the Bronze bot is assigned 200 reps across the full week, on Monday the UI shows only Monday’s assigned bot score — not the full-week 200.

At Sunday end / Monday resolve, the full week of bot day scores counts toward the final week total.

For ties vs bots: use the same tie-breakers. **Bot roster size is always 1 member**, so a human gang with 2+ members loses the “fewer members” tie-break against a bot; only a solo human gang ties on member count and then falls through to earliest attempt.

---

## 10. Rewards

On win (after week resolve), grant crates based on the division **fought in** that week (before promotion is applied):

| Division | Crate tier (app rarity) | Code |
|----------|-------------------------|------|
| Iron | Common | `E` |
| Bronze | Common | `E` |
| Silver | Uncommon | `D` |
| Gold | Rare | `C` |
| Emerald | Epic | `B` |
| Diamond | Legendary | `A` |
| Crystal | Mythic | `S` |
| Onyx | Mythic | `S` |

**Notes**

- App rarities are `E D C B A S` (Common → Mythic).
- Crate grant should extend `user_reward_crates` with a new source (e.g. `gang_war_win`), floor tier = table above (same pattern as daily / level-up crates).
- **Every member** of the winning gang at resolve time receives a crate (participation not required).
- **Losers:** demotion only; no pity crate in v1.

---

## 11. War tab UX

### 11.1 States

1. **No gang** — join or create.
2. **Has gang(s), no active match** — “Matched next week” / wait until Monday matching.
3. **Active war** — primary UI (below).
4. **Resolved recent war** *(optional polish)* — result banner until next match starts.

### 11.2 Active war (focus)

Screen should be dominated by:

- Opponent identity (name, division badge).
- **Our gang total vs their gang total** (week score), clearly comparative.
  - Vs bots: running opponent total = sum of bot day scores **through today only** (future bot days hidden).
- Breakdown by day: exercise name, our day score vs theirs (future bot days blank / locked).
- CTA to attempt **today’s** challenge (rep counter) for the **selected gang**.
- Secondary: member contributions for own gang (optional v1+).
- Entry point to **history** for the selected gang.

### 11.3 Multi-gang selector

- If the user is in **multiple gangs**, show a **gang selector at the top** of the War tab (same idea as the Gangs tab selector).
- The selected gang determines which match / wait state / attempt scope is shown.
- Attempts started from that view count **only** toward the selected gang’s war.

### 11.4 History

v1 includes a **history view** (list of past wars for the selected gang). Each row shows at least:

- Opponent name (human or bot)
- Our total reps vs their total reps
- Win / loss (after tie-break if applicable)
- Division the war was fought in
- Week date range (or week start)

History is scoped to the selected gang when the user has multiple gangs.

### 11.5 Empty / wait copy

- No gang: join or create.
- Gang but unmatched this week: wait until next week’s matching.

---

## 12. Division banners

With Gang Wars, each gang’s competitive look includes a **division border** around the gang’s existing banner picture (`gangs.banner_url` / gang banner image).

- The **border** is **system-owned per division** (Iron → Onyx art/style) — not a player cosmetic unlock.
- The **inner image** remains the gang’s normal banner picture (custom upload / existing banner).
- When a gang promotes or demotes, only the **border** updates to the new division.
- Bot opponents: show their gang banner image (if any) with the matching division border; placeholder image acceptable if bots have no custom banner.
- Used in War UI (matchup VS, scoreboard, history) and anywhere the gang’s war identity is shown.

Asset need: eight **border** treatments (one per division), composable around a square/rect banner image.

---

## 13. Animations

### 13.1 New-matchup reveal (VS)

**When:** First time the user opens the War tab (for a selected gang) after that gang has been assigned a **new** weekly matchup.

**What:** Full-screen (or near full-screen) cinematic: **our division banner vs opponent’s division banner**, inspired by a red-vs-blue pedestal / glowing “VS” confrontation (reference: [`docs/assets/gang-war-matchup-vs-reference.png`](./assets/gang-war-matchup-vs-reference.png)).

**Requirements**

- Play **once per user per match** (persist a seen flag, e.g. `user_id + match_id`).
- Multi-gang: play when switching to a gang whose matchup reveal has not been seen yet.
- After dismiss / completion, land on the active war scoreboard.
- Skip if there is no active match (wait / no-gang states).

### 13.2 Promotion / demotion reveal

**When:** User returns to the app (or opens War) **after** Monday resolve has promoted or demoted a gang they belong to, and they have not yet seen that result animation.

**What**

- **Win / promote:** celebration that conveys victory and the **new higher division** (border swap Iron→…→Onyx). Onyx wins still play the full win animation even though division stays Onyx.
- **Lose / demote:** loss beat that conveys demotion to the **new lower division**. Iron losses still play the full loss animation even though division stays Iron.

**Requirements**

- Play **once per user per resolved match** (or per result event).
- If both a prior-week result animation and a new-matchup VS are pending, play **result first**, then **VS** for the new week.
- **Iron floor / Onyx ceiling:** division does not change on Iron loss or Onyx win, but **win and loss animations still always play**.

---

## 14. Data model (sketch — not final)

Illustrative only; finalize in implementation.

- `gang_war_divisions` or enum on `gangs.war_division` (default Iron)
- `gang_war_weeks` / `gang_war_matches` (pair, week, division, scores, result, first-attempt timestamps for tie-break)
- `gang_war_daily_challenges` / global `rotation_index` for the continuous 5-exercise cycle
- `gang_war_attempts` (user, **gang_id / match**, day, score) — gang-scoped
- Snapshot or live member count at resolve for tie-break
- Bot schedule table: `gang_war_bot_targets (division, day_offset_or_weekday, score)` (bot roster size fixed at **1**)
- One system gang per division with the names in §9.1
- Rollover: `rollover_gang_wars()` + `app_settings.gang_war_rollover`
- Crate source enum value for war wins
- Persisted match results sufficient for history list
- Per-user seen flags for matchup VS and promo/demo result animations
- Division banner asset keys mapped from `war_division`

Reuse camera attempt submission patterns from `submit_challenge_attempt` where sensible; pass selected `gang_id`.

---

## 15. Alignment with existing systems

| System | Relationship |
|--------|----------------|
| Weekly plans | Same Mon 2 AM ET job window; independent content |
| Personal weekly challenges | Separate; wars use their own 5-exercise timed rotation |
| System gangs | Bots for filler matchups; not competition-eligible as humans |
| `eligible_for_gang_competitions` | Gate for human matching |
| Gang member cap | Soft balance for sum-based scoring |
| Reward crates | Floor-tier crates on win by division; all winning members |
| `gangs.banner_url` | Inner gang banner image; War frames it with a **division border** |

---

## 16. Acceptance criteria (v1)

- [ ] Eligible human gangs in a division are paired head-to-head; odd one out gets a bot.
- [ ] Matchups are reciprocal in data and UI.
- [ ] Daily 60s exercise is shared by both sides; unlimited attempts; top 2 per member per day per gang count.
- [ ] Attempts only apply to the War-tab-selected gang.
- [ ] Week score is the sum of member top-2 contributions (no averaging).
- [ ] Ties break by fewer members, then earliest attempt in the match.
- [ ] War UI emphasizes our score vs theirs; multi-gang selector when needed.
- [ ] New members can attempt as soon as they join a matched gang.
- [ ] Monday job resolves week, awards win crates to all winning members, promotes/demotes, creates next matchups; idempotent.
- [ ] No-gang and unmatched-gang states are clear.
- [ ] Iron cannot demote; Onyx cannot promote past Onyx.
- [ ] Bot difficulty increases with division via configured daily scores.
- [ ] Win crate tiers: Iron/Bronze Common, Silver Uncommon, Gold Rare, Emerald Epic, Diamond Legendary, Crystal/Onyx Mythic.
- [ ] Exercise rotation is a continuous 5-exercise cycle across weeks (not reset each Monday).
- [ ] No rematch avoidance.
- [ ] History lists past opponents, scores, win/loss, and division fought.
- [ ] During an active bot match, opponent totals only include bot day scores through today (ET).
- [ ] War bots always count as **1 member** for tie-breaks.
- [ ] Gangs show a **division border** around their banner picture based on current war division.
- [ ] New-matchup VS animation (our bordered banner vs theirs) plays once per user per match.
- [ ] Win and loss animations always play once after resolve (including Iron stay / Onyx stay).

---

## 17. Remaining open questions / build inputs

**Build inputs (content/numbers — can ship with placeholders):**

1. **Bot daily rep tables** — Exact predetermined scores per division × day (use provisional numbers for staging).
2. **Division border art** — Eight border treatments (Iron → Onyx); staging can use styled color frames until final assets.
3. **VS / promo animation production** — Final motion design from the reference still; staging can ship simplified overlays first.

Notifications remain out of scope for v1 (see §3).

---

## 18. Suggested build phases

1. Schema + matching + named bots + bot day targets + Monday rollover + division on gangs.  
2. Continuous exercise rotation + gang-scoped attempt submission + scoring + tie-break.  
3. War tab states + gang selector + scoreboard (progressive bot totals) + division borders + rep-counter entry.  
4. History view + crate grants on win (all members).  
5. Matchup VS animation + win/loss animations + seen-state persistence.  

**Environment:** Build and verify on **Staging** first; do not apply war migrations / edge jobs to Production until staging sign-off.
