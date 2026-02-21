# Eye-Tracking & Remote Control – Full System Audit for External Review

**Purpose:** Paste this document into ChatGPT (or similar) to get an independent audit and recommendations for improving the eye-tracking and remote control systems.

**Stack:** React, TypeScript, Vite, MediaPipe (face_mesh + face_landmarker), Supabase

---

## 1. Executive Summary

This app has two vision-based features:

1. **Eye-Tracking:** Verifies user attention during promo videos for rewards. Uses face presence, eyes open (EAR), gaze forward, and head pose. Supports MediaPipe Vision Engine and a skin-tone fallback when MediaPipe fails.

2. **Remote Control:** Hands-free control via gaze, blinks, and gestures. Includes dwell activation, blink patterns (single/double/triple), winks, facial expressions, and gaze navigation.

Both features were recently merged into a **unified VisionContext** that owns a single camera and shared MediaPipe pipeline. After the merge, users report: eye-tracking not working, calibrations failing, face overlay lines disappearing, remote control not working, and "No face" detection errors.

---

## 2. Architecture Overview

### 2.1 Current (Post-Merge) Flow

```
App
├── VisionStreamProvider (provides null; VisionContext owns camera)
├── VisionProvider (VisionContext)
│   ├── Single camera (getUserMedia)
│   ├── useVisionEngine (MediaPipe on off-screen video)
│   ├── Skin-tone fallback when MediaPipe has no face
│   └── mergedVision → visionState
├── GazeBackendBridge (optional: GazeCloud/WebGazer → visionEngineSample)
└── Consumers:
    ├── useEyeTracking (attention scoring for promos)
    └── useBlinkRemoteControl (gaze, blinks, gestures)
```

**Key flag:** `USE_VISION_CONTEXT = true` in VisionContext.tsx. When true, both hooks use `visionCtx.requestCamera()` and `visionCtx.visionState` instead of their own camera.

### 2.2 Data Paths by State

| RC | Eye Tracking | Camera Owner | Vision Source |
|----|--------------|--------------|---------------|
| OFF | OFF | None | — |
| OFF | ON | VisionContext | visionCtx.visionState (or GazeBackendBridge → visionEngineSample) |
| ON | OFF | VisionContext | visionCtx.visionState |
| ON | ON | VisionContext | RC broadcasts visionEngineSample; eye-tracking consumes it |

### 2.3 Calibration Components (Independent)

EyeBlinkCalibration, FacialExpressionScanning, SlowBlinkTraining each have their **own** camera and useVisionEngine. They do NOT use VisionContext. They open their own getUserMedia when the modal opens.

---

## 3. Eye-Tracking System – Deep Dive

### 3.1 useEyeTracking Hook – Core Logic

**Sampling loop:**
- Sample interval: `SAMPLE_INTERVAL_MS = 100` (10 Hz)
- Batched sampling: processes latest vision payload every 100ms
- Priority: (1) visionEngineSample from RC, (2) visionCtx.visionState when useContextPath, (3) own useVisionEngine when useOwnVision

**Path selection:**
```ts
useContextPath = !useAlternateGaze && USE_VISION_CONTEXT && !!visionCtx && enabled && !rcEnabled
useOwnVision = !useAlternateGaze && enabled && !rcEnabled && !useContextPath
```
- When RC off + eye tracking on + USE_VISION_CONTEXT: useContextPath=true, useOwnVision=false → uses VisionContext
- When RC on: useOwnVision=false, listens for visionEngineSample
- When gazeBackend is gazecloud/webgazer: useAlternateGaze=true → no own camera, consumes visionEngineSample from GazeBackendBridge

**visionEngineSample parsing:**
- Expects `{ hasFace, eyeEAR, gazePosition, calibratedGazePosition?, headYaw?, headPitch?, needsUserGesture? }`
- Uses calibratedGazePosition when present for reward validation

### 3.2 Attention Scoring (attentionScoring.ts)

- **Time-weighted ledger:** Rolling window of `{ t, attentive }` entries
- **attentive** = hasFace && rawScore >= threshold (vision: 0.58–0.66, fallback: 0.70–0.78 by preset)
- **rawScore:** Weighted sum: face (20%), eyes (25%), gaze (40%), pose (15%)
- **attentiveMs / totalMs** = fraction of window that was attentive → final score 0–100
- **EMA for UI:** `uiEma = uiEma * 0.8 + rawScore * 0.2` (smoothing)
- **Starvation:** If no valid sample for 700ms, apply fail-closed `{ hasFace: false }`

### 3.3 Presets (attention.ts)

| Preset | earClosed | earOpen | gazeEllipse | attentiveThresholdVision | maxYaw | maxPitch | rollingWindowMs |
|--------|-----------|---------|-------------|---------------------------|-------|----------|-----------------|
| strict | 0.14 | 0.28 | 0.24×0.30 | 0.66 | 12° | 10° | 1500ms |
| normal | 0.12 | 0.26 | 0.30×0.36 | 0.62 | 20° | 15° | 2000ms |
| relaxed | 0.10 | 0.24 | 0.36×0.42 | 0.58 | 28° | 22° | 2500ms |

### 3.4 Skin-Tone Fallback (skinToneFallback.ts)

When MediaPipe has no face for 5s, fallback runs every 200ms on a 160×160 center crop:
- Multi-zone validation (top/mid/bottom, left/center/right)
- Eye-region darkness (eyes darker than cheeks)
- HSV/YCbCr skin model
- Liveness/motion (reject static photos)
- Weights: zone 25%, spread 20%, eye 25%, motion 15%, skin 15%
- Returns `{ rawScore, facePresent, lastFlags }`

### 3.5 Constants

- `VISION_FALLBACK_MS = 5000` – wait before skin-tone
- `VISION_RETRY_INTERVAL_MS = 30000` – retry MediaPipe when on fallback
- `STARVATION_MS = 700` – fail-closed if no sample
- `FALLBACK_STARVING_MS = 500` – fallback eligibility

---

## 4. Remote Control System – Deep Dive

### 4.1 useBlinkRemoteControl Hook

**Path selection:**
```ts
useContextPath = USE_VISION_CONTEXT && !!visionCtx
vision = useContextPath ? (visionCtx?.visionState ?? legacyVision) : legacyVision
```
- When USE_VISION_CONTEXT: always uses visionCtx.visionState
- legacyVision = own useVisionEngine, enabled only when !useContextPath

**Camera:**
- When useContextPath: `visionCtx.requestCamera()` + `visionCtx.startCamera()`
- When !useContextPath: own getUserMedia, own videoRef

**visionEngineSample broadcast:**
- When RC enabled and !calibrationActive: dispatches CustomEvent('visionEngineSample', { hasFace, eyeEAR, gazePosition, calibratedGazePosition, headYaw, headPitch })
- Eye-tracking consumes this when RC is on

### 4.2 useVisionEngine (MediaPipe)

- **Backends:** face_mesh (legacy CDN) or face_landmarker (tasks-vision WASM)
- **Output:** hasFace, landmarks (468), faceBox, eyeEAR, gazePosition (iris 468–477), headYaw, headPitch, blinkCount
- **Shared driver:** One global FaceMesh/FaceLandmarker; driverPriority for calibration
- **Blink:** EAR-based with baseline, close/reopen thresholds, calibrationMode (looser)
- **Gaze smoothing:** EMA (gazeSmoothing 0.25)
- **minDetectionConfidence / minTrackingConfidence:** Default 0.6; calibration components use 0.4

### 4.3 Gaze Backends

- **mediapipe** (default): useVisionEngine
- **gazecloud**: Server-side API, higher accuracy, requires domain registration
- **webgazer**: Client-side, self-calibrates from clicks
- GazeBackendBridge: When gazeBackend is gazecloud/webgazer and RC off, starts adapter and emits visionEngineSample

---

## 5. VisionContext – Merge Implementation

### 5.1 Structure

- Owns single camera (getUserMedia 320×240)
- Creates off-screen video element (not in DOM)
- useVisionEngine enabled when: `!visionStream && isActive && !!videoRef.current`
- requestCamera(): ref-count; when first request, startCameraInternal()
- cameraUserStart / remoteControlUserStart: unconditionally call startCameraInternal() (for iOS user gesture)

### 5.2 mergedVision

Combines:
1. visionStream + streamSample (null when VisionStreamProvider provides null)
2. Skin-tone fallback when MediaPipe has no face > 5s
3. Raw vision from useVisionEngine

### 5.3 Blink Handlers

RC registers onBlink, onBlinkPattern, onLeftWink, onRightWink with VisionContext. VisionContext's useVisionEngine calls these when blinks/winks detected.

---

## 6. Known Issues & Regression Points

### 6.1 Post-Merge Regressions (User-Reported)

- Eye-tracking not working
- Calibrations not working ("No face")
- Face overlay lines disappeared
- Remote control not working

### 6.2 Identified Technical Issues

| Issue | Location | Description |
|-------|----------|-------------|
| VisionContext video lifecycle | VisionContext | useVisionEngine enabled only when isActive && videoRef.current; possible race on startup |
| Request count vs gesture | VisionContext | cameraUserStart calls startCameraInternal without incrementing requestCount; camera can run with no owner briefly |
| Calibration independence | EyeBlinkCalibration, etc. | Use own camera; "No face" may be MediaPipe thresholds (0.4 now) or user gesture timing |
| calibrationActive suspends vision | useBlinkRemoteControl | When calibration open, no visionEngineSample; eye-tracking gets nothing if playing promo |
| attentionThreshold slider | MediaSettings | Stored but not used in scoring (presets override) |
| VisionContext video not in DOM | VisionContext | Off-screen video; no visible face overlay from context |

### 6.3 Possible Root Causes of "No Face"

- MediaPipe minDetectionConfidence/minTrackingConfidence too high (lowered to 0.4 in calibration)
- getUserMedia not in user gesture stack (iOS) – handler now calls startCameraInternal unconditionally
- Lighting (e.g. magenta/purple) affecting MediaPipe
- Model loading delay
- VisionContext not ready when consumers read visionState

---

## 7. File Reference

### Eye-Tracking
- `src/hooks/useEyeTracking.ts` – Main hook (~1060 lines)
- `src/lib/attentionScoring.ts` – Time-weighted ledger, computeRawAttention, applyAttentionSample
- `src/constants/attention.ts` – Presets, ATTENTION_CONFIGS
- `src/constants/attentionPass.ts` – getPassThreshold, isCashEligible
- `src/components/EyeTrackingIndicator.tsx`
- `src/components/AttentionProgressBar.tsx`
- `src/components/FocusChallengeMiniGame.tsx`
- `src/components/MediaCard.tsx` – Consumer

### Remote Control
- `src/hooks/useBlinkRemoteControl.ts` (~1400 lines)
- `src/hooks/useVisionEngine.ts` (~1000 lines)
- `src/hooks/useGazeBackendBridge.ts`
- `src/components/BlinkRemoteControl.tsx`
- `src/components/TargetOverlay.tsx`
- `src/components/EyeBlinkCalibration.tsx`
- `src/components/FacialExpressionScanning.tsx`
- `src/components/SlowBlinkTraining.tsx`

### Shared / Merge
- `src/contexts/VisionContext.tsx` – Single camera, USE_VISION_CONTEXT flag
- `src/contexts/VisionStreamContext.tsx` – Provides null
- `src/lib/skinToneFallback.ts` – analyzeSkinToneFrame
- `src/lib/gaze/` – GazeCloudAdapter, WebGazerAdapter, types

---

## 8. Revert Option

Setting `USE_VISION_CONTEXT = false` restores pre-merge behavior:
- useBlinkRemoteControl: own camera + useVisionEngine
- useEyeTracking: own camera + useVisionEngine when RC off; visionEngineSample when RC on
- Two camera prompts when both features used; no shared pipeline

---

## 9. Questions for External Auditor

1. **Merge vs Revert:** Given the regressions, should we revert to pre-merge (USE_VISION_CONTEXT=false) or continue fine-tuning the unified VisionContext? What are the tradeoffs?

2. **Attention scoring:** Is the time-weighted ledger + EMA approach optimal? Are there better algorithms for attention verification that reduce false positives/negatives?

3. **Skin-tone fallback:** The fallback uses multi-zone, eye-region darkness, HSV, and liveness. How can we tune it further or replace it with a better approach?

4. **Face detection reliability:** What can we do to improve MediaPipe face detection in challenging lighting (e.g. magenta, low light)? Are there better models or preprocessing steps?

5. **Gaze backends:** MediaPipe vs GazeCloud vs WebGazer – when should each be recommended? Is there a better open-source or commercial option for web-based gaze tracking?

6. **Calibration flow:** Calibration modals use their own camera. Should they share VisionContext's camera instead to reduce permission prompts, or is isolation better for reliability?

7. **Architecture:** Is a single VisionContext the right abstraction, or would a different design (e.g. separate providers with optional sharing) be more maintainable?

8. **Performance:** useVisionEngine can run in a Web Worker. Are there other optimizations for low-end devices?

---

*End of audit document. Paste into ChatGPT and ask: "Audit this eye-tracking and remote control system. Identify the best options to improve reliability, accuracy, and user experience. Consider: revert vs fine-tune the merge, attention scoring improvements, face detection reliability, and architecture recommendations."*
