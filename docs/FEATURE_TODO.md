# Feature TODO — Running List

**Last updated:** 2026-07-18

Living checklist of planned product features. Mark items done as they ship; add new ideas at the bottom under **Backlog**.

---

## In progress / planned

### Rewards for completing daily tasks

- [x] Design reward loop for finishing daily goals (chests, spin wheels, etc.)
- [x] Define reward types and rarity / drop rates (flexible loot model; XP live)
- [x] Wire rewards to daily-task completion events
- [x] Build chest / wheel UI and open / spin animations
- [x] Persist claimed rewards and prevent double-claim
- [ ] Expand crate loot beyond XP (titles, banners, borders, XP boosts)

### Onboarding screens

- [x] Design first-run onboarding flow (value props, how GainGang works, camera/rep counting)
- [x] Build multi-step onboarding UI (skip / next / finish)
- [x] Persist completion so returning users skip onboarding
  - Pre-auth tour: AsyncStorage on device
  - Post-auth join/create crew: `profiles.onboarding_completed_at`
- [x] Gate after first launch (before sign-in); deep-link friendly if mid-invite join
- [x] Optional: request notification / camera permissions in context during onboarding
  - Camera required on push-up/squat demo step; push notifications optional on social step
- [x] Last pre-auth step is sign up / sign in; new accounts land on notifications then join/create crew
- [x] Camera demo → Great work / Collect Reward → RewardReveal animation
- [ ] Polish onboarding copy / motion; stick-figure art for demo empty states
- [ ] Universal Links handoff into onboarding mid-flow if needed
- [ ] Persist onboarding demo XP bonus to the account after sign-up

### Follow / friend other users

- [x] Spec follow vs friend model (one-way follow; mutual = friends badge)
- [x] Persist relationships (follow / unfollow; no request flow for one-way)
- [x] Surfacing: profile CTA, gang member lists, leaderboard, alerts, comments
- [x] Activity visibility: followers can read followees’ personal activity logs (RLS)
- [x] Follow notifications (in-app when someone follows you)
- [ ] Optional: search / discover users by username
- [ ] Optional: dedicated following feed outside gang feed

### View other users’ profiles

- [x] Profile route (`/profile/[userId]`) with relationship-aware access
- [x] Show avatar, name, level, streak, bio, follower counts
- [x] Activities / streak calendar (visibility via RLS + follow)
- [ ] Badges section + equipped cosmetics when those systems ship
- [x] Entry points from leaderboard, alerts, comments, gang members, activity cards
- [x] Distinguish own profile (edit / settings) from someone else’s (follow / unfollow)

### Stick figure pictures for exercises

- [ ] Create or source stick-figure art for each exercise
- [ ] Show stick figures in exercise pickers / goal cards / empty states
- [ ] Keep assets consistent with brand and dark/light themes

### Camera pop-up tooltips

- [ ] Add contextual tooltips during the rep-counter camera flow
- [ ] Cover setup cues (framing, distance, lighting) and mid-session tips
- [ ] Support dismiss / “don’t show again” where appropriate

### Cooler streak animation (first exercise of the day)

- [x] Design a stronger “streak continues” moment for the first completed exercise of the day
- [x] Implement animation (Reanimated) and hook into first-of-day completion
- [x] Align with existing level-up / goal-complete overlay patterns

### Better animation for completing reps

- [ ] Improve per-rep feedback (count bump, pulse, haptics, sound)
- [ ] Keep it readable under camera overlay without blocking pose tracking
- [ ] Tune timing so fast reps still feel responsive

### Duel mode

- [ ] Spec duel rules (1v1, scoring, time window, win conditions)
- [ ] Matchmaking / invite flow
- [ ] Live or async duel UI and result screen
- [ ] Persist duel history and rewards

### Achievements

- [ ] Define achievement catalog (streaks, volume, social, firsts, etc.)
- [ ] Track progress and unlock conditions
- [ ] Achievement unlock UI / badge display on profile
- [ ] Optional notifications when an achievement unlocks

### Video tips — phone placement on the floor

- [ ] Produce or source short tip videos for floor phone placement
- [ ] Surface tips before / during camera setup for floor-based exercises
- [ ] Support skip and replay from settings or help

### Google auth

- [ ] Configure Google OAuth (Google Cloud + Supabase / Expo)
- [ ] Add “Continue with Google” to sign-in / sign-up flows
- [ ] Link Google identity to existing accounts where needed
- [ ] Handle session restore and sign-out for Google users

### Push notifications / in-app alerts

- [x] Define core alert types (kudos, comments, pokes, gang daily goal complete)
- [x] Auto-create in-app notifications via DB triggers / poke RPC
- [x] Alerts screen + unread badge on Profile tab
- [x] Store Expo push tokens (`push_tokens` + `register_push_token`)
- [x] Settings toggle to request push permission
- [x] Scaffold `dispatch-push` edge function for Expo delivery
- [x] Wire notifications INSERT → `dispatch-push` (pg_net trigger)
- [ ] Deep-link polish + richer per-type notification preferences
- [ ] Optional: reminders / achievements / rank-up alerts
- [ ] Harden `dispatch-push` (shared secret / re-enable JWT verify)

### Poke inactive gang members

- [x] Define “inactive” rules (e.g. missing today’s exercises by X time)
- [ ] Schedule or trigger automatic pokes for gang members who haven’t completed goals
- [x] In-app poke UX (send from Progress tab contributor sheet)
- [x] In-app poke alerts (notifications row + Alerts screen)
- [x] Push delivery path when notifications are enabled (token + dispatch trigger)
- [x] Rate-limit pokes and avoid spam / duplicate nudges
- [x] Gang visibility of who contributed vs still needed (Progress exercise sheet)

### Crate rewards

- [ ] Title unlocks (catalog, drop rates, equip on profile)
- [ ] Profile banner unlocks
- [ ] Profile border unlocks
- [ ] Level icon border unlocks
- [ ] XP boosts (duration, stacking rules, apply to earned XP)
- [ ] Persist owned / equipped cosmetics and active boosts
- [ ] Surface new unlocks in crate-open UI and inventory / profile customize

### Level-gated features

- [ ] Define which app features unlock at which levels
- [ ] Gate access in UI (locked state, level requirement, teaser)
- [ ] Enforce unlock checks server-side where it matters
- [ ] Celebrate unlocks on level-up (copy + deep link into the new feature)

### Auto-generate next weekly plan

- [x] Schedule an automated job at the start of each week (cron / scheduled edge function)
- [x] Generate each gang’s new weekly plan from the previous week’s plan
- [x] Copy exercise structure and targets; decide how to handle missing / edited prior weeks
- [x] Skip gangs that already have a plan for the upcoming week
- [x] Adaptive mode: bump targets when the gang completes every exercise every day
- [ ] Notify gang or allow review / tweak before the week starts (optional)

### Gang screen — daily progress view (progress tag)

- [x] Replace sideways-scrolling nav cards with a single-day progress view
- [x] Add previous / next day arrow controls to move between days
- [x] Make exercise progress cards tappable
- [x] On tap, show who in the gang has contributed and who still needs to
- [x] Allow poking members who haven’t contributed yet (send encouragement notification)
- [x] Align with existing poke / in-app alert work (push webhook still pending)

### Share gang invite via text

SMS / Messages share of a gang invite link. Opens a confirm/reject join screen if GainGang is installed; otherwise points to the App Store when configured.

- [x] Add “Invite” action on the Gangs tab for all gangs (uses existing `invite_code` under the hood)
- [x] Generate an invite deep link (`gaingang://invite/[code]`) and native share sheet / SMS message
- [x] Deep link open: route to confirm / reject join screen with gang preview
- [x] Persist pending invite across sign-in so new users land back on confirm after auth
- [x] Remove typed invite-code UX (public discover remains; invite-only is link-only)
- [ ] Set `EXPO_PUBLIC_APP_STORE_URL` once published so share copy includes App Store download link
- [ ] Universal Links / Associated Domains so https invites open the app (or App Store) automatically
- [ ] Post-install deferred deep link handoff if the user installs from the store first

---

### Leaderboard — split by metric + avatars

- [x] Separate rankings for reps vs distance (miles) so unlike units aren’t compared
- [x] Show each member’s profile picture on leaderboard rows
- [ ] Optional: time / holds board for `seconds` exercises (e.g. plank)

---

## Backlog

*Add new feature ideas below as they come up.*

### Workout mode on daily card

- [x] Add a "workout mode" option on the daily card where the user selects how many cycles to split their workout into
- [x] Divide each exercise's total reps evenly across the chosen cycles (e.g. 20 push-ups ÷ 2 cycles = 10 reps per cycle; 30 push-ups ÷ 2 cycles = 15 reps per cycle)
- [x] Camera-based rep counter counts up to the per-cycle rep limit instead of running unlimited
- [x] Auto-save reps and advance to the next exercise screen once the per-cycle rep limit is hit

### Bug: refresh indicator at top of main screen

- [ ] Reproduce and diagnose the refresh indicator issue at the top of the app's main screen
- [ ] Fix indicator so it only shows / spins during an actual refresh
- [ ] Verify across iOS and Android

### Hand gesture controls for camera rep counter

- [ ] Detect specific hand gestures (e.g. thumbs up, OK sign, thumbs down) while the camera rep counter is active
- [ ] Map each gesture to an action: accept reps and advance to next exercise, confirm current reps, or exit the exercise
- [ ] Goal: hands-free experience so users never have to leave position to tap the phone during a workout

