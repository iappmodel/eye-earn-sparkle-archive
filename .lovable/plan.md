

# Fix Misaligned Buttons in Promotion Detail Card

## Problem
In the Discovery Map's promotion detail card, the action buttons row (Check In, + Route, Bookmark, Heart, Directions) overflows the card's boundaries. The last button(s) extend past the rounded edges because the `flex` container doesn't wrap or constrain its children.

## Solution
Make the button row responsive so all buttons stay within the card:

### File: `src/components/DiscoveryMap.tsx` (lines 1047-1109)

1. **Add `flex-wrap` to the button container** so buttons wrap to a second row on narrow screens instead of overflowing.

2. **Add `overflow-hidden`** to the card container as a safety net to prevent any visual overflow past the rounded corners.

3. **Shrink the text buttons** -- give "Check In" and "+ Route" a `min-w-0` and allow them to shrink with `flex-shrink` so they don't force the icon-only buttons off-screen.

4. **Make icon-only buttons use `flex-shrink-0`** so they keep their square shape but let the text buttons compress first.

The specific changes:

- Line 1047: Change `<div className="flex gap-2">` to `<div className="flex gap-2 flex-wrap">`
- Line 1048: On the `CheckInButton`, change `className="flex-1"` to `className="flex-1 min-w-0"` so it can shrink
- Lines 1064-1076: On the "+ Route" button, add `min-w-0 flex-shrink` to allow it to compress
- Lines 1078-1108: On the three icon-only buttons (Bookmark, Heart, ExternalLink), add `flex-shrink-0` to maintain their shape

This ensures all five buttons always fit within the card boundary regardless of screen width, wrapping to a second line only if truly necessary.
