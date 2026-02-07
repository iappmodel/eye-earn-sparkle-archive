
# Remove Next Button and Stack Controls Vertically

## What Changes

The middle-screen controls that appear when you tap the video currently show three buttons in a horizontal row: **Play/Pause**, **Mute**, and **Next (Skip)**. 

- The **Next** button will be removed entirely since swiping up already navigates to the next video.
- The **Mute** button will be placed directly above the **Play/Pause** button, both centered on screen symmetrically.

## Layout Change

Current layout (horizontal row):
```text
[ Play/Pause ]  [ Mute ]  [ Next ]
```

New layout (vertical stack, centered):
```text
   [ Mute ]
 [ Play/Pause ]
```

Both buttons will be horizontally centered on the screen, stacked vertically with consistent spacing.

## Technical Details

### File: `src/components/MediaCard.tsx`

1. **Remove the SkipForward import** (line 4) -- remove `SkipForward` from the lucide-react import.

2. **Remove the `handleSkipClick` function** (lines 459-462) -- this callback is no longer needed.

3. **Restructure the tap-to-reveal controls** (lines 662-697):
   - Change the container from `flex items-center gap-6` (horizontal) to `flex flex-col items-center gap-4` (vertical).
   - Place the **Mute** button first (on top), then the **Play/Pause** button below it.
   - Remove the Skip/Next button entirely.

No other files need changes -- the `onSkip` prop on `MediaCard` can remain since it's still used by external callers (like swipe navigation), but the internal skip button UI is removed.
