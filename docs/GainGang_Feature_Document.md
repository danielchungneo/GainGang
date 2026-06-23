# GainGang — Product Feature Document

**Version 1.0 | June 2026**
*Calisthenics. Community. Quest.*

---

## 1. Product Overview

GainGang is a social calisthenics fitness app inspired by Strava and the anime Solo Leveling. It combines community accountability, gamified quest mechanics, and progressive workout difficulty to motivate users through group-based goals rather than solo effort.

The core loop: join a Gang (group), receive daily and weekly Quests, log your activities, earn rewards, and level up alongside your community.

---

## 2. Inspiration & Design Pillars

### Strava
Social activity feed, kudos system, group challenges, leaderboards, and personal activity logging form the social backbone of GainGang.

### Solo Leveling
The anime's progression system — daily quests issued by a mysterious system, increasing difficulty tiers, and the grind from weak to elite — directly inspires the Quest framework, leveling mechanics, and visual language of the app.

### Key Design Pillars
- **Community over solo** — every feature should reinforce group accountability
- **Progression feels earned** — difficulty and rewards scale meaningfully
- **Fun & approachable** — not intimidating, welcoming to all fitness levels
- **Gamified but grounded** — quests feel exciting without losing sight of real fitness goals

---

## 3. Core Features

### 3.1 Authentication & User Profiles

Users create accounts and maintain a persistent profile that tracks their progress, achievements, and group memberships.

| Feature | Description |
|---|---|
| Sign Up / Login | Email/password and OAuth (Google, Apple) authentication |
| User Profile | Display name, avatar, bio, fitness level, join date, and stat summary |
| Fitness Level | Beginner / Intermediate / Advanced — set on onboarding, updated by progression |
| Stats Dashboard | Total reps logged, quests completed, active streak, achievements earned |
| Settings | Notification preferences, privacy controls, linked accounts |

---

### 3.2 Gangs (Groups)

Gangs are the social heartbeat of GainGang. Every user belongs to at least one Gang, and Quests are issued at the Gang level.

| Feature | Description |
|---|---|
| Create a Gang | Set a name, description, icon, and privacy setting (public / invite-only) |
| Join a Gang | Browse public Gangs or enter an invite code to join private ones |
| Gang Profile | Member roster, active quest progress, leaderboard, and activity feed |
| Gang Size | Recommended 5–30 members for tight accountability; larger Gangs supported |
| Multiple Gangs | Users may belong to more than one Gang simultaneously |
| Gang Admin | Founder/admin roles can manage members, set quest difficulty, and pin announcements |

---

### 3.3 Quests (Group & Individual Goals)

Quests are the primary goal structure of GainGang, directly inspired by Solo Leveling's daily quest system. Each quest has both a collective Gang target and an individual contribution requirement.

| Feature | Description |
|---|---|
| Daily Quests | Issued each morning — a specific rep/set target for the day (e.g. 200 push-ups as a Gang, 20 individually) |
| Weekly Quests | Larger collective challenges that span 7 days, requiring consistent contribution |
| Gang Quest Target | The total reps/sets the full group must achieve collectively to complete the Quest |
| Individual Target | A personal contribution quota assigned to each member (scales by fitness level) |
| Quest Completion | Quest is marked complete only when both the Gang total AND individual minimums are met |
| Quest Failure | Missing a Quest breaks the Gang streak and triggers a consequence (e.g. no reward spin, streak reset) |
| Quest Types | Rep-based (push-ups, sit-ups, squats), time-based (plank holds), or combo challenges |
| Quest Naming | Quests have Solo Leveling-inspired titles (e.g. "The Iron Oath", "Gang of a Hundred") |

---

### 3.4 Weekly Workout Schedule

GainGang follows a structured 5-day weekly schedule. Each day is assigned a muscle group category. The Gang leader selects specific exercises from that day's category, and all members must complete the chosen workouts as part of the daily Quest.

This keeps the program intentional and recovery-conscious — no two consecutive days hammer the same muscle groups, and cardio mid-week acts as active recovery between the heaviest lifting days.

| Day | Category | Focus |
|---|---|---|
| Day 1 | Chest | Push-based movements targeting the chest |
| Day 2 | Legs | Lower body strength and explosiveness |
| Day 3 | Cardio | Distance-based travel (run, walk, bike, etc.) |
| Day 4 | Back | Pull-based movements targeting the back |
| Day 5 | Core | Full trunk stability and abdominal strength |

**How it works:**
- The **Gang leader** selects specific exercises from each day's category each week
- Selected exercises become the **daily Quest** that all members must complete
- Members log their reps/distance to contribute toward both their individual target and the Gang's collective Quest total
- The exercise pool for each category will grow over time and can be browsed in-app

**Recovery rationale:**
- Chest → Legs avoids back-to-back upper body fatigue
- Cardio on Day 3 provides active recovery between the two heaviest days
- Back on Day 4 is fully fresh after the cardio break
- Core closes the week — the core assists every other day, so dedicating it last ensures it's never pre-fatigued during major lifts

---

### 3.5 Activity Logging

Users log their workouts to contribute to Quest progress and share with their Gang feed.

| Feature | Description |
|---|---|
| Log an Activity | Record exercise type, rep count, sets, duration, and optional notes |
| Quick Log | One-tap logging for common exercises with smart defaults |
| Photo Attachment | Optional photo upload to accompany an activity post |
| Quest Contribution | Logged reps automatically count toward active daily and weekly Quest totals |
| Activity Feed | Gang members see each other's logged activities in a chronological social feed |
| Activity History | Full personal log history with filtering by exercise type and date range |

---

### 3.6 Social — Kudos & Comments

Inspired by Strava's engagement model, GainGang keeps members encouraged through lightweight social interaction.

| Feature | Description |
|---|---|
| Kudos | Tap to give a kudos (like) to any Gang member's logged activity |
| Comments | Leave a comment on any activity post — text-based with emoji support |
| Notifications | Push notifications for kudos and comments on your activities |
| Mention | @mention a Gang member in a comment to tag them directly |
| Reactions | Optional expansion: tiered reaction types (Fire, Respect, Beast Mode) |

---

### 3.7 Achievements

A persistent achievement system rewards milestones and consistency, giving users long-term goals beyond daily quests.

| Feature | Description |
|---|---|
| Quest Achievements | First Quest complete, 10 Quests, 50 Quests, 100 Quests, etc. |
| Streak Achievements | 7-day, 30-day, 100-day personal and Gang streaks |
| Rep Milestones | 1,000 reps, 10,000 reps, 100,000 reps total logged |
| Social Achievements | First kudos given, 100 kudos given, first comment |
| Gang Achievements | Gang unlocks collective badges displayed on the Gang profile |
| Rare Achievements | Hidden achievements for exceptional feats (solo completion, perfect month) |
| Badge Display | Achievements display as badges on user profiles and Gang profiles |

---

### 3.8 Incentives & Reward System

Completing Quests and hitting milestones unlocks tangible in-app rewards to reinforce the grind.

| Feature | Description |
|---|---|
| Quest Completion Rewards | XP points and in-app currency awarded on Quest completion |
| Reward Spin Wheel | After completing a Quest, users spin a prize wheel for bonus rewards (extra XP, avatar items, badge flair, streak shields) |
| Streak Shields | Earnable items that protect a streak from a single missed day |
| Avatar Customization | Unlock avatar frames, titles, and cosmetic items through rewards |
| Gang Rewards | Gangs that maintain long streaks unlock exclusive Gang badge variants |
| XP & Levels | XP accumulates toward user levels (E-Rank to S-Rank, Solo Leveling-inspired) |

---

### 3.9 Difficulty Progression

GainGang adapts Quest difficulty over time so the challenge grows with the user, preventing plateau and keeping the experience fresh.

| Feature | Description |
|---|---|
| Fitness Tiers | E / D / C / B / A / S rank — each tier increases Quest volume and complexity |
| Auto-Progression | Consistent Quest completion triggers a tier promotion after a threshold period |
| Individual Scaling | Individual Quest targets scale to each member's current tier, not a flat group number |
| Gang Difficulty Setting | Gang admins can set an overall Quest difficulty baseline for the group |
| Progression Notifications | Users are notified and celebrated when they rank up |
| Demotion Protection | Users do not demote from inactivity alone — only through extended streaks of failure |

---

### 3.10 Group Leaderboards

Friendly competition within Gangs drives engagement and surfaces top performers.

| Feature | Description |
|---|---|
| Daily Leaderboard | Ranks Gang members by reps logged today |
| Weekly Leaderboard | Ranks Gang members by total Quest contributions this week |
| All-Time Leaderboard | Cumulative rep count across a member's history in the Gang |
| Quest Completion % | Shows each member's individual completion rate for accountability |
| Gang vs. Gang | Future feature — cross-Gang leaderboard for public Gangs |

---

## 4. Future / Stretch Features

The following features are on the roadmap but not scoped for initial release:

- Gang vs. Gang challenges — head-to-head collective Quest battles between two Gangs
- Custom Quest creation — Gang admins define their own Quest types and targets
- Video activity posts — short workout clip attachments to activity logs
- Rest day quests — lighter mobility/stretching quests for recovery days
- Coach role — designated Gang member who can adjust member difficulty tiers
- Apple Health / Google Fit integration — auto-import workout data
- Public Gang discovery — browse and join trending Gangs by category

---

## 5. Technical Considerations

Stack decisions TBD based on boilerplate scaffolding. Key requirements:

- Real-time activity feed updates (WebSocket or push-based)
- Push notifications for kudos, comments, and Quest reminders
- Image upload support for activity posts
- Scalable group data model to support Gang quest aggregation
- Secure auth with OAuth support (Google, Apple)

---

## 6. Glossary

| Term | Definition |
|---|---|
| Gang | A group of users who share Quests and an activity feed |
| Quest | A timed workout challenge with both collective and individual targets |
| Rep | A single unit of exercise (one push-up, one sit-up, etc.) |
| Kudos | A positive reaction given to another member's activity post |
| Streak | Consecutive days or quests completed without missing |
| Rank | User progression tier from E (beginner) to S (elite) |
| Spin Wheel | A reward mechanic triggered on Quest completion with randomized prizes |
| XP | Experience points accumulated through activity and Quest completion |
