# Camera Rep-Counting Feature — Technical Spec

## 1. Goal

Open the camera, track the user's body during an exercise, and automatically count reps for **pushups, squats, and situps** — no manual tapping required. Inspired by the TikTok "prove it" pose-verification pattern (joint skeleton overlay + live tracking).

This doc is meant to be handed to a code editor / coding agent as the source of truth for implementation.

---

## 2. Critical Architecture Decision: You Need a Dev Client, Not Expo Go

Real-time pose detection requires native camera frame processing at the pixel level. None of the viable libraries run in Expo Go because they rely on native modules (Vision Camera frame processors + on-device ML models). This is fine since you're okay with a dev client, but it needs to be explicit up front because it affects `app.json`/`app.config.js`, CI, and how the team runs the app locally.

**Required setup:**
- `expo-dev-client` installed
- Custom native code via **Prebuild** (`npx expo prebuild`) or **EAS Build** — this is a "bare-ish" Expo workflow, not Expo Go
- Cannot be tested via Expo Go app or Snack
- Team runs the app via `npx expo run:ios` / `npx expo run:android`, or installs dev-client builds from EAS

---

## 3. Recommended Stack

| Layer | Library | Why |
|---|---|---|
| Camera + frame access | `react-native-vision-camera` (v4+) | Industry standard, JSI-based frame processors, runs at high FPS without going over the RN bridge |
| Worklet runtime | `react-native-worklets-core` | Required peer dependency — lets frame processor JS run synchronously on the camera thread |
| Pose detection model | **MediaPipe BlazePose**, via `react-native-mediapipe` (cdiddy77) *or* `react-native-mediapipe-posedetection` (EndLess728, New Architecture only) | 33 body landmarks with x/y/z + visibility/confidence scores, GPU-accelerated, purpose-built for full-body fitness tracking (this is literally what Google positions BlazePose for) |
| Alternative model option | `MoveNet` (TFLite) via a custom VisionCamera frame processor plugin | Lighter weight, 17 keypoints, good if BlazePose proves too heavy on older Android devices — treat as a fallback, not the default |
| Rep-counting logic | Custom JS/TS (state machine, described below) | This logic is app-specific; no library does this part for you |
| Skeleton overlay UI | `react-native-skia` (via VisionCamera's Skia frame processor support) | Lets you draw the joint/line overlay like the reference image, directly on the camera frame |
| State management for session | Whatever you're already using (Zustand recommended given the rest of your stack) | Track current exercise, rep count, form-quality flags, session timer |

### Package install list
```bash
npx expo install react-native-vision-camera react-native-worklets-core react-native-reanimated react-native-skia
npm install react-native-mediapipe
npx expo install expo-dev-client
```

> Note: pin exact versions together — VisionCamera, worklets-core, and the MediaPipe wrapper libraries move fast and have tight compatibility windows. Check each package's peer dependency requirements before installing (React Native version, New Architecture on/off).

---

## 4. High-Level Data Flow

```
Camera (VisionCamera)
   → Frame Processor (worklet, runs per-frame on camera thread)
   → MediaPipe BlazePose plugin → 33 landmarks (x, y, z, visibility)
   → bridge to JS thread (throttled, e.g. 15-20 landmark updates/sec is plenty — no need for 60fps here)
   → Exercise Rep-Counter (per-exercise state machine, described below)
   → React state / Zustand store: { repCount, currentPhase, formFlags }
   → UI: rep counter, skeleton overlay (Skia), optional voice/haptic feedback on each rep
```

Key point: **the landmark detection runs at camera frame rate on a native thread, but your rep-counting logic only needs to run at the JS-bridge update rate.** Don't do heavy logic inside the worklet itself — extract landmarks there, do the counting math in JS.

---

## 5. Rep-Counting Approach: Joint Angles + State Machines

Every exercise reduces to the same pattern:

1. Pick 2–3 joint angles that meaningfully change through the rep (e.g. elbow angle for a pushup).
2. Define a small state machine: `up` → `down` → `up` = 1 rep.
3. Use angle thresholds with hysteresis (different thresholds for entering vs. exiting a state) so noisy frame-to-frame jitter doesn't cause false counts.
4. Require passing through the "bottom" state fully before counting — this prevents someone half-repping and getting credit.

### Angle calculation (shared utility)
Given three landmarks A–B–C (B is the joint vertex), compute the angle at B using the dot product / `atan2` method. This is the single most reused function in the whole feature — write it once, well-tested, in `utils/poseMath.ts`.

```ts
function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}
```

### Per-exercise definitions

**Pushup**
- Landmarks: shoulder, elbow, wrist (both sides — use whichever side has higher visibility score, or average both)
- Angle tracked: elbow angle
- States: `up` (elbow angle > ~160°) → `down` (elbow angle < ~90°) → `up` = 1 rep
- Form check (optional v2): hip landmark should stay roughly in line with shoulder-ankle line — flags sagging hips

**Squat**
- Landmarks: hip, knee, ankle
- Angle tracked: knee angle
- States: `up` (knee angle > ~160°) → `down` (knee angle < ~90–100°, depth is adjustable) → `up` = 1 rep
- Form check (optional v2): knee x-position shouldn't collapse inward past ankle x-position (valgus check)

**Situp**
- Landmarks: shoulder, hip, knee
- Angle tracked: hip angle (torso-to-thigh angle)
- States: `down` (hip angle > ~140°, torso flat) → `up` (hip angle < ~70–90°) → `down` = 1 rep
- Note: situps are the noisiest of the three because the camera angle matters a lot — plan to test this one the most

### Generic state machine shape

```ts
type RepPhase = 'up' | 'down' | 'transition';

interface ExerciseConfig {
  name: string;
  getAngle: (landmarks: Landmark[]) => number;
  upThreshold: number;      // angle above this = "up" position
  downThreshold: number;    // angle below this = "down" position
  minFramesInPhase: number; // debounce — require N consecutive frames before switching phase
}

class RepCounter {
  private phase: RepPhase = 'up';
  private framesInPhase = 0;
  public repCount = 0;

  constructor(private config: ExerciseConfig) {}

  processFrame(landmarks: Landmark[]) {
    const angle = this.config.getAngle(landmarks);
    const targetPhase =
      angle > this.config.upThreshold ? 'up' :
      angle < this.config.downThreshold ? 'down' :
      'transition';

    if (targetPhase === this.phase) {
      this.framesInPhase++;
      return;
    }

    this.framesInPhase = 1;

    // Completed a full up -> down -> up cycle
    if (this.phase === 'down' && targetPhase === 'up') {
      this.repCount++;
    }

    this.phase = targetPhase;
  }
}
```

This same class handles all three exercises — only the `ExerciseConfig` changes. That's the extensibility point for adding more exercises later.

---

## 6. Practical Concerns to Design Around Early

- **Visibility/confidence scores**: BlazePose returns a visibility score per landmark. If key landmarks drop below a confidence threshold (user partially out of frame, poor lighting), pause counting and show a "reposition yourself" prompt rather than silently miscounting.
- **Camera framing per exercise**: pushups and situps are best filmed from the side; squats can be front or side. Consider a short on-screen setup guide per exercise before starting the camera session (like the reference image's framing).
- **Device performance tiers**: BlazePose is heavier than MoveNet. Plan to test on a low-end Android device early — if frame rate tanks, the fallback is either MoveNet or throttling detection to a lower FPS (10-15fps is usually enough for rep counting, unlike form-analysis use cases).
- **False rep prevention**: the `minFramesInPhase` debounce is your main defense against jitter-induced double counts. Expect to tune thresholds per exercise through real testing — don't treat the angle numbers above as final, they're reasonable starting points.
- **Orientation**: decide once whether this is portrait-only or supports landscape; camera + overlay math changes based on this.

---

## 7. Suggested Build Order

1. **Spike**: Get `react-native-vision-camera` + a pose detection plugin running in a dev-client build, log raw landmarks to console. Confirm it runs on both a real iOS and Android device (simulators won't give you a real camera feed for this).
2. **Skeleton overlay**: Render the Skia overlay on top of the camera feed using the landmarks — this is your visual debugging tool for everything after.
3. **Angle math + single exercise**: Implement `calculateAngle` and get pushup counting working end-to-end, tuning thresholds against real reps.
4. **Generalize**: Extract the `RepCounter` state machine, add squat and situp configs.
5. **UX pass**: rep counter UI, form-check flags, reposition prompts, completion state.
6. **Performance pass**: test on low-end devices, tune FPS throttling and model choice.

---

## 8. Open Questions to Settle Before/During Build

- Front camera (user sees themselves, TikTok-style) or rear camera (better for full-body framing but no self-view)?
- Do you want live rep count displayed during the set, or only revealed at the end (more "prove it" style like the reference)?
- Should form-quality checks (v2 items above) block a rep from counting, or just show a warning?
- Any requirement to save a replay/clip of the set for accountability/sharing, or is this purely live tracking with no persistence?
