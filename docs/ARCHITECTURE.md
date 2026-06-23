# Architecture

The blueprint for GainGang — a social calisthenics app with glassmorphism UI,
Supabase auth, and a production-ready structure. (Scaffolded from a shared Expo
boilerplate.)

---

## Stack Overview

| Layer | Technology |
|---|---|
| Framework | React Native via Expo SDK 56 |
| Routing | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind CSS for RN) |
| Auth | Supabase Auth |
| Data fetching | TanStack React Query |
| Forms | React Hook Form + Zod |
| Animations | React Native Reanimated |
| Native blur | expo-blur (iOS only; simulated on Android/Web) |
| Icons | expo-symbols (iOS SF Symbols) + @expo/vector-icons + Lucide |
| Storage | expo-secure-store (credentials) + AsyncStorage (session) |
| Biometrics | expo-local-authentication |

---

## File Structure

```
.
├── app/                          # Expo Router file-based routes
│   ├── (auth)/                   # Auth route group (unauthenticated)
│   │   ├── _layout.tsx           # Stack layout, redirects out if authed
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/                   # Main app tab group (authenticated)
│   │   ├── _layout.tsx           # Bottom tab navigator
│   │   ├── index.tsx             # Today tab (daily individual + group goals)
│   │   ├── groups.tsx            # Groups tab (join / create crews)
│   │   └── settings.tsx          # Settings tab (sign out)
│   ├── _layout.tsx               # Root layout — providers, theme, stack
│   ├── index.tsx                 # Entry gate (auth → tabs, else → sign-in)
│   └── modal.tsx                 # Reusable modal pattern
├── components/
│   ├── ui/                       # Reusable UI primitives
│   │   ├── glass-surface.tsx     # Android/Web glass card
│   │   ├── glass-surface.ios.tsx # iOS native blur glass card
│   │   ├── icon-symbol.tsx       # Cross-platform icon wrapper
│   │   ├── icon-symbol.ios.tsx   # iOS SF Symbols variant
│   │   ├── screen-background.tsx # Glass screen shell (blobs/orbs)
│   │   └── collapsible.tsx       # Expand/collapse content
│   ├── themed-text.tsx           # Text with automatic theme colors
│   ├── themed-view.tsx           # View with automatic theme colors
│   ├── haptic-tab.tsx            # Bottom tab button with haptic press
│   ├── external-link.tsx         # In-app browser link
│   └── parallax-scroll-view.tsx  # Scroll view with parallax header
├── constants/theme.ts            # Color + glass design tokens
├── context/
│   ├── auth-context.tsx          # Auth session state (useAuth hook)
│   └── query-client.tsx          # React Query client setup
├── hooks/
│   ├── use-auth.ts               # Re-export of useAuth
│   ├── use-theme-color.ts        # Returns color value for current theme
│   ├── use-color-scheme.ts       # Native color scheme hook
│   └── use-color-scheme.web.ts   # Web color scheme hook
├── lib/supabase.ts               # Supabase client singleton
├── types/                        # Supabase + shared types
├── utils/                        # Small helpers (cn)
├── assets/images/                # icon.png, splash-icon.png, etc. (add your own)
├── global.css                    # Tailwind CSS entry point
├── tailwind.config.js
├── metro.config.js
├── tsconfig.json
├── app.json
└── .env.example
```

### Naming conventions

- Directories: `kebab-case`
- Components/screens: `PascalCase` exports, `kebab-case` filenames
- Platform-specific files: append `.ios.tsx` for iOS-only variants
- Hooks: `use-` prefix, `kebab-case` filename
- Path alias: `@/` maps to project root (`tsconfig.json` `paths`)

---

## Configuration Files

### `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  }
}
```

### `.env.example`

```bash
# Supabase project URL (Settings → API → Project URL)
EXPO_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co

# Supabase anon/public key (Settings → API → anon public)
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

`EXPO_PUBLIC_`-prefixed vars are bundled into the client and read via
`process.env.EXPO_PUBLIC_*`.

---

## Auth Architecture

### Supabase client — `lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

### Session state — `context/auth-context.tsx`

- Wraps `AuthProvider` around the root layout.
- Exposes `useAuth()` → `{ session, isPending }`.
- Listens to `supabase.auth.onAuthStateChange` for real-time session updates.

### Sign-in screen features

- Email + password form with Zod validation (password min 8 chars).
- "Remember me" → saves credentials to `expo-secure-store`.
- Biometric auth (Face ID / Touch ID) via `expo-local-authentication`:
  - Checks hardware availability + enrollment before showing the option.
  - Loads saved credentials from secure store, then authenticates biometrically.

Secure store key: `'auth_saved_credentials'` → `JSON.stringify({ email, password })`.

### Route protection

- `app/index.tsx` is the entry gate: authenticated → `/(tabs)`, otherwise → `/(auth)/sign-in`.
- `app/(auth)/_layout.tsx` redirects authenticated users away from the auth screens.

---

## Navigation Architecture

### Route groups

```
app/
├── _layout.tsx          ← Root: Stack + ThemeProvider + QueryProvider + AuthProvider
├── index.tsx            ← Entry gate (redirects based on session)
├── (auth)/
│   ├── _layout.tsx      ← Stack, header hidden, redirect if authed
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (tabs)/
│   ├── _layout.tsx      ← Bottom tabs with haptic press
│   ├── index.tsx        ← Today
│   ├── groups.tsx       ← Groups
│   └── settings.tsx     ← Settings (sign out)
└── modal.tsx            ← Presented as modal
```

`HapticTab` triggers `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on iOS press.

---

## Key Patterns & Conventions

1. **Glassmorphism in both themes** — light uses frosted white; dark uses dark navy with neon cyan glow. Never render a plain opaque card; use `GlassSurface`.

2. **Decorative background is required** — wrap screens in `ScreenBackground` so the blur has colour to refract.

3. **`GlassSurface` is self-contained** — it handles theme detection internally. Never pass a `colorScheme` prop to it.

4. **Import tokens, never hard-code** — always use `Glass.*` and `DarkGlass.*` from `@/constants/theme`.

5. **Detect theme at the component level** — call `useColorScheme()` where needed; do not thread it down as props.

6. **Platform-specific files over runtime checks** — prefer `.ios.tsx` file variants over `Platform.OS === 'ios'` branches.

7. **Styling hybrid** — use `className` (NativeWind) for layout/spacing/typography; use `style` / `StyleSheet` for dynamic values and token colours.

8. **Form validation pattern** — every form uses `react-hook-form` + `zodResolver`. Define the Zod schema at the top of the file and display `errors.field.message` under each input.

9. **React Query for all server state** — wrap the root with `QueryProvider`. Use `useQuery` for reads and `useMutation` for writes; never fetch directly in `useEffect`.

10. **Typed routes** — Expo Router typed routes are enabled. Use string literals that match the file paths (e.g. `router.replace('/(tabs)')`).
