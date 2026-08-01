# GainGang — Feature Ideas Todo

Status key: `[x]` done · `[~]` started / partial · `[ ]` not started

---

## 1. Reward System Additions

Design principle: keep rewards **cosmetic-first** so nothing feels mandatory to stay competitive — preserves the “treat” feeling of unboxing.

- [x] **Banners** — profile display cosmetic (crates, equip slot, profile/leaderboard)
- [x] **Titles** — text unlocks next to username
- [x] **Profile Picture Border** — cosmetic frame around avatar
- [x] **Crate / rarity system** — daily, level-up, and starter crates; E→S loot; inventory open/reveal
- [~] **Level Border** — schema, equip slot, and UI exist; currently deactivated (`0042`) and hidden from catalog
- [~] **Companions** — inventory “coming soon” tab only; no catalog, ownership, equip, or XP boost yet
- [ ] **Streak Saver** — consumable that retroactively counts one missed day as a streak-hit  
  - Open: earned vs bought vs both? Stockpile cap?

---

## 2. Weekly Challenges

Timed max-effort challenges (e.g. 1-minute max push-ups, max sit-ups, longest plank).

- [x] Individual leaderboard per challenge (world / my gangs / specific gang)
- [ ] Gang leaderboard (aggregate of member scores)
- [x] Weekly cadence / reset (Monday 2am ET via `rollover_weekly_challenges`)
- [x] **Pose verification** — camera required for all challenge attempts
- [x] Challenges tab + rotating types (push-ups → sit-ups → plank → squats → crunches)
- [x] Best-score-only entries; first attempt each week grants XP

**Open questions:**
- Do challenge results feed personal XP beyond first-attempt bonus? (currently first-attempt only)
- Gang aggregate leaderboard still TBD

---

## 3. Gang vs. Gang Competition (Gang ELO)

Gangs earn points for daily gang goals; points feed a ranking vs other gangs.

- [ ] Scoring model decision (true ELO zero-sum vs additive ladder)
- [ ] Gang vs Gang ranking / competition UX
- [ ] Wire scoring to daily gang-goal completion

**Open questions:**
- Zero-sum ELO (rivalry, punishes bad days) vs additive ladder (friendlier)?
- Replace or extend the existing “Gang vs. Gang” stretch roadmap item?

---

## 4. Gang Size Cap

- [x] **Max 25 members per Gang** — enforced in DB joins + app (`MAX_GANG_MEMBERS`); oversized gangs keep members but can’t accept new joins

**Open question:**
- Cap applies to new joins only today; any need to shrink existing oversized gangs?

---

## 5. Open Design Questions (still open)

1. Streak Saver: earned, bought, or both — and holding cap?
2. Companion XP boosts: scale with rarity/level? Stack with crate XP boosters?
3. Pose verification: all weekly challenge entries use camera (done for v1)
4. Weekly challenges: first-attempt XP only for now; separate from daily goal loop
5. Gang ELO: zero-sum or additive — replace or extend GvG roadmap item?
6. 25-person cap: retroactive shrink vs new joins only (current = new joins only)?
