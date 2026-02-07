
# Fix Save Button Reliability (1-Second Long Press)

## Problem
The save button on the main feed double-fires on touch devices (touch events + synthesized mouse events both trigger, toggling save on then immediately off). There is also no `onClick` fallback on the `NeuButton`, so desktop clicks can silently fail.

## Fix

### File: `src/components/FloatingControls.tsx`

**Add two new refs** alongside the existing `saveLongPressTimer`:
- `didLongPress` (boolean) -- prevents `onClick` from firing after a long press opens the gallery
- `touchFired` (boolean) -- prevents `onMouseDown` from firing after `onTouchStart` (stops double-fire on mobile)

**Rewrite the save button event handlers:**

- `handleSaveTouchStart`: Sets `touchFired = true`, starts a **1-second** timer. When it fires, sets `didLongPress = true`, calls `onSaveLongPress()`.
- `handleSaveTouchEnd`: Clears the timer if still running, resets `touchFired` after a short delay.
- `handleSaveMouseDown`: If `touchFired` is true, returns early (prevents double-fire). Otherwise starts the same 1-second timer.
- `handleSaveMouseUp` / `handleSaveMouseLeave`: Clears the timer.
- `handleSaveClick` (new, on the `NeuButton`): If `didLongPress` is true, resets the flag and returns. Otherwise calls `onSaveVideo()`.

**Add `onTouchCancel`** to the wrapper div for proper cleanup.

**Result:**
- Quick tap (any device): Reliably saves/unsaves via `onClick`
- Hold 1 second: Opens the saved videos gallery
- No double-firing on mobile

This is a single-file change. No other files are modified.
