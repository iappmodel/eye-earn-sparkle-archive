# Eye-Tracking & Remote Control – Full Feature Audit

**Date:** February 7, 2025  
**Scope:** Eye-tracking (attention rewards), Remote Control (blink/gaze/voice), co-existence, all implemented functions

---

## Executive Summary

Eye-tracking and Remote Control share the same underlying vision pipeline when both are active. When Remote Control is **off**, eye-tracking uses a separate camera and skin-tone heuristic. When Remote Control is **on**, eye-tracking consumes `visionEngineSample` events and does not open its own camera. **Race conditions and duplicate cameras** can occur due to timing; several bugs and improvements are documented below.

---

## Architecture Overview

### Eye-Tracking Feature

| Component | Purpose |
|-----------|---------|
| `useEyeTracking` | Main hook: attention scoring, Vision Engine listener, skin-tone fallback |
| `EyeTrackingIndicator` | UI: eye icon with progressive hide (full → iris-only → hidden) |
| `MediaCard` | Consumer: uses useEyeTracking for promo content rewards |
| `MediaSettings` | Toggle: eye tracking on/off, attention preset, indicator position |
| `useAttentionVerification` | Legacy/alternative: subscribes to visionEngineSample |
| `ATTENTION_PRESETS` | strict / normal / relaxed thresholds |

### Remote Control Feature

| Component | Purpose |
|-----------|---------|
| `useBlinkRemoteControl` | Main hook: gaze, blink patterns, calibration, camera |
| `useVisionEngine` | MediaPipe Face Mesh or Face Landmarker: landmarks, EAR, gaze, blink |
| `useGazeDirection` | Direction zones (left/right/up/down), rapid movement |
| `BlinkRemoteControl` | Settings UI: commands, combos, targets, gaze, audio, calibration |
| `TargetOverlay` | Screen targets: dwell, gaze+blink, gesture triggers |
| `FloatingControls` | Remote control toggle, BlinkRemoteControl wrapper |

### Shared Vision Pipeline

| Event / Flow | When | Who Produces | Who Consumes |
|--------------|------|--------------|--------------|
| `visionEngineSample` | When Remote Control enabled + camera on | useBlinkRemoteControl | useEyeTracking, useAttentionVerification |
| Camera | Remote Control ON | useBlinkRemoteControl.startCamera | useVisionEngine (videoRef) |
| Camera | Remote Control OFF + Eye Tracking ON | useEyeTracking.startTracking | Skin-tone heuristic (no MediaPipe) |

---

## Co-Existence: Eye-Tracking + Remote Control

### When Both Are ON

1. User enables Remote Control → camera starts, useVisionEngine runs
2. User plays a promo video → useEyeTracking enables
3. useBlinkRemoteControl dispatches `visionEngineSample` on every vision update
4. useEyeTracking listens, sets `usingVisionEngineRef = true`, scores attention from face/EAR/gaze/headPose
5. useEyeTracking does **not** open its own camera (once handler has run)

### Collision / Race Condition – FIXED ✅

**Previous bug:** useEyeTracking could open its own camera before `visionEngineSample` arrived, leaving a duplicate camera running.

**Fix implemented:**
1. **RC-first check:** When Remote Control is enabled, useEyeTracking never opens its own camera; it waits for `visionEngineSample`.
2. **Release on handoff:** When `visionEngineSample` arrives and we have our own camera (race case), we immediately release it via `releaseOwnCamera()`.
3. **remoteControlSettingsChanged:** When RC turns on, we release our camera. When RC turns off and eye tracking is still enabled, we start our camera.
4. **Source indicator:** `state.source: 'vision_engine' | 'fallback'` for UI/debugging.

### When Remote Control OFF, Eye Tracking ON

- No `visionEngineSample` from RC (RC is off)
- useEyeTracking runs its **own** useVisionEngine with the same video feed
- Opens camera, drives MediaPipe (Face Mesh or Face Landmarker) for attention scoring
- Falls back to skin-tone only if Vision Engine fails to produce data within 5s
- Same accuracy as RC-on path (EAR, gaze, head pose)

### When Eye Tracking OFF

- MediaCard does not enable useEyeTracking (`enabled: false`)
- No attention scoring, no camera from eye tracking
- Promo rewards use fallback (e.g. always eligible if eye tracking disabled)

---

## Implemented Functions – Full List

### Eye-Tracking (useEyeTracking)

| Function | Purpose | Status |
|----------|---------|--------|
| `startTracking` | Request camera, start skin-tone detection OR rely on visionEngineSample | Implemented |
| `stopTracking` | Stop camera, clear intervals | Implemented |
| `resetAttention` | Reset score, rolling state for new content | Implemented |
| `retryTracking` | Retry after permission error | Implemented |
| `getAttentionResult` | Final score, passed, frames for validation | Implemented |
| Vision Engine listener | Score from hasFace, eyeEAR, gazePosition, headYaw/Pitch | Implemented |
| Tab visibility handling | Pause attention when tab hidden | Implemented |
| Attention presets | strict / normal / relaxed from storage | Implemented |
| `onAttentionLost` / `onAttentionRestored` | Callbacks for MediaCard | Implemented |
| Session stats | min/max/avg, streak, totalAttentiveMs | Implemented |
| `lastFlags` | NO_FACE, EYES_CLOSED, LOOK_AWAY, BAD_POSE | Implemented |
| Calibrated gaze | Uses calibratedGazePosition when in event | Implemented |
| `source` | 'vision_engine' \| 'fallback' for UI/debugging | Implemented |
| RC-first check | Never open own camera when RC enabled | Implemented |
| `releaseOwnCamera` | Release camera when Vision takes over | Implemented |
| remoteControlSettingsChanged | Handoff when RC toggled | Implemented |
| Own Vision when RC off | useVisionEngine in useEyeTracking when RC disabled | Implemented |
| Vision fallback timer | 5s timeout → skin-tone if Vision fails to start | Implemented |

### Eye-Tracking UI (MediaCard, EyeTrackingIndicator, MediaSettings)

| Function | Purpose | Status |
|----------|---------|--------|
| Eye Tracking toggle | Enable/disable in MediaSettings | Implemented |
| Eye indicator position | top-left, top-center, top-right, bottom-left, bottom-right | Implemented |
| Attention preset selector | strict / normal / relaxed | Implemented |
| Progressive hide | Full eye → iris-only (2s) → hidden (4s) | Implemented |
| Attention warning | Sound + haptic when attention lost | Implemented |
| Focus challenge | Mini-game after repeated attention loss | Implemented |
| Auto-pause | Pause video when attention lost >50% of watch time | Implemented |
| Attention heatmap | Record and show gaze distribution | Implemented |
| Reward eligibility | Score ≥70 for reward, ≥95 for perfect | Implemented |
| End stats | Score, attentive time, eligible | Implemented |

### Remote Control – useBlinkRemoteControl

| Function | Purpose | Status |
|----------|---------|--------|
| `startCamera` / `stopCamera` | getUserMedia for vision | Implemented |
| `registerButton` / `unregisterButton` | Ghost buttons for dwell/blink | Implemented |
| `processGazePosition` | Calibrate gaze, find targets, update ghost state | Implemented |
| Blink patterns | single / double / triple via useVisionEngine | Implemented |
| Wink detection | left / right via useVisionEngine | Implemented |
| Gesture detection | smile, eyebrow, head turn, lip raise, slow blink | Implemented |
| Gaze commands | next/prev video, friends/promo feed by direction | Implemented |
| `visionEngineSample` broadcast | For useEyeTracking when RC enabled | Implemented |
| Calibration | offset/scale, affine (6+ points), per-device | Implemented |
| `recordCalibrationPoint` | Manual target clicks | Implemented |
| Auto-calibration | Adjust from click history | Implemented |
| `pauseCamera` / `resumeCamera` | Suspend when e.g. calibration open | Implemented |
| `remoteControlUserStart` | Start camera from user gesture (iOS) | Implemented |
| `remoteControlSuspend` | Pause when overlay/sheet active | Implemented |

### Remote Control – useVisionEngine

| Function | Purpose | Status |
|----------|---------|--------|
| Face Mesh backend | Legacy @mediapipe/face_mesh | Implemented |
| Face Landmarker backend | @mediapipe/tasks-vision | Implemented |
| Shared driver | Single detector, priority for calibration | Implemented |
| EAR-based blink | Baseline, close/reopen thresholds | Implemented |
| Iris gaze | From landmarks 468–477 | Implemented |
| Head pose | yaw, pitch from landmarks | Implemented |
| `visionBackend` option | face_mesh \| face_landmarker | Implemented |
| Gaze smoothing | EMA for low-end devices | Implemented |
| Calibration mode | Looser blink thresholds | Implemented |

### Remote Control – useGazeDirection

| Function | Purpose | Status |
|----------|---------|--------|
| `updateGazePosition` | Convert screen coords to direction | Implemented |
| `calculateDirection` | center / left / right / up / down | Implemented |
| Rapid movement | Speed-based directional trigger | Implemented |
| `resetTracking` | Clear on disable | Implemented |

### Remote Control – BlinkRemoteControl UI

| Tab / Control | Purpose | Status |
|---------------|---------|--------|
| Commands | Blink action per button (tap, long press, toggle, none) | Implemented |
| Combos | Multi-step gesture combos | Implemented |
| Targets | TargetEditor, presets, suggestions | Implemented |
| Gaze | Gaze commands, direction mapping | Implemented |
| Audio | Voice calibration, feedback | Implemented |
| Settings | Sensitivity, gaze hold, ghost opacity, mirror/invert | Implemented |
| Extended calibration | 16-point grid toggle | Implemented |
| Vision backend | Face Mesh vs Face Landmarker | Implemented |
| Blink calibration | EyeBlinkCalibration flow | Implemented |
| Eye movement | EyeMovementTracking | Implemented |
| Facial expression | FacialExpressionScanning | Implemented |
| Slow blink training | SlowBlinkTraining | Implemented |
| Voice calibration | VoiceCalibration | Implemented |

### Remote Control – TargetOverlay

| Function | Purpose | Status |
|----------|---------|--------|
| Dwell activation | Gaze on target for gazeHoldTime | Implemented |
| Gaze+blink | Dwell + blink to activate | Implemented |
| Blink-only | single/double/triple on target | Implemented |
| Gesture triggers | eyebrow, smile, head turn, etc. | Implemented |
| Gaze smoothing | EMA for hit-testing | Implemented |
| Calibration hint | One-time hint when enabled | Implemented |
| calibrationMode | Ignore gaze when calibrating | Implemented |

### Calibration Flows

| Flow | Purpose | Status |
|------|---------|--------|
| EyeBlinkCalibration | Blink at targets, gaze samples → calibration | Implemented (Phase 1–2) |
| computeGazeCalibrationFromResult | Affine/offset from EyeBlinkCalibration result | Implemented |
| Manual target clicks | recordCalibrationPoint from debug/targets | Implemented |
| Extended 16-point | More calibration points | Implemented |
| Per-device | calibration.service deviceId | Implemented |

---

## Bugs & Issues

### High

| Issue | Location | Description |
|-------|----------|-------------|
| ~~Duplicate camera when both features on~~ | useEyeTracking | ✅ FIXED: RC-first check, releaseOwnCamera on Vision handoff, remoteControlSettingsChanged listener |
| ~~getAttentionResult inconsistency~~ | useEyeTracking | ✅ FIXED: Both paths use same rolling-window semantics (rollingAvg >= threshold). Added AttentionResult.source |
| EyeBlinkCalibration vs manual calibration | REMOTE_CONTROL_AUDIT | Two separate flows; EyeBlinkCalibration now produces gaze calibration (Phase 1) but disconnect was historically an issue – verify wiring |

### Medium

| Issue | Location | Description |
|-------|----------|-------------|
| ~~visionEngineSample only when RC enabled~~ | useEyeTracking | ✅ FIXED: useEyeTracking runs its own useVisionEngine when RC is off; falls back to skin-tone only if Vision fails within 5s |
| Skin-tone fallback accuracy | useEyeTracking | Very coarse (skin ratio in fixed ROI); no EAR, gaze, head pose. Rewards can be gamed |
| ~~Camera not started until user gesture~~ | useBlinkRemoteControl, useEyeTracking | ✅ FIXED: cameraUserStart + remoteControlUserStart dispatched from play/RC handlers; needsUserGesture overlay; iOS skips auto-play for promos with eye tracking |
| calibrationActive suspends vision | useBlinkRemoteControl | When calibration open, useVisionEngine disabled → no visionEngineSample. useEyeTracking gets nothing during calibration |

### Low

| Issue | Location | Description |
|-------|----------|-------------|
| ~~Console logs in production~~ | useBlinkRemoteControl, MediaCard, etc. | ✅ FIXED: dev-gated logger (`@/lib/logger`) – debug/info/warn suppressed in production |
| ~~Gesture thresholds from FacialExpressionScanning~~ | BlinkRemoteControl | ✅ FIXED: deriveGestureThresholdsFromExpressions + mergeGestureThresholds persist to app_gesture_thresholds |
| Voice substring matching | voiceCommands | "play" can match "display" |

---

## Possible Improvements

### Co-Existence

1. ~~**Defer useEyeTracking camera when RC enabled**~~ ✅ Implemented

2. ~~**Unified vision provider**~~ IMPLEMENTED
   - VisionContext provides single camera; RC and eye-tracking consume via useVision()
   - When either needs vision, one camera serves both (ref-count request/release)

3. ~~**visionEngineSample when RC off**~~ ✅ Implemented
   - useEyeTracking runs useVisionEngine when RC is off; promo rewards use MediaPipe (Face Mesh / Face Landmarker) with 5s fallback to skin-tone

### Accuracy

1. ~~**Per-user attention thresholds**~~ (partial) ✅ FacialExpressionScanning
   - FacialExpressionScanning thresholds now persisted to app_gesture_thresholds; SlowBlinkTraining uses calibration
2. **WebGazer as alternative** (Phase 3 deferred)
   - Optional gaze model for users where MediaPipe is poor
3. **Tighter voice matching**
   - Exact phrase first, then keyword

### UX

1. **Clear "Remote Control + Eye Tracking" state**
   - When both on, show a single indicator (e.g. "Camera: attention + control")
2. **Calibration hint for eye tracking**
   - Suggest RC calibration when attention scores are consistently low
3. ~~**Reduce camera permission prompts**~~ IMPLEMENTED
   - VisionContext reuses single camera; avoid multiple getUserMedia calls

---

## Button & Control Reference

### MediaSettings (Eye Tracking)

| Control | Action | Storage |
|---------|--------|---------|
| Eye Tracking toggle | Enable/disable | visuai-eye-tracking-enabled |
| Attention preset | strict / normal / relaxed | visuai-attention-preset |
| Eye indicator position | 5 positions | visuai-eye-indicator-position |
| Attention threshold | Slider (unused in some flows) | visuai-attention-threshold |

### FloatingControls (Remote Control)

| Control | Action |
|---------|--------|
| Remote Control toggle | Enable/disable, dispatch remoteControlUserStart |
| BlinkRemoteControl sheet | Open settings |

### BlinkRemoteControl Tabs

| Tab | Key Controls |
|-----|--------------|
| Commands | Per-button: single/double/triple blink → tap/long press/toggle/none |
| Combos | Add/remove/reorder combos, practice mode |
| Targets | TargetEditor, presets, suggestions |
| Gaze | Direction → next/prev/friends/promo feed |
| Audio | Voice calibration, feedback volume |
| Settings | Sensitivity, gaze hold, ghost opacity, mirror X, invert Y, extended calibration, vision backend |

### MediaCard (Promo)

| UI Element | Behavior |
|------------|----------|
| EyeTrackingIndicator | Show when promo + playing + eye tracking on |
| Attention progress bar | When eye tracking on |
| Focus challenge | After repeated attention loss |
| Resume from pause | When attention lost too long |
| End stats | Score, attentive time, eligible |

---

## Testing Checklist

- [ ] RC off, Eye tracking on, play promo → Vision Engine camera (or skin-tone fallback after 5s), rewards work
- [ ] RC on, Eye tracking on, play promo → no second camera, visionEngineSample used
- [ ] RC on first, then play promo → no duplicate camera
- [ ] Play promo first, then enable RC → verify transition
- [ ] Calibration open → vision suspended, no phantom target activations
- [ ] Tab hidden → attention lost callback
- [ ] Blink 1/2/3 on target → correct action
- [ ] Gaze dwell → ghost activation
- [ ] Vision backend switch (Face Mesh ↔ Face Landmarker) → both work
- [ ] Extended calibration 16-point → affine fit used when 6+ points

---

*End of audit*
