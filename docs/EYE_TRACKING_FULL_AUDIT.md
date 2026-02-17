# Eye-Tracking & Remote Control – Full Feature Audit

**Date:** February 7, 2025  
**Scope:** Complete audit of eye-tracking and remote control features, co-existence, all functions, buttons, and behaviors

---

## 1. Executive Summary

Eye-tracking verifies attention for promo video rewards (face, eyes open, gaze forward, head pose). Remote Control enables hands-free control via gaze, blinks, and gestures. Both can use the same MediaPipe Vision Engine. When both are on, RC owns the camera and broadcasts `visionEngineSample`; eye-tracking consumes it. When RC is off, eye-tracking runs its own Vision Engine (or skin-tone fallback). Collision handling (duplicate cameras, handoff) is implemented.

---

## 2. Eye-Tracking Feature – Complete Function List

### 2.1 useEyeTracking Hook

| # | Function / Behavior | Purpose | Status |
|---|---------------------|---------|--------|
| 1 | `startTracking()` | Request camera, start Vision Engine or skin-tone interval | ✅ Implemented |
| 2 | `stopTracking()` | Stop camera, clear intervals, release stream | ✅ Implemented |
| 3 | `resetAttention()` | Reset score, rolling buffer, frames, streak, session stats | ✅ Implemented |
| 4 | `retryTracking()` | Retry after permission/gesture error, clear `needsUserGesture` | ✅ Implemented |
| 5 | `getAttentionResult()` | Return score, passed, framesDetected, totalFrames, source | ✅ Implemented |
| 6 | visionEngineSample listener | Score from RC's Vision when RC on | ✅ Implemented |
| 7 | Own useVisionEngine (RC off) | MediaPipe when RC off, no duplicate camera | ✅ Implemented |
| 8 | Skin-tone fallback | 5s timeout, then 200ms interval if Vision fails | ✅ Implemented |
| 9 | Vision fallback retry | 30s periodic retry when on skin-tone | ✅ Implemented |
| 10 | Tab visibility | Pause attention when tab hidden (`visibilitychange`) | ✅ Implemented |
| 11 | Presets | strict / normal / relaxed from storage | ✅ Implemented |
| 12 | `onAttentionLost` / `onAttentionRestored` | Callbacks for MediaCard | ✅ Implemented |
| 13 | Session stats | minScore, maxScore, avgScore, sampleCount | ✅ Implemented |
| 14 | `lastFlags` | NO_FACE, EYES_CLOSED, LOOK_AWAY, BAD_POSE | ✅ Implemented |
| 15 | Calibrated gaze | Uses calibratedGazePosition when in event | ✅ Implemented |
| 16 | `source` | 'vision_engine' \| 'fallback' | ✅ Implemented |
| 17 | `visionStatus` | 'loading' \| 'active' \| 'fallback' | ✅ Implemented |
| 18 | `needsUserGesture` | True when camera failed (iOS gesture) | ✅ Implemented |
| 19 | RC-first check | Never open own camera when RC enabled | ✅ Implemented |
| 20 | `releaseOwnCamera()` | Release when Vision takes over | ✅ Implemented |
| 21 | remoteControlSettingsChanged | Handoff when RC toggled | ✅ Implemented |
| 22 | cameraUserStart listener | Start camera from user gesture (iOS) | ✅ Implemented |
| 23 | configurable visionFallbackMs | Default 5s, overridable | ✅ Implemented |

### 2.2 Eye-Tracking UI Components

| # | Component | Function | Status |
|---|-----------|----------|--------|
| 24 | EyeTrackingIndicator | Progressive hide: full → iris-only (2s) → hidden (4s) | ✅ Implemented |
| 25 | EyeTrackingIndicator | visionStatus badge: Basic / … (loading) | ✅ Implemented |
| 26 | EyeTrackingIndicator | Focus streak badge (≥3s) | ✅ Implemented |
| 27 | MediaSettings | Eye Tracking toggle | ✅ Implemented |
| 28 | MediaSettings | Attention preset (strict / normal / relaxed) | ✅ Implemented |
| 29 | MediaSettings | Eye indicator position (5 positions) | ✅ Implemented |
| 30 | MediaSettings | attentionThreshold slider (stored, some flows unused) | ⚠️ Stored but not used in scoring |
| 31 | AttentionProgressBar | Quality segments (high/medium/low/none by score) | ✅ Implemented |
| 32 | FocusChallengeMiniGame | Triggers after repeated attention loss (every 3rd, max 1/10s) | ✅ Implemented |
| 33 | AttentionHeatmap | Record gaze distribution | ✅ Implemented |
| 34 | PerfectAttentionCelebration | Shown when score ≥95 | ✅ Implemented |
| 35 | RewardBadge | Amount display | ✅ Implemented |
| 36 | End stats overlay | Score, attentive time, eligible | ✅ Implemented |

### 2.3 MediaCard (Promo) Integration

| # | Behavior | Status |
|---|----------|--------|
| 37 | Enable useEyeTracking when promo + isActive + isPlaying + eyeTrackingEnabled | ✅ Implemented |
| 38 | Attention warning: sound + haptic on loss | ✅ Implemented |
| 39 | Auto-pause when attention lost >50% of watch time (after 5s) | ✅ Implemented |
| 40 | dispatchCameraUserStart on play / resume / focus-challenge complete | ✅ Implemented |
| 41 | "Tap to enable camera" overlay when needsUserGesture | ✅ Implemented |
| 42 | iOS: skip auto-play, require tap for promos with eye tracking | ✅ Implemented |
| 43 | validate-attention Supabase call on promo complete | ✅ Implemented |
| 44 | Reward eligibility: score ≥70; perfect: ≥95 | ✅ Implemented |
| 45 | resetAttention on media change | ✅ Implemented |

### 2.4 Constants & Presets (attention.ts)

| # | Item | Status |
|---|------|--------|
| 46 | ATTENTION_PRESETS (strict, normal, relaxed) | ✅ Implemented |
| 47 | ATTENTION_WEIGHTS (face 35%, eyes 30%, gaze 30%, pose 5%) | ✅ Implemented |
| 48 | loadAttentionPresetFromStorage / saveAttentionPresetToStorage | ✅ Implemented |

### 2.5 useAttentionVerification (Legacy)

| # | Function | Purpose | Status |
|---|----------|---------|--------|
| 49 | useAttentionVerification | Alternative attention scoring, subscribes to visionEngineSample | ⚠️ Legacy – not used by MediaCard; useEyeTracking is primary |

---

## 3. Remote Control Feature – Complete Function List

### 3.1 useBlinkRemoteControl Hook

| # | Function / Behavior | Purpose | Status |
|---|---------------------|---------|--------|
| 1 | `startCamera()` / `stopCamera()` | getUserMedia for vision | ✅ Implemented |
| 2 | `registerButton` / `unregisterButton` | Ghost buttons for dwell/blink | ✅ Implemented |
| 3 | `processGazePosition` | Calibrate gaze, find targets, update ghost state | ✅ Implemented |
| 4 | Blink patterns | single / double / triple via useVisionEngine | ✅ Implemented |
| 5 | Wink detection | left / right | ✅ Implemented |
| 6 | Gesture detection | eyebrow, smile, head turn, lip raise, slow blink | ✅ Implemented |
| 7 | Gaze commands | next/prev video, friends/promo feed by direction | ✅ Implemented |
| 8 | visionEngineSample broadcast | For useEyeTracking when RC enabled | ✅ Implemented |
| 9 | Calibration (offset/scale, affine) | Per-device gaze calibration | ✅ Implemented |
| 10 | recordCalibrationPoint | Manual target clicks | ✅ Implemented |
| 11 | Auto-calibration | Adjust from click history | ✅ Implemented |
| 12 | pauseCamera / resumeCamera | Suspend when calibration/sheet open | ✅ Implemented |
| 13 | remoteControlUserStart listener | Start camera from user gesture (iOS) | ✅ Implemented |
| 14 | cameraUserStart listener | Also triggers camera (unified event) | ✅ Implemented |
| 15 | remoteControlSuspend listener | Pause when overlay/sheet active | ✅ Implemented |
| 16 | mergeGestureThresholds | Persist thresholds from FacialExpressionScanning | ✅ Implemented |
| 17 | deriveGestureThresholdsFromExpressions | Build thresholds from captured expressions | ✅ Implemented |

### 3.2 useVisionEngine

| # | Function | Status |
|---|----------|--------|
| 18 | Face Mesh backend (legacy) | ✅ Implemented |
| 19 | Face Landmarker backend (tasks-vision) | ✅ Implemented |
| 20 | Shared driver, priority for calibration | ✅ Implemented |
| 21 | EAR-based blink | ✅ Implemented |
| 22 | Iris gaze (landmarks 468–477) | ✅ Implemented |
| 23 | Head pose (yaw, pitch) | ✅ Implemented |
| 24 | visionBackend option | ✅ Implemented |
| 25 | Gaze smoothing (EMA) | ✅ Implemented |
| 26 | Calibration mode (looser blink) | ✅ Implemented |

### 3.3 BlinkRemoteControl UI

| # | Tab / Control | Status |
|---|---------------|--------|
| 27 | Commands | Per-button: single/double/triple → tap/long press/toggle/none | ✅ Implemented |
| 28 | Combos | Add/remove/reorder, practice mode | ✅ Implemented |
| 29 | Targets | TargetEditor, presets, suggestions | ✅ Implemented |
| 30 | Gaze | Direction mapping | ✅ Implemented |
| 31 | Audio | Voice calibration, feedback | ✅ Implemented |
| 32 | Settings | Sensitivity, gaze hold, ghost opacity, mirror, invert | ✅ Implemented |
| 33 | Extended 16-point calibration | ✅ Implemented |
| 34 | Vision backend toggle | Face Mesh vs Face Landmarker | ✅ Implemented |
| 35 | EyeBlinkCalibration | Blink at targets, gaze samples | ✅ Implemented |
| 36 | EyeMovementTracking | ✅ Implemented |
| 37 | FacialExpressionScanning | 8 expressions, combos | ✅ Implemented |
| 38 | SlowBlinkTraining | Personalized slow blink range | ✅ Implemented |
| 39 | VoiceCalibration | ✅ Implemented |

### 3.4 TargetOverlay

| # | Function | Status |
|---|----------|--------|
| 40 | Dwell activation | Gaze on target for gazeHoldTime | ✅ Implemented |
| 41 | Gaze+blink | Dwell + blink to activate | ✅ Implemented |
| 42 | Blink-only on target | single/double/triple | ✅ Implemented |
| 43 | Gesture triggers | eyebrow, smile, head turn, etc. | ✅ Implemented |
| 44 | calibrationMode | Ignore gaze when calibrating | ✅ Implemented |

### 3.5 FloatingControls

| # | Control | Status |
|---|---------|--------|
| 45 | Remote Control toggle | Enable/disable, dispatch remoteControlUserStart + cameraUserStart | ✅ Implemented |
| 46 | BlinkRemoteControl sheet | Open settings | ✅ Implemented |
| 47 | openRemoteControlSettings | Opens sheet, enables RC, dispatches cameraUserStart | ✅ Implemented |

---

## 4. Co-Existence & Collision Handling

### 4.1 States

| RC | Eye Tracking | Camera Owner | Data Source |
|----|--------------|--------------|-------------|
| OFF | OFF | None | — |
| OFF | ON | useEyeTracking | Own useVisionEngine or skin-tone |
| ON | OFF | useBlinkRemoteControl | useVisionEngine |
| ON | ON | useBlinkRemoteControl | visionEngineSample → useEyeTracking |

### 4.2 Implemented Collision Fixes

| Fix | Description |
|-----|-------------|
| RC-first check | useEyeTracking never opens camera when RC enabled |
| releaseOwnCamera | When visionEngineSample arrives, release eye-tracking camera immediately |
| remoteControlSettingsChanged | RC on → release camera; RC off + enabled → startTracking |
| source / visionStatus | UI can show which path is active |
| usingVisionEngineRef | Guards against starting skin-tone when Vision will provide data |

### 4.3 Event Flow

```
RC ON + Eye Tracking ON:
  useBlinkRemoteControl (camera) → useVisionEngine → visionEngineSample
  useEyeTracking listens → scores attention, no camera

RC OFF + Eye Tracking ON:
  useEyeTracking.startTracking → camera → useVisionEngine (own)
  OR skin-tone fallback after 5s
```

### 4.4 calibrationActive Edge Case

When BlinkRemoteControl has calibration open (EyeBlinkCalibration, etc.):
- `calibrationActiveRef.current === true`
- useBlinkRemoteControl does **not** broadcast visionEngineSample (early return)
- useEyeTracking receives **no** data if it was relying on visionEngineSample
- **Impact:** If user plays promo while RC calibration is open, attention scoring stops until calibration closes

---

## 5. Buttons & Controls Reference

### MediaSettings (Eye Tracking)

| Button | Action | Storage Key |
|--------|--------|-------------|
| Eye Tracking toggle | Enable/disable | visuai-eye-tracking-enabled |
| Strict / Normal / Relaxed | Set attention preset | visuai-attention-preset |
| Eye indicator position | 5 options | visuai-eye-indicator-position |
| Attention threshold | Slider 1–10 | visuai-attention-threshold |

### MediaCard (Promo)

| Element | Behavior |
|---------|----------|
| Play button | Starts video, dispatches cameraUserStart |
| Tap-to-enable overlay | Shown when needsUserGesture, tap retries camera |
| EyeTrackingIndicator | Progressive hide, visionStatus badge |
| AttentionProgressBar | Quality segments |
| Focus challenge | After 3rd attention loss |
| Continue (after pause) | Resumes, dispatches cameraUserStart |
| End stats | Score, attentive time, eligible |

### FloatingControls

| Button | Action |
|--------|--------|
| Remote Control toggle | Enable/disable RC, dispatch remoteControlUserStart + cameraUserStart |
| BlinkRemoteControl (sheet) | Open settings |

### BlinkRemoteControl Tabs

| Tab | Key controls |
|-----|--------------|
| Commands | Per-button: blink action |
| Combos | Add/remove, practice |
| Targets | TargetEditor, presets |
| Gaze | Direction mapping |
| Audio | Voice calibration |
| Settings | Sensitivity, gaze hold, mirror, vision backend |

---

## 6. Bugs, Fails & Possible Improvements

### 6.1 Fixed (✅)

| Issue | Fix |
|-------|-----|
| Duplicate camera | RC-first, releaseOwnCamera, remoteControlSettingsChanged |
| getAttentionResult inconsistency | Same rolling-window semantics, source in result |
| No visionEngineSample when RC off | useEyeTracking runs own useVisionEngine |
| Camera not started (iOS gesture) | cameraUserStart, needsUserGesture overlay, iOS tap-to-play |
| Console logs in production | Dev-gated logger |
| Gesture thresholds not persisted | deriveGestureThresholdsFromExpressions, mergeGestureThresholds |

### 6.2 Known Issues

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| Resolved | Skin-tone fallback accuracy | useEyeTracking, VisionContext | FIXED: Multi-zone, eye-region, HSV, liveness; skin-tone fallback in VisionContext when MediaPipe fails |
| Medium | calibrationActive suspends vision | useBlinkRemoteControl | When calibration open, no visionEngineSample. Eye-tracking gets nothing |
| Low | attentionThreshold slider | MediaSettings | Stored but not used in scoring (presets override) |
| Low | useAttentionVerification | Legacy | Not used; could be removed or documented as alternative |
| Low | Voice substring matching | voiceCommands | "play" can match "display" |

### 6.3 Possible Improvements

| Area | Suggestion |
|------|------------|
| Co-existence | ~~Unified VisionContext – single camera provider for both~~ IMPLEMENTED |
| UX | Clear "Camera: attention + control" when both on |
| UX | Calibration hint when attention scores consistently low |
| UX | ~~Reduce camera permission prompts – reuse single camera~~ IMPLEMENTED via VisionContext |
| Accuracy | WebGazer as alternative (Phase 3 deferred) |
| Accuracy | Per-user attention thresholds from calibration |
| Code | Remove or document useAttentionVerification |
| Code | Wire attentionThreshold slider or remove from UI |

---

## 7. Testing Checklist

| # | Scenario | Expected |
|---|----------|----------|
| 1 | RC off, Eye tracking on, play promo | Vision Engine or skin-tone; rewards work |
| 2 | RC on, Eye tracking on, play promo | No second camera, visionEngineSample used |
| 3 | RC on first, then play promo | No duplicate camera |
| 4 | Play promo first, then enable RC | Camera handoff, no duplicate |
| 5 | Calibration open | Vision suspended, no phantom targets |
| 6 | Tab hidden | Attention lost callback |
| 7 | iOS, promo with eye tracking | Tap required to start (no auto-play) |
| 8 | needsUserGesture true | "Tap to enable" overlay, tap retries |
| 9 | Blink 1/2/3 on target | Correct action |
| 10 | Gaze dwell | Ghost activation |
| 11 | Vision backend switch | Both Face Mesh and Face Landmarker work |
| 12 | Focus challenge | Triggers after 3rd loss, max 1/10s |
| 13 | Auto-pause | After >50% attention lost, >5s watched |
| 14 | Preset change | Strict/normal/relaxed applied |
| 15 | Eye indicator position | All 5 positions render correctly |

---

## 8. File Reference

### Eye-Tracking
- `src/hooks/useEyeTracking.ts` – Main hook
- `src/hooks/useAttentionVerification.ts` – Legacy
- `src/constants/attention.ts` – Presets, weights
- `src/components/EyeTrackingIndicator.tsx`
- `src/components/AttentionProgressBar.tsx`
- `src/components/FocusChallengeMiniGame.tsx`
- `src/components/AttentionHeatmap.tsx`
- `src/components/PerfectAttentionCelebration.tsx`
- `src/components/MediaSettings.tsx`
- `src/components/MediaCard.tsx` – Consumer

### Remote Control
- `src/hooks/useBlinkRemoteControl.ts`
- `src/hooks/useVisionEngine.ts`
- `src/hooks/useGazeDirection.ts`
- `src/hooks/useGestureCombos.ts`
- `src/components/BlinkRemoteControl.tsx`
- `src/components/FloatingControls.tsx`
- `src/components/TargetOverlay.tsx`
- `src/components/EyeBlinkCalibration.tsx`
- `src/components/FacialExpressionScanning.tsx`
- `src/components/SlowBlinkTraining.tsx`
- `src/components/VoiceCalibration.tsx`

### Shared
- `src/contexts/VisionContext.tsx` – Single camera provider for RC and eye-tracking
- `src/lib/logger.ts` – Dev-gated logging
- `src/lib/utils.ts` – isIOS, dispatchCameraUserStart
- `src/services/calibration.service.ts`
- Supabase function: `validate-attention`

---

*End of Full Audit*
