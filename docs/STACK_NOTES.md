# React Native Starter Stack Notes

Background on why this boilerplate picks the tools it does, plus optional
additions to reach for as a project grows. Treat this as a starting point, not a
strict rulebook — evaluate every tool against your project's real needs.

---

## Core choices (used in this repo)

### Framework — Expo
- Officially recommended in the React Native docs.
- Simplifies setup, builds, deployment, and native APIs (no custom native plumbing).

### Language — TypeScript
- Improves reliability, IDE support, and long-term maintainability.
- Strict mode is enabled in `tsconfig.json`.

### Navigation — Expo Router
- File-based routing built on top of React Navigation.
- Layouts, route groups, typed routes, and web support out of the box.

### Styling — NativeWind
- Tailwind-style utilities for React Native; pairs well with AI-assisted development.
- See `docs/DESIGN_SYSTEM.md` for the glassmorphism token system.

### Server state — TanStack Query
- The default for API data: caching, refetching, and background updates.

### Forms — React Hook Form + Zod
- Performant forms with schema-based validation and full type inference.

### Animations — React Native Reanimated
- Best-in-class performance for gestures and animations.

### Auth — Supabase
- Postgres + auth + storage as a managed backend; the client talks to it directly
  via `@supabase/supabase-js`.

---

## Optional additions (reach for as needed)

| Need | Recommended |
|---|---|
| Client/app state | **Zustand** (simple store) for anything beyond React Context |
| Fast key–value storage | **react-native-mmkv** |
| Large lists | **FlashList** (drop-in FlatList replacement) |
| Images | **expo-image** (optimized loading + caching) — already installed |
| Camera | **react-native-vision-camera** |
| Gestures | **react-native-gesture-handler** — already installed |
| Animations (simpler API) | **Moti** (built on Reanimated) |
| Local-first / sync | **Legend State**, SQLite, or Supabase realtime |
| Error monitoring | **Sentry** or similar |
| E2E / UI testing | **Maestro** |
| Component testing | **React Native Testing Library** |
| CI/CD + OTA updates | **Expo EAS** (cloud builds, store submission, updates) |

---

## Takeaways

- React Native is production-ready and mature; the ecosystem has converged on
  strong defaults.
- UI & styling is the most subjective area — this repo opts for NativeWind +
  a glassmorphism token system, but the architecture doesn't depend on that choice.
- Add libraries when a real need appears, not preemptively.
