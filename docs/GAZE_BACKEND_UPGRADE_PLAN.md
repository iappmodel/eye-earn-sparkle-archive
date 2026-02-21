# Gaze Backend Upgrade Plan: GazeCloud & Deep Learning

## Executive Summary

This plan evaluates adding **GazeCloud API** and **deep learning** gaze backends to improve eye-tracking and remote control accuracy. The project already uses MediaPipe (~2–4° accuracy). GazeCloud offers higher accuracy with server-side processing; WebEyeTrack and similar deep learning models offer ~1.4–2.3° accuracy with on-device inference.

---

## 1. Backend Comparison

| Backend | Accuracy | Privacy | Cost | Maturity | Mobile |
|---------|----------|---------|------|----------|--------|
| **MediaPipe** (current) | ~2–4° | Full client-side | Free | Production | Yes |
| **GazeCloud API** | Higher | Video processed server-side* | Commercial | Production | Yes |
| **WebEyeTrack** | ~2.32 cm (GazeCapture) | Full client-side | Free | Research (2025) | Yes (2.4ms on iPhone 14) |
| **WebGazer.js** | ~3–4° | Full client-side | Free | Production | Yes |

*GazeRecorder privacy policy states no video/images are stored; real-time processing may still send frames to their servers. Confirm before use.

---

## 2. GazeCloud API

### 2.1 How It Works

- Include `GazeCloudAPI.js` from `https://api.gazerecorder.com/`
- Register domain at `https://api.gazerecorder.com/register/`
- Call `GazeCloudAPI.StartEyeTracking()` after user gesture
- Receive gaze via `GazeCloudAPI.OnResult = function(GazeData) { docX, docY, state, time }`
- Built-in calibration flow; `state`: 0=valid, -1=face lost, 1=uncalibrated

### 2.2 Pros

- Higher accuracy than MediaPipe
- Simple API, minimal integration
- Strong calibration flow
- Real-time gaze in document coordinates
- Works with standard webcams

### 2.3 Cons

- **Privacy:** Processing likely happens server-side (video streamed to GazeRecorder). Not suitable if you require strict on-device-only processing.
- **Cost:** Commercial; pricing not public (contact required)
- **Vendor lock-in:** Depends on external service availability
- **Domain registration:** Must whitelist each domain

### 2.4 Recommendation

**Use only if:** You accept server-side processing and have budget for commercial API. For a rewards/attention app with privacy-sensitive users, **not recommended** as primary backend.

**Optional use case:** Offer as a "High Accuracy (Beta)" option for users who explicitly opt in and accept privacy terms.

---

## 3. Deep Learning: WebEyeTrack & Similar

### 3.1 WebEyeTrack (arXiv 2025)

- **Accuracy:** 2.32 cm error on GazeCapture; ~1.4° equivalent in research benchmarks
- **Speed:** 2.4 ms inference on iPhone 14
- **Calibration:** Few-shot learning, 9 calibration samples
- **Privacy:** Fully on-device
- **Availability:** Open source, PyPI package, browser implementation in progress

### 3.2 GazeTracker (Academic)

- Browser-based deep learning
- Open source
- Less documented than WebEyeTrack

### 3.3 L2CS-Net, ETH-XGaze

- State-of-the-art accuracy in research
- Python/PyTorch only; no browser implementation
- Would require model conversion (PyTorch → ONNX → TensorFlow.js or ONNX.js)

### 3.4 Recommendation

**WebEyeTrack** is the most promising client-side upgrade when its browser implementation is stable. Monitor the project; integrate when:

- Browser build is released and documented
- Performance validated on target devices (iOS Safari, Android Chrome)

---

## 4. Proposed Architecture: Multi-Backend Gaze Provider

Extend the existing `visionBackend` pattern to support multiple gaze sources:

```
visionBackend: 'mediapipe' | 'gazecloud' | 'webeyetrack'
```

### 4.1 Gaze Provider Interface

```ts
interface GazeProvider {
  start(): Promise<void>;
  stop(): void;
  onGaze(cb: (data: GazeSample) => void): () => void;
  getCalibrationRequired(): boolean;
  startCalibration?(): Promise<void>;
}
```

### 4.2 Integration Points

| Component | Change |
|-----------|--------|
| `useVisionEngine` | Keep for MediaPipe (face, EAR, blink). Add `GazeCloudAdapter` / `WebEyeTrackAdapter` for gaze-only when backend is gazecloud/webeyetrack |
| `VisionContext` | When backend is gazecloud, use GazeCloud for gaze; keep MediaPipe for blink/EAR or use GazeCloud's face state |
| `useBlinkRemoteControl` | Consume gaze from active provider; blink may still come from MediaPipe (GazeCloud does not expose blink) |
| `useEyeTracking` | Consume gaze + face presence from active provider |
| Settings | Add "Gaze backend" selector: MediaPipe (default) \| GazeCloud (opt-in) \| WebEyeTrack (when available) |

### 4.3 GazeCloud-Specific Notes

- GazeCloud provides `docX`, `docY` (document coordinates) — map to normalized 0–1 for attention scoring
- GazeCloud does **not** provide EAR/blink — keep MediaPipe running for blink detection when using GazeCloud for gaze, or use GazeCloud's `state` for face presence only
- Calibration: GazeCloud has its own flow; skip RC calibration for gaze when GazeCloud is active

### 4.4 WebEyeTrack-Specific Notes

- Requires 9-point calibration before use
- Output: gaze position (normalized or pixel)
- Can replace MediaPipe for gaze; blink may need separate model or MediaPipe fallback

---

## 5. Implementation Phases

### Phase 1: Fix Current System (Priority)

Before adding new backends, fix the audit findings:

1. User gesture timing in VisionContext
2. Stale refs in useEyeTracking sample interval
3. calibratedGazePosition for VisionContext path
4. RC auto-start race

### Phase 2: GazeCloud Adapter (Optional)

**Effort:** 2–3 days

1. Create `src/lib/gaze/GazeCloudAdapter.ts`
2. Load `GazeCloudAPI.js` dynamically when backend is `gazecloud`
3. Map `OnResult` to `visionEngineSample`-compatible payload
4. Add settings toggle + privacy consent for GazeCloud
5. When GazeCloud active: use it for gaze; keep MediaPipe for blink (or GazeCloud state for face)

**Blockers:** Domain registration, pricing, privacy policy confirmation

### Phase 3: WebEyeTrack Adapter (Future)

**Effort:** 1–2 weeks (when browser build is available)

1. Add WebEyeTrack dependency or copy browser build
2. Create `src/lib/gaze/WebEyeTrackAdapter.ts`
3. Implement 9-point calibration UI
4. Wire to VisionContext / visionEngineSample
5. Benchmark on iOS and Android

**Blockers:** Stable browser release, performance validation

### Phase 4: WebGazer Fallback (Low Effort)

**Effort:** 1 day

- Add WebGazer as `visionBackend: 'webgazer'`
- Self-calibration from clicks; useful for users where MediaPipe performs poorly
- Simpler than GazeCloud/WebEyeTrack

---

## 6. Privacy & Compliance

| Backend | Data Location | GDPR/Privacy |
|---------|---------------|--------------|
| MediaPipe | Device only | No external transfer |
| WebEyeTrack | Device only | No external transfer |
| WebGazer | Device only | No external transfer |
| GazeCloud | Likely server | Verify; may need consent and DPA |

For EU users and strict privacy requirements, prefer MediaPipe, WebEyeTrack, or WebGazer. Use GazeCloud only with explicit opt-in and clear disclosure.

---

## 7. Recommended Order

1. **Now:** Implement audit fixes (user gesture, stale refs, etc.)
2. **Short term:** Add WebGazer as optional backend (low effort, client-side)
3. **Medium term:** Evaluate GazeCloud if you need higher accuracy and accept server-side processing; implement adapter with opt-in
4. **Long term:** Integrate WebEyeTrack when browser build is production-ready

---

## 8. Files to Create/Modify

### New Files

- `src/lib/gaze/GazeCloudAdapter.ts` (Phase 2)
- `src/lib/gaze/WebEyeTrackAdapter.ts` (Phase 3)
- `src/lib/gaze/types.ts` (shared GazeSample interface)

### Modified Files

- `src/hooks/useBlinkRemoteControl.ts` — extend visionBackend type
- `src/contexts/VisionContext.tsx` — support gaze adapters
- `src/hooks/useEyeTracking.ts` — consume from active gaze provider
- `src/components/BlinkRemoteControl.tsx` — add backend selector UI
- `index.html` — conditionally load GazeCloudAPI.js (or load via adapter)
