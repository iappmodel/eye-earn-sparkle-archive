

# Mobile Optimization Plan

This plan addresses multiple issues to make the app look and work properly on mobile screens (phones and small tablets).

## Issues Found

1. **App.css conflicts** -- The default `App.css` file sets `max-width: 1280px`, `padding: 2rem`, and `text-align: center` on `#root`, which can interfere with the full-screen mobile layout.

2. **AppShell has a left padding (`pl-16`)** -- The main content area in `AppShell` applies `pl-16` (64px left padding) assuming a sidebar, but the app uses a floating bottom navigation bar instead. This wastes screen space on mobile.

3. **Floating controls positioned too close to screen edge** -- The floating sidebar buttons use `right-3` (12px), which is fine on mobile but the bottom offset (`bottom: 100px`) may overlap with the bottom navigation on very small screens.

4. **Bottom navigation bar not accounting for safe areas** -- On phones with notches or home indicators (iPhone X+), the `bottom-6` position may be too close to the system UI. The navigation uses fixed pixel gaps rather than safe-area insets.

5. **Network status indicator overlaps content** -- The `NetworkStatusIndicator` is positioned `top-4 right-4` which can overlap with the "PROMOTED" label and screen page indicators.

6. **Feed toggle control overlaps** -- The "Unified Feed" toggle at `top-16 left-4` can overlap with the PROMOTED label or page indicators on small screens.

7. **Full-screen overlay screens (Profile, Wallet, Messages, Settings) use fixed padding** -- These use `p-6` which is generous on small phones but could be tighter; more importantly the `pb-24` needs to account for safe areas.

8. **Cross Navigation arrows can be clipped** -- The `left-6`/`right-6` placement of chevrons is tight on narrow screens (320px width).

9. **Bottom sheet heights** -- Comments panel uses `h-[70vh]` and Profile preview uses `h-[50vh]`, but per the project's overlay interactivity constraints, these should use 25% height as floating cards.

10. **MyPage content grid** -- The `grid-cols-3` content grid with `gap-1` and `p-2` works well on mobile but the floating logo button at `bottom-6 right-6` overlaps content.

---

## Implementation Steps

### Step 1: Clean up App.css conflicts
Remove or neutralize the `#root` styles in `App.css` that constrain layout (`max-width`, `padding`, `text-align`), as the app uses full-screen layouts.

### Step 2: Fix AppShell left padding
Remove the `pl-16` from `AppShell`'s main content since there is no sidebar -- the app uses a floating bottom navigation bar.

### Step 3: Add safe area support
Add CSS environment variable support for `safe-area-inset-*` to ensure the bottom navigation, floating controls, and overlay screens respect device notches and home indicators.

- Add `padding-bottom: env(safe-area-inset-bottom)` to bottom navigation
- Update floating controls bottom offset to include safe area
- Update overlay screen padding to account for safe areas

### Step 4: Improve bottom navigation for mobile
- Add safe area bottom padding to the bottom nav
- Ensure touch targets meet 44x44px minimum (currently `px-3 py-2` which is close but could be slightly small)
- Reduce label font size for narrower screens

### Step 5: Reposition UI elements to avoid overlaps
- Move the network status indicator to a less intrusive position
- Move the "Unified Feed" toggle to avoid collision with the PROMOTED badge
- Adjust cross navigation arrows for very narrow screens

### Step 6: Optimize overlay screens for mobile
- Profile, Wallet, Messages, and Settings screens: reduce `p-6` to `p-4` on mobile for more content room
- Ensure scrollable areas account for safe area bottom insets
- Bottom sheets (Comments, Share, Profile Preview): ensure they respect overlay interactivity constraints

### Step 7: Improve touch targets and spacing
- Ensure all interactive elements have at least 44x44px touch targets
- Add proper spacing between tappable elements in the floating controls sidebar
- Make sure the MorphingLikeButton tip interface is usable on small screens

### Step 8: Responsive text and element sizing
- Reduce oversized headings on screens under 375px wide
- Ensure coin displays and stat numbers don't overflow on narrow screens
- Auth page: verify form inputs and buttons are full-width and properly padded

---

## Technical Details

### Files to modify:

1. **`src/App.css`** -- Remove conflicting `#root` styles
2. **`src/components/layout/AppShell.tsx`** -- Remove `pl-16` left padding
3. **`src/index.css`** -- Add safe area CSS utilities and mobile-specific adjustments
4. **`src/components/BottomNavigation.tsx`** -- Add safe area bottom padding, improve touch targets
5. **`src/components/FloatingControls.tsx`** -- Adjust bottom offset to include safe area, ensure proper spacing
6. **`src/pages/Index.tsx`** -- Reposition network indicator and feed toggle, fix z-index layering
7. **`src/components/ProfileScreen.tsx`** -- Tighten padding on mobile, add safe area bottom inset
8. **`src/components/WalletScreen.tsx`** -- Tighten padding on mobile, add safe area bottom inset
9. **`src/components/CommentsPanel.tsx`** -- Fix bottom input area safe area inset
10. **`src/components/CrossNavigation.tsx`** -- Adjust arrow positions for narrow screens
11. **`src/pages/MyPage.tsx`** -- Adjust floating button position for safe area

### CSS additions (in `src/index.css`):
- Safe area inset utilities using `env(safe-area-inset-bottom)` etc.
- A mobile-specific media query for screens under 380px to tighten spacing
- Ensure `body` has proper `min-height: 100dvh` for mobile viewport handling

### No database changes or new dependencies required.

