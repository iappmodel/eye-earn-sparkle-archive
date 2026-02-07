
# Add Haptic Feedback to Bottom Navigation Taps

## What changes
Two tap handlers in `BottomNavigation.tsx` currently have no haptic feedback:
- **`handleClick`** (tapping Home, Discover, Messages, Profile) -- no vibration
- **`handleLogoClick`** (tapping the center logo to go to Create) -- no vibration

The long-press and shortcut handlers already use haptic feedback correctly, so this is just filling in the gap for regular taps.

## Technical Details

**File: `src/components/BottomNavigation.tsx`**

1. **`handleClick` (line 100)**: Add `haptic.light()` at the start of the function (after the long-press guard check on line 103). This gives a subtle vibration when switching between tabs -- light intensity so it feels responsive without being intrusive.

2. **`handleLogoClick` (line 74)**: Add `haptic.light()` before `navigate('/create')` so the center logo button also provides tactile feedback.

Both use the `light` haptic (10ms vibration) since tab switching should feel snappy and subtle, consistent with the existing shortcut selection feedback. The `haptic` object from `useHapticFeedback` is already available in the component scope.

No new files or dependencies needed -- this is a two-line addition to an existing file.
