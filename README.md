# GainGang

A social calisthenics workout app. Users join groups, receive daily individual
and group goals, and keep each other accountable through community encouragement.

> Scaffolded from an internal Expo boilerplate — same stack, tooling, and
> conventions, rebranded and cleaned out for GainGang.

## Stack

| Layer | Technology |
|---|---|
| Framework | React Native via Expo SDK 56 |
| Routing | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| Auth | Supabase Auth (email/password + biometric sign-in) — _see TODO below_ |
| Data fetching | TanStack React Query |
| Forms | React Hook Form + Zod |
| Animations | React Native Reanimated |
| Native blur | expo-blur (iOS native; simulated on Android/Web) |
| Icons | expo-symbols (SF Symbols) + @expo/vector-icons + Lucide |
| Storage | expo-secure-store + AsyncStorage |
| Biometrics | expo-local-authentication |

> **TODO — backend/auth provider:** The boilerplate ships with Supabase, which
> fits GainGang well (auth + Postgres + realtime for groups, goals, and the
> encouragement feed). Confirm this choice, then fill in `.env` and define the
> schema (see `types/database.ts`). If you switch providers, update
> `lib/supabase.ts` and `context/auth-context.tsx`.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
#   then fill in your backend (Supabase) URL + anon key

# 3. Start the dev server
npm run start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with
Expo Go.

### Environment variables

See `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Scripts

| Command | Description |
|---|---|
| `npm run start` | Start the Expo dev server |
| `npm run ios` | Start and open the iOS simulator |
| `npm run android` | Start and open the Android emulator |
| `npm run web` | Start the web build |
| `npm run lint` | Lint with eslint-config-expo |
| `npm run typecheck` | Type-check with `tsc --noEmit` |

## Project structure

```
.
├── app/                      # Expo Router routes
│   ├── (auth)/               # Unauthenticated flow (redirects out if signed in)
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx       # Email/password + biometric sign-in
│   │   └── sign-up.tsx
│   ├── (tabs)/               # Authenticated tab navigator
│   │   ├── _layout.tsx
│   │   ├── index.tsx         # Today — daily individual + group goals
│   │   ├── groups.tsx        # Groups — join / create crews
│   │   └── settings.tsx      # Account + sign out
│   ├── _layout.tsx           # Root: providers + theme + stack
│   ├── index.tsx             # Entry gate (auth → tabs, else → sign-in)
│   └── modal.tsx             # Reusable modal pattern (repurpose or remove)
├── components/
│   ├── ui/                   # Reusable primitives (glass surface, icons, etc.)
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   ├── haptic-tab.tsx
│   ├── external-link.tsx
│   └── parallax-scroll-view.tsx
├── constants/theme.ts        # Color + glass design tokens
├── context/                  # Auth + React Query providers
├── hooks/                    # Theme / color-scheme / auth hooks
├── lib/supabase.ts           # Supabase client singleton
├── types/                    # Domain models + backend (Supabase) types
├── utils/                    # Small helpers (cn, etc.)
├── docs/                     # Architecture, design system, stack notes
└── assets/images/            # App icons & splash (add your own — see README there)
```

## What's next (GainGang TODOs)

The screens are clean starting points with empty states — no sample data. To
bring GainGang to life:

- **Backend:** confirm Supabase (or your provider), set `.env`, and create the
  schema outlined in `types/database.ts`.
- **Today (`app/(tabs)/index.tsx`):** load the user's `DailyGoal`, today's
  `GroupGoal`(s), and the `Encouragement` feed via React Query.
- **Groups (`app/(tabs)/groups.tsx`):** list the user's groups; build the
  create-group and join-with-code flows.
- **Branding:** drop app icons/splash into `assets/images/` (see its README) and
  wire them up in `app.json`.

## Conventions

- **Directories:** `kebab-case`. **Components:** `PascalCase` export, `kebab-case` file.
- **Path alias:** `@/` maps to the project root (see `tsconfig.json`).
- **Platform variants:** use `.ios.tsx` files instead of runtime `Platform.OS` checks.
- **Theming:** import tokens from `@/constants/theme`; detect the scheme with `useColorScheme()`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for the full conventions, and
[`docs/STACK_NOTES.md`](docs/STACK_NOTES.md) for the reasoning behind the stack.

## Renaming / branding

App name, slug, and scheme live in `app.json`; package name in `package.json`.
