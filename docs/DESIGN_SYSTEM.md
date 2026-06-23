# Design System

Use this document as context when generating UI code for this project.

---

## Stack

- **React Native** with **Expo** (SDK 56)
- **NativeWind v4** (Tailwind CSS for React Native) for utility-class styling
- **expo-blur** for native iOS blur effects
- Mix of `className` (NativeWind) and inline `style` / `StyleSheet` where conditional logic requires it

---

## Theming Philosophy

Both themes use **glassmorphism** — the aesthetic differs by mode:

|  | Light | Dark |
|---|---|---|
| **Style** | Frosted white glass (Liquid Glass) | Dark neon glassmorphism |
| **Background** | `#f0f9ff` (sky-50) + soft colour blobs | `#06061a` (deep navy-black) + neon glow orbs |
| **Surfaces** | `GlassSurface` — semi-transparent white | `GlassSurface` — dark navy with neon cyan border glow |
| **Inputs** | Semi-transparent white, white border | Deep navy tint, neon cyan border |
| **Primary button** | Solid `#0284c7` (sky-blue) | Neon cyan `#00d4ff` with cyan shadow glow |
| **Accent colour** | `#0284c7` sky-blue | `#00d4ff` neon cyan |
| **Text** | Slate-800 / slate-600 | `#e2e8f0` / `#94a3b8` |

Always detect the active scheme with `useColorScheme()` from `react-native` and branch on `isLight = colorScheme !== 'dark'`.

`GlassSurface` is used in **both themes** — it auto-detects the color scheme internally and applies the correct style variant.

---

## Colour Palette

### Brand / Primary (sky-blue — light mode accents)

| Token | Hex | NativeWind class |
|---|---|---|
| primary-50 | `#f0f9ff` | `bg-primary-50` |
| primary-100 | `#e0f2fe` | `bg-primary-100` |
| primary-200 | `#bae6fd` | `bg-primary-200` |
| primary-300 | `#7dd3fc` | `bg-primary-300` |
| primary-400 | `#38bdf8` | `bg-primary-400` |
| **primary-500** | `#0ea5e9` | `bg-primary-500` |
| **primary-600** | `#0284c7` | `bg-primary-600` ← primary action (light mode) |
| primary-700 | `#0369a1` | `bg-primary-700` |
| primary-800 | `#075985` | `bg-primary-800` |
| primary-900 | `#0c4a6e` | `bg-primary-900` |

### Neon (dark mode accents)

| Token | Hex | NativeWind class |
|---|---|---|
| **neon-cyan** | `#00d4ff` | `bg-neon-cyan` / `text-neon-cyan` ← primary action (dark mode) |
| neon-purple | `#a855f7` | `bg-neon-purple` |
| neon-blue | `#6366f1` | `bg-neon-blue` |
| neon-cyan-dim | `rgba(0,212,255,0.15)` | `bg-neon-cyan-dim` |
| neon-purple-dim | `rgba(168,85,247,0.12)` | `bg-neon-purple-dim` |

### Dark base surfaces (dark mode)

| Token | Value | NativeWind class |
|---|---|---|
| dark-base | `#06061a` | `bg-dark-base` — page background |
| dark-surface | `rgba(6,10,35,0.72)` | `bg-dark-surface` — glass card |
| dark-border | `rgba(0,212,255,0.22)` | `border-dark-border` — glass border |

---

## Design Tokens (`constants/theme.ts`)

Always import tokens from `@/constants/theme` — never hard-code rgba values.

### Light glass tokens (`Glass`)

```ts
Glass.surfaceBg       = 'rgba(255, 255, 255, 0.68)'  // frosted card background
Glass.surfaceBorder   = 'rgba(255, 255, 255, 0.85)'  // card hairline border

Glass.inputBg         = 'rgba(255, 255, 255, 0.50)'  // input field fill
Glass.inputBorder     = 'rgba(255, 255, 255, 0.75)'  // input border

Glass.buttonBg        = 'rgba(255, 255, 255, 0.40)'  // secondary / outline button fill
Glass.buttonBorder    = 'rgba(255, 255, 255, 0.65)'  // secondary button border

Glass.textPrimary     = '#1e293b'                     // slate-800 — headings on glass
Glass.textSecondary   = '#475569'                     // slate-600 — body / labels on glass
Glass.textPlaceholder = 'rgba(71, 85, 105, 0.7)'     // placeholder text on glass inputs

// Decorative background blobs (light mode)
Glass.blobBase        = '#f0f9ff'  // sky-50  — page background
Glass.blob1           = '#bae6fd'  // sky-200
Glass.blob2           = '#c4b5fd'  // violet-300
Glass.blob3           = '#a5f3fc'  // cyan-200
```

### Dark neon glass tokens (`DarkGlass`)

```ts
DarkGlass.surfaceBg       = 'rgba(6, 10, 35, 0.72)'        // dark navy frosted card
DarkGlass.surfaceBorder   = 'rgba(0, 212, 255, 0.22)'       // neon cyan hairline border
DarkGlass.surfaceGlow     = '#00d4ff'                        // neon glow shadow colour

DarkGlass.inputBg         = 'rgba(0, 212, 255, 0.05)'       // barely-there neon tint
DarkGlass.inputBorder     = 'rgba(0, 212, 255, 0.18)'       // subtle neon cyan border

DarkGlass.buttonBg        = 'rgba(0, 212, 255, 0.07)'       // secondary button fill
DarkGlass.buttonBorder    = 'rgba(0, 212, 255, 0.35)'       // secondary button border

DarkGlass.primaryBg       = '#00d4ff'                        // neon cyan — primary button bg
DarkGlass.primaryText     = '#06061a'                        // dark text on neon button

DarkGlass.textPrimary     = '#e2e8f0'                        // near-white headings
DarkGlass.textSecondary   = '#94a3b8'                        // slate-400 body / labels
DarkGlass.textPlaceholder = 'rgba(148, 163, 184, 0.55)'     // placeholder text

// Neon accent colours
DarkGlass.neonCyan        = '#00d4ff'
DarkGlass.neonPurple      = '#a855f7'
DarkGlass.neonBlue        = '#6366f1'

// Decorative background glow orbs (dark mode)
DarkGlass.blobBase        = '#06061a'                        // deep navy-black page background
DarkGlass.blob1           = 'rgba(0, 212, 255, 0.15)'       // neon cyan glow
DarkGlass.blob2           = 'rgba(168, 85, 247, 0.12)'      // neon purple glow
DarkGlass.blob3           = 'rgba(99, 102, 241, 0.10)'      // neon indigo glow
```

---

## GlassSurface Component

**Location:** `components/ui/glass-surface.tsx` (+ `.ios.tsx` variant)

The component is **theme-aware** — it calls `useColorScheme()` internally and applies the correct style automatically. No theme prop is needed at the call site.

Platform behaviour:

- **iOS** (`glass-surface.ios.tsx`) — renders `expo-blur`'s `BlurView`.
  - Light: `tint="systemUltraThinMaterialLight"`, intensity 30
  - Dark: `tint="systemUltraThinMaterialDark"`, intensity 45, neon cyan border + shadow glow
- **Android / Web** (`glass-surface.tsx`) — renders a plain `View`.
  - Light: `Glass.surfaceBg` fill, hairline `Glass.surfaceBorder` border, soft blue shadow
  - Dark: `DarkGlass.surfaceBg` fill, `DarkGlass.surfaceBorder` border, neon cyan shadow glow

### Usage

```tsx
import { GlassSurface } from '@/components/ui/glass-surface';

// Works identically in both light and dark mode — no branching needed.
<GlassSurface style={{ padding: 24 }}>
  {children}
</GlassSurface>
```

---

## ScreenBackground Component

**Location:** `components/ui/screen-background.tsx`

Renders the solid page background plus the decorative blur targets (light blobs /
dark neon orbs) behind any content. Wrap a screen in it and place a
`GlassSurface` inside — the blobs give the blur something colourful to refract.

```tsx
import { ScreenBackground } from '@/components/ui/screen-background';
import { GlassSurface } from '@/components/ui/glass-surface';

export default function MyScreen() {
  return (
    <ScreenBackground>
      <View className="flex-1 justify-center px-5">
        <GlassSurface style={{ padding: 24 }}>{content}</GlassSurface>
      </View>
    </ScreenBackground>
  );
}
```

---

## Component Patterns

### Heading text

```tsx
<Text style={{ color: isLight ? Glass.textPrimary : DarkGlass.textPrimary }}
      className="text-3xl font-bold mb-8">
  Heading
</Text>
```

### Body / secondary text

```tsx
<Text style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }}
      className="text-sm">
  Body copy
</Text>
```

### Input field

```tsx
<TextInput
  style={isLight ? styles.glassInput : styles.darkInput}
  placeholder="Email"
  placeholderTextColor={isLight ? Glass.textPlaceholder : DarkGlass.textPlaceholder}
/>

const styles = StyleSheet.create({
  glassInput: {
    backgroundColor: Glass.inputBg,
    borderWidth: 1,
    borderColor: Glass.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    color: Glass.textPrimary,
    fontSize: 16,
  },
  darkInput: {
    backgroundColor: DarkGlass.inputBg,
    borderWidth: 1,
    borderColor: DarkGlass.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    color: DarkGlass.textPrimary,
    fontSize: 16,
  },
});
```

### Primary action button

Light mode uses solid sky-blue. Dark mode uses neon cyan with a glowing shadow.

```tsx
<TouchableOpacity
  style={isLight ? styles.primaryButtonLight : styles.primaryButtonDark}
  onPress={onPress}>
  <Text style={isLight ? styles.primaryButtonTextLight : styles.primaryButtonTextDark}>
    Label
  </Text>
</TouchableOpacity>

const styles = StyleSheet.create({
  primaryButtonLight: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDark: {
    backgroundColor: DarkGlass.primaryBg,  // #00d4ff
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: DarkGlass.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonTextLight: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  primaryButtonTextDark: {
    color: DarkGlass.primaryText,  // #06061a — dark text on neon bg
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
```

### Secondary / outline button

```tsx
<TouchableOpacity
  style={isLight ? styles.glassButton : styles.darkOutlineButton}
  className="rounded-xl py-4 mt-3 items-center flex-row justify-center gap-2">
  <Text style={{ color: isLight ? '#0369a1' : DarkGlass.neonCyan }} className="font-medium">
    Label
  </Text>
</TouchableOpacity>

const styles = StyleSheet.create({
  glassButton: {
    backgroundColor: Glass.buttonBg,
    borderWidth: 1,
    borderColor: Glass.buttonBorder,
  },
  darkOutlineButton: {
    backgroundColor: DarkGlass.buttonBg,
    borderWidth: 1,
    borderColor: DarkGlass.buttonBorder,
  },
});
```

### Link / inline accent text

```tsx
<Text style={{ color: isLight ? '#0284c7' : DarkGlass.neonCyan }} className="font-semibold">
  Sign Up
</Text>
```

### Icon accent colour

```tsx
<SomeIcon color={isLight ? '#0369a1' : DarkGlass.neonCyan} size={22} />
```

---

## Typography

System fonts — no custom font loading required.

| Platform | Font stack |
|---|---|
| iOS | `system-ui` (SF Pro), `ui-rounded` for rounded variant |
| Android | `normal` (Roboto) |
| Web | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...` |

Font weights follow Tailwind conventions: `font-normal`, `font-medium`, `font-semibold`, `font-bold`.

---

## Border Radius

| Usage | Value | NativeWind |
|---|---|---|
| Cards / panels | 24px | `rounded-3xl` |
| Inputs / buttons | 12px | `rounded-xl` |
| Small chips / badges | 8px | `rounded-lg` |
| Circular elements | 9999px | `rounded-full` |

---

## Key Rules

1. **Both themes use glassmorphism.** Light = frosted white glass. Dark = dark neon glass with cyan glow.
2. **`GlassSurface` handles both themes automatically** — never wrap it in `isLight ? <GlassSurface> : <View>`.
3. **Always import `Glass` and `DarkGlass` tokens** from `@/constants/theme` — never hard-code rgba values.
4. **Background variation is required behind every `GlassSurface`** — use `ScreenBackground` (light blobs / dark neon orbs).
5. **Neon glow on primary buttons** — in dark mode the primary button is neon cyan (`DarkGlass.primaryBg`) with a `shadowColor: DarkGlass.neonCyan` glow. Text on it is dark (`DarkGlass.primaryText`).
6. **Neon cyan replaces sky-blue** as the accent/interactive colour in dark mode — links, icons, checkboxes, and outline button text all use `DarkGlass.neonCyan`.
7. **Detect theme at the component level** with `useColorScheme()` from `react-native`; do not pass it down as a prop.
