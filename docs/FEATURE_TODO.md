# Feature TODO — Running List

**Last updated:** 2026-07-14

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

- [ ] Design first-run onboarding flow (value props, how GainGang works, camera/rep counting)
- [ ] Build multi-step onboarding UI (skip / next / finish)
- [ ] Persist completion so returning users skip onboarding
- [ ] Gate after sign-up / first launch; deep-link friendly if mid-invite join
- [ ] Optional: request notification / camera permissions in context during onboarding

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

_Add new feature ideas below as they come up._

-
