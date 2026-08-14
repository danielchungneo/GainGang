# GainGang — Product Snapshot

**Last updated:** August 2026  
**Purpose:** Living reference of what the app *is* today — features, feeling, and white space — for brainstorming what comes next.

> Related docs: [`GainGang_Feature_Document.md`](./GainGang_Feature_Document.md) (original vision), [`FEATURE_TODO.md`](./FEATURE_TODO.md) (shipping backlog), [`GainGang_New_Feature_Ideas.md`](./GainGang_New_Feature_Ideas.md) (newer ideas). This snapshot reflects the **shipped / in-code product**, not only the original vision.

---

## 1. What GainGang is

**GainGang** is a social calisthenics app: train with a **Gang**, hit shared **daily goals**, verify effort with the **camera**, earn **XP / levels / cosmetics**, and optionally use **Focus lock** so distraction apps stay blocked until today’s work is done.

**One-line pitch (in product):**  
*“The social workout app that turns daily goals into a team game.”*

**Taglines in brand / docs:**  
*“Calisthenics. Community. Quest.”* · *“Calisthenics. Community. Goal.”*

**Who it’s for**  
Friends and small gangs doing bodyweight training who want **group accountability** more than a solo tracker. Fitness levels: Beginner / Intermediate / Advanced. Optional equipment (pull-up bar, weights) gates which plan exercises apply to you.

**Explicit inspirations**
| Inspiration | What GainGang borrows |
|---|---|
| **Strava** | Activity feed, kudos, comments, follows, leaderboards, group challenges |
| **Solo Leveling** | Quests/grind narrative, E→S ranks, system-window UI, progression theater |

---

## 2. Product feeling & brand

### Tone of voice
Warm gang energy with light RPG flavor — motivational without becoming pure parody.

Examples from the UI:
- *“Let's gain, {firstName}”* (Today)
- *“Join a Gang to get Goals”* / *“start your grind”* (empty state)
- *“Finish your gains”* / *“Complete today's exercises to unlock {appName}.”* (Focus lock shield)
- *“Companions… they'll hatch here”* / *“Badges are forging”* (placeholders that still fit the voice)

### Visual language
- **Dark-first** “system window” aesthetic (void navy `#05070F`, system blue `#4D8CFF`, quest violet `#9D4EDD`)
- Fonts: **Chakra Petch** (display), **JetBrains Mono** (stats), **Hanken Grotesk** (body)
- Rank fantasy: Awakened → Rising → Hunter → Elite → Monarch → Sovereign (brand), with E–S color tiers in tokens
- Glass surfaces, aura gradients, level badges, mono stats, celebration overlays (goal complete, streak continue, level-up, crate open)

### Emotional loop the app tries to create
1. **Belong** — you’re on a Gang with a shared plan  
2. **Do the work** — camera-verified (or manual) reps toward today  
3. **Be seen** — feed, kudos, pokes, leaderboards  
4. **Get paid in fantasy** — XP, levels, crates, cosmetics  
5. **Come back** — streaks, adaptive weekly plans, weekly challenges, optional Focus lock friction  

---

## 3. Core user journey

```
Pre-auth tour → Auth → Notifications + Join/Create gang
  → (Focus lock intro / equipment prompts as needed)
  → Tabs: Today | Gangs | Challenges | Profile
```

**Tabs**
| Tab | Job |
|---|---|
| **Today** | See today’s goals across your Gangs; start workouts; celebrate completions |
| **Gangs** | Hub: Progress / Activity / Leaderboard for the selected Gang |
| **Challenges** | Rotating weekly global challenge + leaderboards |
| **Profile** | Self profile, streak calendar, path to alerts & inventory |

---

## 4. Feature inventory (what exists today)

### 4.1 Auth & account
- Email/password sign-up & sign-in (Zod-validated), email verification, OAuth callback route
- Remember me + biometrics (SecureStore + Face ID / Touch ID)
- Google Sign-In UI present but **commented out** (setup tracked separately)
- Settings: theme (light/dark), push permission, Focus lock settings, sign out, app version
- OTA update modal live; force-store update modal temporarily disabled

### 4.2 Onboarding
- Pre-auth: welcome → fitness level + equipment → camera demo workout → Focus lock pitch → auth
- Demo can run push-ups/squats (etc.) with reward reveal / starter XP teaser
- Post-auth: notification permission → **must join or create a Gang** before main tabs
- Extra prompts for existing users: Focus lock intro, equipment (OTA)
- Pending invite codes survive auth and land on `/invite/[code]`

### 4.3 Gangs (social groups) — the heart of the product
- Create / join / browse; public + invite-only
- Invite via share/SMS with deep link (`gaingang://invite/[code]`) + HTTPS edge redirect
- Gang hub: **Progress**, **Activity**, **Leaderboard**
- Owner creates/edits **weekly plans** of daily goals by day
- **Adaptive plan rollover** — next week can copy/escalate when the Gang crushed the prior week
- Progress UI: day navigation; tap exercise → who contributed / who’s missing; **poke** inactive members
- Members sheet: roster, roles, kick (owner), jump to profiles
- Edit gang (banner, name, description, privacy); delete gang
- Size cap: **25** members
- Multi-Gang membership; Today aggregates goals across Gangs
- Equipment-aware planning: pull-ups/weights only for members who opted in

### 4.4 Daily goals & workouts
- Structured week vocabulary: Chest → Legs → Cardio → Back → Core
- Log via **camera rep counter** (primary path) or **manual log**
- **Workout mode (cycles)** — split the day’s target into N cycles; camera stops at per-cycle target
- Cross-Gang daily goal logic so one workout can apply thoughtfully across memberships
- Celebrations: goal complete, streak continue, level-up + crate claim

### 4.5 Camera rep counting (differentiator)
Supported exercises (pose ML on device):
- Push-ups, pull-ups, squats, lunges, sit-ups, crunches
- Plank (hold / seconds)

Setup UX: tips + tutorial videos; body-in-frame gating before counting starts.  
Challenge mode: timed max reps or max hold.  
Requires custom native client (not Expo Go). Stack: Vision Camera + MediaPipe BlazePose (platform-specific plugins).

### 4.6 Weekly challenges
- Global rotating weekly challenge; **camera required**
- Types include timed push-ups / sit-ups / squats / crunches and max plank
- Leaderboards: World / my Gangs / specific Gang
- Best score wins; first attempt grants XP
- Tab badge when you haven’t attempted this week

### 4.7 Social feed & profiles
- Gang activity feed with posts, **kudos**, **comments**
- One-way **follows** (mutual ≈ friends); followers can see personal logs (RLS)
- Own profile + other user profiles; edit avatar, name, bio, fitness, equipment
- Streak calendar on profile; personal activity history
- **Alerts** screen: kudos, comments, pokes, follows, gang/daily goal events, etc.
- Badges UI: placeholder (*“Badges are forging”*)

### 4.8 Progression & rewards
- XP from activity logs, personal/gang goal completion, crates, challenge attempts
- **Levels** from XP (primary UI progression; ~100 base +25/level)
- E–S ranks still in schema/thresholds; UI leans on numeric level + cosmetics
- **Daily completion crates** and **level-up crates**; starter cosmetic crates on signup path
- Inventory: open crates; equip **titles**, **avatar borders**, **banners**
- Level borders catalog deactivated; **Companions** tab is “coming soon”
- Reward reveal animations for goal / streak / level-up / crate open

### 4.9 Focus lock (iOS)
- Block distracting apps via Family Controls (`expo-app-blocker`)
- Unlock when today’s exercises are complete; shields lift for the day
- Android: stub / not really supported

### 4.10 Platform meta
- Expo + EAS, OTA updates (`expo-updates`)
- Push notifications (DB → edge `dispatch-push` → Expo tokens)
- Deep links for invites
- Dev animation playground; boilerplate `modal` route still a stub

---

## 5. Motivation design (how the pieces fit)

| Lever | Mechanism |
|---|---|
| **Accountability** | Shared daily totals, contributor sheets, pokes |
| **Verification** | Camera-counted reps for core calisthenics + challenges |
| **Extrinsic treats** | XP, crates, cosmetics (intentionally cosmetic-first) |
| **Habit friction** | Optional Focus lock until gains are done (iOS) |
| **Social proof** | Feed, kudos, comments, follows, leaderboards |
| **Escalation** | Adaptive weekly plan rollover when the Gang succeeds |
| **Fantasy identity** | Levels, ranks, titles, borders, banners, “system” UI |

---

## 6. Technical capabilities (feature enablers)

| Capability | Role in product |
|---|---|
| Supabase (Auth, Postgres, RLS, Storage, RPCs, cron-style jobs) | Source of truth for Gangs, plans, social, rewards |
| On-device pose ML | Trustworthy rep counting without a trainer watching |
| Edge functions | Invites redirect, push dispatch |
| Screen Time / Family Controls (iOS) | Focus lock |
| Biometrics + SecureStore | Frictionless return |
| Reanimated + haptics | Celebration / “system” feel |
| Payments / IAP (RevenueCat consumables) | Cred bundles (Hustle / Beast / Apex) — see `docs/IAP_SETUP.md` |
| **Not present today** | HealthKit / Google Fit |

---

## 7. Data model (mental model for product)

**People & social:** `profiles`, `follows`, `gangs`, `gang_members`, `notifications`, `push_tokens`  
**Goals & work:** `exercises`, `weekly_plans` → `daily_goals` → `daily_goal_exercises`, `activities` / `activity_exercises`  
**Social on posts:** `kudos`, `comments`  
**Progression:** `xp_awards`, crates (`user_reward_crates`), `cosmetic_items` / `user_cosmetics`  
**Challenges:** `challenge_types`, `weekly_challenges`, `challenge_entries`  
**Legacy / half-wired:** `quests` (product moved to weekly plans), `achievements` / `user_achievements` (schema + seed; little/no unlock UI)

**Units:** reps | seconds | miles  
**Cosmetic kinds:** title, avatar_border, banner (level_border deactivated)  
**Crate fantasy:** aura / E–S style rarity tiers  

---

## 8. Differentiators vs a generic fitness tracker

1. **Gang-first goals** — collective daily targets with individual quotas, not just personal logs  
2. **Camera-verified calisthenics** — on-device counting for the core movement set  
3. **RPG / Solo Leveling framing** — ranks, crates, aura UI, cosmetics as progression theater  
4. **Hard accountability tools** — poke laggards; Focus lock that blocks apps until work is done  
5. **Equipment-aware group planning** — one plan, different requirements per member  
6. **Adaptive weekly rollover** — the Gang’s success can raise next week’s bar  
7. **Social + loot without monetization** — feed and unboxing exist; no payments layer yet  
8. **Built-in calisthenics schedule language** — Chest / Legs / Cardio / Back / Core as product vocabulary  

---

## 9. Incomplete, stubbed, or transitional areas

Useful as brainstorming *constraints* and *easy wins*:

| Area | Status |
|---|---|
| Achievements / badges | Schema + seeds; UI placeholder; auto-award not wired |
| Companions | Inventory stub only (“hatch here”) |
| Google auth | Disabled / unfinished |
| Stick-figure exercise art, richer camera coaching | Planned / incomplete |
| Duel mode, Gang vs Gang / Gang ELO | Ideas, not shipped |
| Level-gated features | Idea |
| Streak saver consumable | Idea |
| Universal / deferred deep links for invites | Incomplete |
| Push deep-link polish & per-type prefs | Incomplete |
| Auto-poke scheduling | Manual poke only |
| Persist onboarding demo XP after signup | Incomplete |
| XP bar on Today | Commented out |
| Cardio: run/walk soft-hidden; jumping jacks without camera | Transitional catalog |
| `quests` vs weekly plans | Legacy dual model |
| README / ARCHITECTURE docs | Stale vs live product |
| Payments, wearables / Health sync | Not started |

---

## 10. White space for future brainstorming

Prompts grounded in what already exists — not a roadmap, just fertile ground:

### Deepen the Gang
- Gang vs Gang competition / seasons / ELO  
- Stronger roles (coach, captain), announcements, pinned quests  
- Auto-accountability (scheduled pokes, gentle shame / praise rituals)  
- Gang cosmetics, banners, shared “base” identity  

### Deepen verification & training quality
- More camera exercises; better coaching overlays / form cues  
- Substitutions & adaptive individual targets by fitness level  
- Cycles / programming templates beyond the 5-day skeleton  
- Offline / gym-mode logging when camera isn’t practical  

### Deepen progression fantasy
- Achievements that actually unlock  
- Companions with light mechanical hooks (or keep pure cosmetic)  
- Meaningful rank identity (E–S) in UI, not only XP number  
- Seasonal battles passes *without* breaking “cosmetic-first” ethics — or first paid layer  

### Deepen social graph
- Friends tab, DMs, duels, reaction richness beyond kudos  
- Cross-Gang discovery / public Gang browsing polish  
- Better invite growth (Universal Links, deferred installs)  

### Habit systems beyond Focus lock
- Android equivalent (or different friction)  
- Streak savers, rest days, deload weeks that don’t feel like failure  
- Morning “system quest” notification ritual  

### Platform & trust
- HealthKit / wearables as *secondary* proof, not replacement for camera culture  
- Moderation, privacy controls, under-13 / school gang scenarios  
- Monetization that doesn’t gut the gang fantasy  

### Meta questions (good for workshops)
1. Is GainGang primarily a **gang accountability product**, a **camera trainer**, or an **RPG fitness game** — and which should win when they conflict?  
2. Should cosmetics stay **purely cosmetic**, or is light power (XP boosts, streak shields) on-brand?  
3. What’s the ideal Gang size experience (today’s cap is 25) — tight friend group or small community?  
4. How much should weekly **global** challenges compete with **Gang-local** identity?  
5. Where does “verified effort” stop being motivating and start being friction?  

---

## 11. Screen map (quick reference)

| Area | Routes / surfaces |
|---|---|
| Tabs | `(tabs)/index` Today · `groups` Gangs · `challenges` · `profile` |
| Auth | `sign-in`, `sign-up`, `verify-email`, `auth/callback` |
| Onboarding | `onboarding/*`, `welcome-notifications`, `welcome-crew`, `welcome-focus-lock`, `welcome-equipment` |
| Gang | `gang/create`, `join`, `edit`, `new-goal`, `[id]`, `invite/[code]` |
| Workout | `log-daily-goal`, `log-activity`, `rep-counter` |
| Social | `activity/[id]`, `profile/[userId]`, `alerts` |
| Account | `settings`, `settings-screen-time`, `edit-profile`, `inventory` |

---

## 12. How to use this document

- **Brainstorming:** Start from §2 (feeling) + §8 (differentiators) + §10 (white space) so new ideas reinforce identity instead of diluting it.  
- **Prioritization:** Cross-check §9 and [`FEATURE_TODO.md`](./FEATURE_TODO.md) for unfinished foundations before inventing adjacent systems.  
- **Vision vs reality:** [`GainGang_Feature_Document.md`](./GainGang_Feature_Document.md) still describes aspirational “Quest” framing; this snapshot is closer to what’s in the repo (weekly plans, crates, Focus lock, challenges).  
- **Refresh:** Revisit after major ships; date the top of the file when you update.
