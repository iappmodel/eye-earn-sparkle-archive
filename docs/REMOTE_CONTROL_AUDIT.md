# Remote Control Feature Audit

**Date:** February 17, 2026  
**Scope:** Blink/Gaze/Voice remote control, calibrations, accuracy

---

## Executive Summary

The remote control feature has multiple calibration flows that are **not properly connected**. The main EyeBlinkCalibration flow does not produce gaze calibration (offset/scale) that the runtime uses. Gaze accuracy is limited by MediaPipe Face Mesh's iris-based gaze estimation, which has inherent accuracy limitations on webcams. Several bugs, disconnects, and improvement opportunities were identified.

---

## Architecture Overview

| Component | Purpose |
|-----------|---------|
| `useBlinkRemoteControl` | Main hook: gaze tracking, blink patterns, calibration persistence |
| `useVisionEngine` | MediaPipe Face Mesh: landmarks, EAR, iris gaze, blink detection |
| `useGazeDirection` | Direction zones (left/right/up/down), rapid movement |
| `TargetOverlay` | Screen targets for dwell/blink activation |
| `EyeBlinkCalibration` | Multi-step calibration: eye frame → gestures → blink targets |
| `VoiceCalibration` | Voice command samples, custom phrases |
| `calibration.service` | Persists calibration to Supabase profiles |

---

## Critical Findings

### 1. **EyeBlinkCalibration Does NOT Produce Gaze Calibration (HIGH)**

**Problem:**  
EyeBlinkCalibration collects:
- `positions`: `{ position: {x,y}, blinkData: { requiredBlinks, actualBlinks, timing } }`
- No gaze coordinates (gazeX, gazeY) are recorded

The `CalibrationResult` is passed to `BlinkRemoteControl` but **never used to compute or persist** `offsetX`, `offsetY`, `scaleX`, `scaleY`. The gaze mapping used at runtime comes from:
- `useBlinkRemoteControl`'s internal calibration (startCalibration / recordCalibrationPoint)
- That flow uses rawGazePosition vs CALIBRATION_TARGETS when the user **clicks** on targets

**Impact:** Users complete EyeBlinkCalibration expecting it to calibrate gaze—it does not. The app uses default or stale calibration.

**Fix:** During EyeBlinkCalibration's blink-calibration step, when the user completes a target:
1. Average `vision.gazePosition` over the time window before the blinks
2. Store `{ targetX, targetY, gazeX, gazeY }` per position
3. On complete, compute offset/scale via least-squares or similar
4. Persist via `persistCalibration()` and pass into useBlinkRemoteControl

---

### 2. **Two Disconnected Calibration Flows (HIGH)**

| Flow | Where | What it produces | Used for gaze? |
|------|-------|------------------|----------------|
| EyeBlinkCalibration | Settings → Blink Calibration | CalibrationResult (positions + blinkData) | **No** |
| useBlinkRemoteControl calibration | Debug overlay / manual | CalibrationData (offset, scale) | **Yes** |

The settings UI promotes EyeBlinkCalibration as the main calibration, but the gaze calibration used at runtime comes from a different flow (manual target clicks with gaze recording) that most users never run.

**Fix:** Unify flows: EyeBlinkCalibration must produce and persist CalibrationData (offset, scale) from gaze samples.

---

### 3. **Iris Gaze Is Inherently Limited (MEDIUM)**

**Current:** `useVisionEngine` derives gaze from iris landmarks (468–477) within eye corners/lids. This is:
- Approximate: eye-in-head vs head-in-world is not modeled
- No per-user calibration: same model for everyone
- Sensitive to lighting, head pose, distance

**Reality:** Webcam-based gaze from 2D landmarks typically achieves ~2–5° error. Good enough for coarse targets; poor for small UI elements.

**Improvements:**
1. Add polynomial or affine mapping from (gazeX, gazeY) to screen using calibration points
2. Increase number of calibration points (e.g., 16 or 25 grid)
3. Use robust regression to downweight outliers

---

### 4. **recordCalibrationPoint Uses Click Position Wrongly (LOW)**

`handleCalibrationClick` passes `e.clientX`, `e.clientY` to `recordCalibrationPoint`.  
`recordCalibrationPoint` **ignores** these and uses `target.x`, `target.y` from CALIBRATION_TARGETS and `rawGazePosition`. So the click is only a trigger. This is correct, but:
- UX is confusing: user may think they must click *on* the target
- Better UX: "Look at the target, then tap anywhere to record" or auto-record after dwell

---

### 5. **Auto-Calibration Is Off-By Logic (MEDIUM)**

`recordInteractionForAutoCalibration` is called when user executes an action (e.g., click via blink). It uses `state.gazePosition` (already calibrated) vs target center. The offset adjustment is applied to calibration.  
**Issue:** If initial calibration is bad, auto-calibration corrects slowly (20% of error, every 10s, needs 5+ samples). Users may give up before it converges.

**Improvement:** More aggressive initial auto-calibration when `calibration.autoAdjustments < 3`.

---

### 6. **Blink Detection Tuning**

- Baseline: 8 eyes-open samples, then median
- Close/reopen thresholds: 0.72 / 0.85 of baseline
- Calibration mode uses looser values

**Observed:** False positives (squints, lighting) and false negatives (slow blinks, hooded eyes) are common. Consider:
- Per-user thresholds from SlowBlinkTraining
- `minClosedFramesForBlink` already helps; could increase to 2 for noisy environments

---

### 7. **Voice Calibration**

- Uses Web Speech API (browser-dependent)
- `matchVoiceCommand`: substring/contains matching—can cause false matches ("play" in "display")
- No confidence threshold; debounce only (1.2s)

**Improvements:**
- Prefer exact phrase match, then keyword match
- Add confidence gating when available
- Support cloud STT (e.g., Google Cloud Speech) for better accuracy (requires API key)

---

### 8. **Gesture Thresholds Not Personalized Enough**

`useBlinkRemoteControl` loads `app_gesture_thresholds` (eyebrowLift, headTurn, etc.) from calibration. EyeBlinkCalibration writes these when certain gestures complete, but:
- Only eyebrow and head get custom thresholds
- Smile, smirk, lip raises use fixed ratios (e.g., 1.12x baseline)
- No per-user tuning from FacialExpressionScanning result

**Fix:** Persist per-gesture thresholds from FacialExpressionScanning into `app_gesture_thresholds` and use them in the landmark gesture logic.

---

## Implementation Plan

### Phase 1: Fix Calibration Disconnect (Highest Impact)

1. **EyeBlinkCalibration → Gaze Calibration**
   - In blink-calibration step, sample `vision.gazePosition` while target is visible (before blinks complete)
   - Store `{ targetX, targetY, gazeSamples: [{x,y}...] }` per position
   - On complete: average gaze samples per target, compute affine/polynomial mapping
   - Call `persistCalibration({ offsetX, offsetY, scaleX, scaleY, ... })` and ensure BlinkRemoteControl passes it to useBlinkRemoteControl

2. **Unify Calibration Entry Points**
   - Ensure "Calibrate" in settings runs EyeBlinkCalibration and that its result updates runtime calibration
   - Optionally keep the manual target-click flow as "Quick Recalibrate" for advanced users

### Phase 2: Improve Gaze Accuracy ✅ IMPLEMENTED

1. **Better Mapping** ✅
   - 2D affine mapping with least-squares fit (6 params: targetX = a·gazeX + b·gazeY + c, same for Y)
   - Used when 6+ calibration points available; falls back to offset+scale for 3–5 points
   - `applyCalibration()` in useBlinkRemoteControl applies affine or legacy

2. **More Calibration Points** ✅
   - 16-point grid (4×4) available via "Extended Gaze Calibration" in Settings
   - Standard 9-point and extended 16-point; affine fit improves with more points

3. **Per-Device Calibration** ✅
   - `fetchProfileCalibration(userId, deviceId)` prefers device-specific data
   - `saveProfileCalibration()` stores per-device when `deviceId` present
   - useBlinkRemoteControl loads/syncs with deviceId

### Phase 3: External Platforms ✅ PARTIALLY IMPLEMENTED

| Platform | Status | Notes |
|----------|--------|-------|
| **MediaPipe Face Landmarker (tasks-vision)** | ✅ Implemented | Optional backend in `useVisionEngine`; toggle in Settings → Gaze |
| **WebGazer.js** | Not done | Could be added as optional gaze model in future |
| **Cloud eye tracking APIs** | Not done | Cost, latency, privacy |
| **Hardware eye trackers** | Not done | Not available on typical phones |

**Implemented (Phase 3):**
- `visionBackend: 'face_mesh' | 'face_landmarker'` in `useVisionEngine`
- Face Landmarker via `@mediapipe/tasks-vision`, WASM + CDN model
- `RemoteControlSettings.visionBackend` with UI toggle in BlinkRemoteControl
- EyeBlinkCalibration, SlowBlinkTraining, FacialExpressionScanning use settings.visionBackend

---

## Bugs & Edge Cases

| Issue | Severity | Location |
|-------|----------|----------|
| EyeBlinkCalibration result not used for gaze | High | BlinkRemoteControl, EyeBlinkCalibration |
| recordInteractionForAutoCalibration uses calibrated gaze | Medium | useBlinkRemoteControl – could use raw for correction |
| Gesture thresholds from FacialExpressionScanning not persisted | Medium | FacialExpressionScanning, useBlinkRemoteControl |
| Voice substring matching too loose | Low | voiceCommands.ts matchVoiceCommand |
| Camera paused during calibration; vision not available in some steps | Low | BlinkRemoteControl pauseCamera when calibration open |

---

## Testing Recommendations

1. Run full EyeBlinkCalibration, then verify calibration_data in profiles and localStorage
2. Confirm offset/scale change after calibration
3. Test with different face distances and lighting
4. Test voice commands with similar phrases (e.g., "play" vs "display")
5. Verify blink patterns (1/2/3) fire correctly on various devices

---

## Files to Modify

| File | Changes |
|------|---------|
| `EyeBlinkCalibration.tsx` | Record gaze samples per target; compute offset/scale; call persistCalibration |
| `BlinkRemoteControl.tsx` | Wire EyeBlinkCalibration result into persistCalibration; ensure calibration flows |
| `useBlinkRemoteControl.ts` | Accept calibration from parent; optional: better mapping (affine) |
| `FacialExpressionScanning.tsx` | Persist gesture thresholds to localStorage |
| `voiceCommands.ts` | Tighten matchVoiceCommand (exact first, then contains) |
| `calibration.service.ts` | No changes if payload already supports devices |

---

*End of audit*
