
# Fix Discovery Map Buttons Not Working on Mobile

## Root Cause Analysis

I found **two critical bugs** preventing the Route button and Check-In History from working on mobile:

### Bug 1: NeuButton doesn't use standard click handling
The `NeuButton` component uses `onMouseDown`/`onMouseUp` and `onTouchStart`/`onTouchEnd` instead of a standard `onClick` on the actual `<button>` element. On mobile, especially over a Mapbox GL map that aggressively captures touch events, this approach is unreliable -- finger movements of even a few pixels can cause the touchend to not trigger properly.

### Bug 2: NeuButton is incompatible with Radix's `asChild` pattern
The `CheckInHistory` wraps a `NeuButton` with `SheetTrigger asChild`. Radix's `asChild` clones the first child element and attaches `onClick` and `ref` to it. However, `NeuButton` renders a `<div>` wrapper around the actual `<button>`, so:
- Radix's click handler goes to the outer `<div>`
- NeuButton's own touch-based click handling is on the inner `<button>`
- On mobile, these two systems conflict, and taps often get "swallowed" by the map

### Bug 3: No touch-action isolation on header
The header overlay sits above the Mapbox GL canvas but doesn't declare `touch-action: auto`, so the map's gesture handlers can intercept touches meant for the header buttons.

---

## Implementation Steps

### Step 1: Fix NeuButton to use standard `onClick`
Modify `src/components/NeuButton.tsx` to:
- Add a standard `onClick` handler on the `<button>` element as the primary click mechanism
- Keep `onMouseDown`/`onTouchStart` only for the visual "press" effect (scale down)
- Keep `onMouseUp`/`onTouchEnd` only for the visual "release" effect (scale back up)
- Remove the `onClick?.()` call from `handleRelease` since the native `onClick` event will handle it
- Add `forwardRef` support so it works with Radix's `asChild` pattern

### Step 2: Fix CheckInHistory trigger compatibility
Modify `src/components/DiscoveryMap.tsx` to change the CheckInHistory trigger so it doesn't rely on `asChild` through a NeuButton wrapper. Instead, manage the open state manually:
- Use a simple `onClick` on the NeuButton to toggle the CheckInHistory sheet open state
- Pass `open`/`onOpenChange` directly to CheckInHistory instead of relying on `SheetTrigger asChild`

### Step 3: Add touch-action isolation to the header
Modify `src/components/DiscoveryMap.tsx` to add `touch-action: auto` and proper `pointer-events` to the header container, preventing the Mapbox GL canvas from intercepting touch events on the header buttons.

### Step 4: Ensure Route button visibility on narrow screens
The header has 5 buttons in a row. On very narrow screens (320px), these can overflow. Wrap the buttons in a scrollable container or reduce button sizes to ensure they are always visible.

---

## Technical Details

### Files to modify:

1. **`src/components/NeuButton.tsx`**
   - Add `forwardRef` wrapping
   - Move `onClick` to a standard `onClick` handler on the `<button>`
   - Keep touch/mouse handlers only for visual press animation
   - This fixes ALL NeuButton-based interactions across the entire app

2. **`src/components/DiscoveryMap.tsx`**
   - Add `touch-action: auto` style to the header container
   - Change CheckInHistory from using `SheetTrigger asChild` to controlled open/close state
   - Add a state variable `showCheckInHistory` and pass it to the CheckInHistory component
   - Ensure the header buttons area has `pointer-events: auto`

3. **`src/components/CheckInHistory.tsx`**
   - Accept optional `open` and `onOpenChange` props for controlled mode
   - Keep backward compatibility with the `trigger` prop for uncontrolled usage

### No database changes or new dependencies required.
