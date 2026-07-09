# Camera Rep Counting — Technology & Libraries

This document describes the libraries, native integrations, and application architecture used to implement GainGang's camera-based body tracking and automatic rep counting POC.

For product requirements and exercise definitions, see [`rep-counting-camera-feature-spec.md`](./rep-counting-camera-feature-spec.md).

---

## Overview

The feature opens the device camera, detects the user's body pose in real time, draws a skeleton overlay, and automatically counts reps for **push-ups**, **squats**, and **sit-ups**. Counted reps flow back into the existing activity logging screens (`log-activity`, `log-daily-goal`).

This is **not** a pure JavaScript feature. It requires:

- A **custom Expo dev client** (`expo-dev-client`)
- **Native pose detection** via MediaPipe BlazePose
- **EAS Build** or `expo prebuild` + `expo run:ios` / `expo run:android`

It does **not** run in Expo Go.

---

## Library Stack

| Layer | Package | Version (approx.) | Role |
|---|---|---|---|
| App shell | `expo` | ~56 | Managed Expo workflow, config plugins, EAS builds |
| Dev client | `expo-dev-client` | ~56 | Custom native binary with Vision Camera + MediaPipe |
| Camera | `react-native-vision-camera` | 4.7.x | High-FPS camera access, frame processors on a native thread |
| Worklet runtime | `react-native-worklets-core` | 1.6.x | Runs frame processor JS synchronously on the camera thread |
| Animation (existing) | `react-native-reanimated` | 4.3.x | App animations; Babel plugin must run after worklets plugin |
| Worklets (Reanimated) | `react-native-worklets` | 0.8.x | Peer of Reanimated 4 |
| **Android pose** | `expo-vision-camera-v4-mediapipe` | 1.2.x | Expo config plugin + Kotlin frame processor; BlazePose via `detectHandLandmarks()` |
| **iOS pose** | `react-native-mediapipe-pose-plugin` | 0.1.x | Swift frame processor registered as `poseLandmarker` |
| **iOS native setup** | `plugins/with-mediapipe-pose-ios.js` | local | Custom Expo config plugin: Podfile, Swift/ObjC files, model bundling |
| Skeleton overlay | `react-native-svg` | 15.x | Draws joint lines and dots over the camera preview |
| Haptic feedback | `expo-haptics` | ~56 | Light impact on each counted rep |

### ML model: MediaPipe BlazePose

Both platforms use Google's **BlazePose** pose landmarker (33 body keypoints with `x`, `y`, `z`, and `visibility`).

| Platform | Model file | Location |
|---|---|---|
| Android | `pose_landmarker_lite.task` | `assets/pose_landmarker_lite.task` (copied into Android assets at prebuild) |
| iOS | `pose_landmarker_full.task` | `assets/pose_landmarker_full.task` (copied into iOS app bundle at prebuild) |

Models are **not** downloaded at runtime. They are bundled into the native app during prebuild/EAS build.

---

## Platform Differences

Pose detection is implemented with **two different native plugins** — one per platform — because the Android-focused `expo-vision-camera-v4-mediapipe` package does not ship iOS support.

### Android

- **Plugin:** `expo-vision-camera-v4-mediapipe`
- **Config:** `app.json` → `expo-vision-camera-v4-mediapipe/plugin` with `enablePose: true`
- **Frame processor API:** Global `detectHandLandmarks(frame)` inside the worklet
- **Returns:** `{ pose: PoseLandmark[] }` among other optional channels (hands, face)

### iOS

- **Plugin:** `react-native-mediapipe-pose-plugin`
- **Config:** `app.json` → `./plugins/with-mediapipe-pose-ios`
- **Frame processor API:** `VisionCameraProxy.initFrameProcessorPlugin('poseLandmarker', {})`
- **Returns:** Array of 33 landmark objects `{ x, y, z, visibility }`
- **Extra native setup:** MediaPipe CocoaPod, C++20 build settings, xcframework linker fixes, Swift bridging header imports

The JS camera component (`components/rep-counter/rep-counter-camera.tsx`) uses **separate frame processors per platform** and selects the correct one on the JS thread. `Platform.OS` is unreliable inside worklets, so branching must not happen inside a single shared processor.

### iOS coordinate normalization

iOS front-camera frames arrive in landscape orientation. Before rep-counting math runs, landmarks are rotated for portrait display in `lib/rep-counting/normalize-pose-landmarks.ts` (`x ↔ y` swap).

---

## Data Flow

```
Camera (VisionCamera)
  → Frame Processor (worklet, native camera thread)
      Android: detectHandLandmarks(frame)
      iOS:     poseLandmarkerPlugin.call(frame)
  → Throttled bridge to JS (~15 updates/sec)
  → normalizePoseLandmarks() [iOS only]
  → RepCounter.processFrame(landmarks)
      → joint angle calculation
      → phase state machine (up / down / transition)
  → React state: repCount, phase, angle, trackingOk
  → UI: skeleton overlay (SVG), rep badge, reposition prompt
  → On finish: pending rep count → log screen
```

**Key design choice:** Pose inference runs at camera frame rate on a native thread. Rep-counting logic runs on the JS thread at a throttled rate (~66 ms). Heavy math is not done inside the worklet.

---

## Rep Counting Logic

All exercises share one state machine (`RepCounter` in `lib/rep-counting/rep-counter.ts`). Each exercise supplies a config with:

- Which joint angle to track
- Up/down angle thresholds
- Phase debounce (`minFramesInPhase`)
- Which transition counts as one rep

| Exercise type | Angle tracked | Landmarks | Counts on |
|---|---|---|---|
| `pushup` | Elbow | shoulder → elbow → wrist | down → up |
| `squat` | Knee | hip → knee → ankle | down → up |
| `situp` | Hip / torso | shoulder → hip → knee | up → down |

Exercise names from the database (e.g. "Push-ups", "Bodyweight Squats", "Sit-ups") are mapped to these types in `lib/rep-counting/exercise-registry.ts`.

Shared angle math lives in `utils/pose-math.ts` (`calculateAngle`, `pickSide`).

---

## Project Structure

```
app/
  rep-counter.tsx              # Full-screen camera session (setup → active → review)

components/rep-counter/
  rep-counter-camera.tsx       # VisionCamera + frame processors + HUD
  pose-skeleton-overlay.tsx    # SVG joint/line overlay
  exercise-setup-guide.tsx     # Framing tips per exercise
  camera-rep-count-button.tsx  # Entry point from log screens

lib/rep-counting/
  types.ts                     # Landmark, RepPhase, CameraExerciseType
  pose-landmarks.ts            # BlazePose indices + skeleton connections
  rep-counter.ts               # RepCounter class + EXERCISE_CONFIGS
  exercise-registry.ts         # Name mapping + setup guides
  ios-pose-plugin.ts           # iOS poseLandmarker plugin init
  normalize-pose-landmarks.ts  # iOS portrait coordinate fix
  platform.ts                  # Dev client / native module availability checks
  pending-result.ts            # Pass rep count back to log screens
  mediapipe-globals.d.ts       # TypeScript global for Android detectHandLandmarks

plugins/
  with-mediapipe-pose-ios.js   # Expo config plugin for iOS native setup

assets/
  pose_landmarker_lite.task    # Android MediaPipe model
  pose_landmarker_full.task    # iOS MediaPipe model
```

---

## Native Configuration

### `app.json` plugins

```json
[
  ["react-native-vision-camera", {
    "cameraPermissionText": "GainGang uses the camera to count your reps during exercises.",
    "enableMicrophonePermission": false
  }],
  ["expo-vision-camera-v4-mediapipe/plugin", {
    "numHands": 1,
    "enablePose": true,
    "minDetectionConfidence": 0.5,
    "minTrackingConfidence": 0.5
  }],
  "./plugins/with-mediapipe-pose-ios"
]
```

### `babel.config.js`

The worklets Babel plugin **must** be listed before the Reanimated plugin:

```js
plugins: [
  'react-native-worklets-core/plugin',
  'react-native-reanimated/plugin',
],
```

### Camera requirements

- `pixelFormat="rgb"` on the `<Camera>` component (MediaPipe expects RGBA frames)
- Front camera by default (`useCameraDevice('front')`)
- Portrait orientation only (`app.json` → `"orientation": "portrait"`)

---

## App Integration

Supported exercises (name contains or matches push-up / squat / sit-up variants) **require camera counting** on the log screens instead of manual rep input.

1. User taps **Count with camera** on `log-activity` or `log-daily-goal`
2. Navigates to `/rep-counter` with exercise params
3. Completes a set and taps **Use X reps**
4. `pending-result.ts` stores the count; log screen consumes it on focus via `useFocusEffect` from `expo-router`

---

## Building & Running

| Task | Command |
|---|---|
| Start Metro (dev client) | `npm run start` |
| iOS dev client (EAS) | `npm run build:dev:ios` |
| Android dev client (EAS) | `npm run build:dev:android` |
| Local Android (Mac/Linux) | `npx expo prebuild --clean && npx expo run:android` |
| Local iOS (macOS only) | `npx expo prebuild --clean && npx expo run:ios` |

After installing a new dev client build, connect to Metro and test on a **physical device**. Simulators do not provide a usable camera feed for this feature.

---

## Current Limitations (POC)

- **Form validation** — no sagging-hip, knee-valgus, or half-rep rejection yet
- **Per-variant tuning** — "Diamond Push-ups" and "Push-ups" share the same thresholds
- **No recording** — live tracking only; no video replay or persistence
- **Threshold tuning** — angle values are starting points from the spec; real-device calibration is needed
- **Web** — not supported

---

## Related Docs

- [`rep-counting-camera-feature-spec.md`](./rep-counting-camera-feature-spec.md) — original feature spec and build order
- [Vision Camera docs](https://react-native-vision-camera.com/docs/guides)
- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
- [expo-vision-camera-v4-mediapipe](https://github.com/CarlosEduFF/expo-vision-camera-v4-mediapipe) (Android)
- [react-native-mediapipe-pose-plugin](https://github.com/munishbp/react-native-mediapipe-pose-plugin) (iOS + Android reference)
