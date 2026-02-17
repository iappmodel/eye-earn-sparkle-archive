# Skin-Tone Fallback Tuning Guide

This guide explains how to tune the skin-tone fallback parameters based on real-user feedback. All tunable values live in `src/lib/skinToneFallback.ts` (`SkinToneFallbackConfig` / `DEFAULT_CONFIG`).

---

## Quick Reference: Feedback → Adjustment

| User feedback | What to adjust | Direction |
|---------------|----------------|-----------|
| "Real face rejected" (false negative) | `zoneSkinMin`, `centerSkinMin`, `eyeRegionDarknessMin`, `eyeScoreNoEyes` | Lower thresholds / raise partial credit |
| "Hand/photo accepted" (gaming) | `motionPhotoRejectThreshold`, `motionLiveThreshold`, `verticalZonesMin`, `horizontalZonesMin` | Raise thresholds / stricter liveness |
| "Bad lighting rejected" | `eyeRegionDarknessMin`, `eyeScoreNoEyes`, `zoneSkinMin` | Lower eye darkness; raise `eyeScoreNoEyes` |
| "Works with photo" | `motionPhotoRejectThreshold`, `motionLiveThreshold` | Lower live threshold; raise photo-reject |
| "Rejected when looking slightly away" | `horizontalZoneMin`, `horizontalZonesMin` | Lower horizontal thresholds |
| "Too sensitive to small movements" | `motionLiveThreshold` | Raise (requires more motion to count as live) |
| "Score fluctuates too much" | Weight distribution | Reduce `weightMotion`; rely more on stable signals |

---

## Parameters

### Zone & spread

- **`zoneSkinMin`** (default: `0.12`) – Minimum skin ratio in a vertical zone (top/mid/bottom) to count as “has skin.”
  - Lower → more permissive for partial faces or poor lighting.
  - Higher → stricter; may reject tilted heads or small frames.

- **`verticalZonesMin`** (default: `2`) – Number of vertical zones that must have skin for `facePresent`.
  - Raise to 3 to require forehead + mid + chin (harder to game with a hand).

- **`horizontalZoneMin`** (default: `0.1`) – Minimum skin ratio in a horizontal zone.
  - Lower → more permissive when looking slightly away.

- **`horizontalZonesMin`** (default: `2`) – Number of horizontal zones that must have skin.
  - Raise to 3 to require full face width.

### Eye region

- **`eyeRegionDarknessMin`** (default: `8`) – Eyes/eyebrow region must be this much darker than cheeks (luminance difference).
  - Lower → more permissive for flat lighting or hoods.
  - Higher → stricter face-structure check.

- **`eyeScoreNoEyes`** (default: `0.3`) – Partial score when eye-region check fails.
  - Raise to reduce penalty for bad lighting.
  - Lower to be stricter when eye region is not visible.

### Liveness (anti-photo)

- **`motionLiveThreshold`** (default: `0.02`) – Frame-to-frame diff above which the frame is considered “live.”
  - Lower → less motion needed to count as live (more permissive).
  - Higher → more motion needed (stricter).

- **`motionPhotoRejectThreshold`** (default: `0.01`) – Diff below which we treat as a static photo and reject.
  - Raise → reject more low-motion cases (stricter anti-photo).
  - Lower → allow more static/low-motion cases.

- **`motionScoreMin`** (default: `0.2`) – Minimum motion score when below live threshold.
  - Lower → stricter penalty for low motion.

### Skin

- **`centerSkinMin`** (default: `0.12`) – Minimum center ROI skin ratio for `facePresent`.
  - Lower → more permissive.

- **`skinScoreMaxAt`** (default: `0.25`) – Skin ratio at which `skinScore` reaches 1.
  - Lower → easier to max out skin score.

### Weights (must sum to 1.0)

- **`weightZone`** (default: `0.25`)
- **`weightSpread`** (default: `0.2`)
- **`weightEye`** (default: `0.25`)
- **`weightMotion`** (default: `0.15`)
- **`weightSkin`** (default: `0.15`)

Increase weight for signals you want to trust more; decrease for noisy ones. Example: if motion is unreliable (e.g. webcam noise), reduce `weightMotion` and increase `weightZone` or `weightEye`.

---

## Overriding config

You can pass a partial override at runtime:

```ts
import { analyzeSkinToneFrame } from '@/lib/skinToneFallback';

const result = analyzeSkinToneFrame(imageData, prevFrameRef, {
  eyeRegionDarknessMin: 5,   // more lenient for bad lighting
  motionPhotoRejectThreshold: 0.015,  // stricter anti-photo
});
```

Use this for A/B tests or environment-specific tuning (e.g. stricter in production, looser in dev).

---

## Testing checklist

1. **Real faces** – Various poses, lighting, skin tones, distances.
2. **Hand-only** – Palm or back of hand filling frame.
3. **Photo / screen** – Printed photo or phone showing a face.
4. **Partial face** – Forehead cut off, chin cut off, profile.
5. **Motion** – Very still vs. subtle head movement.

After changes, re-run these scenarios and log `rawScore`, `facePresent`, and `lastFlags` to validate behavior.
