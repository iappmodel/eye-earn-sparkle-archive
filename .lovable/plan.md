
# Swipe-Down to Dismiss All Card Overlays

## Overview
All full-screen card overlays in the app (Wallet, Settings, Profile, Notifications, Achievements, Tasks, etc.) currently only close via the X button in the header. This update adds swipe-down-to-dismiss behavior so users can drag/scroll the card downward to close it -- a natural mobile gesture similar to iOS/Android bottom sheets.

## How it will work
- When a user touches the top area (header/drag handle) of any overlay card and drags downward, the card will follow the finger
- If the drag exceeds a threshold (roughly 30% of screen height or 150px), the card will animate out and close
- If the drag doesn't exceed the threshold, the card snaps back to its original position
- A subtle drag handle bar will be added at the top of each overlay for visual affordance
- The existing X button remains as an alternative close method
- Content scrolling inside the card still works normally -- only dragging from the top header area or when already scrolled to the top triggers the dismiss gesture

## What changes

### 1. New hook: `useSwipeToDismiss`
A reusable hook (`src/hooks/useSwipeToDismiss.ts`) that handles:
- Touch start/move/end tracking for vertical drag
- Drag distance state for animating the card position
- Threshold detection to decide close vs. snap-back
- Only activates when the scrollable content is at scroll position 0 (top), preventing conflicts with normal scrolling
- Returns: `dragOffset`, `isDragging`, event handler props to spread onto the container

### 2. New wrapper component: `SwipeDismissOverlay`
A reusable wrapper component (`src/components/SwipeDismissOverlay.tsx`) that:
- Wraps any overlay content with swipe-to-dismiss behavior
- Applies `translateY` transform based on drag offset
- Adds a drag handle indicator at the top
- Handles the dismiss animation (slide down + fade out)
- Accepts `isOpen`, `onClose`, and optional `className` props
- Replaces the repeated `fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up` pattern

### 3. Update all overlay screens
The following screens will be updated to use `SwipeDismissOverlay` as their root wrapper instead of the raw `div` with fixed positioning:

- `WalletScreen` -- Wallet overview, transactions, subscriptions
- `SettingsScreen` -- App settings and preferences
- `ProfileScreen` -- User profile view
- `NotificationCenter` -- Notifications list
- `NotificationPreferences` -- Notification settings
- `AchievementCenter` -- Achievements gallery
- `TaskCenter` -- Tasks and rewards
- `PremiumScreen` -- Premium/subscription plans
- `ProfileEditScreen` -- Edit profile form
- `ProfileQRCode` -- QR code display
- `TwoFactorAuth` -- 2FA setup
- `ActiveSessionsManager` -- Active sessions list
- `BlockMuteManager` -- Blocked/muted users
- `AccountActivityLog` -- Activity history
- `ContentReportFlow` -- Report content flow
- `PublicProfile` -- Public creator profile view
- `AttentionAchievements` -- Attention tracking achievements

Each screen update is minimal -- replacing the outer `div` with `SwipeDismissOverlay` and removing the now-redundant inline styles for positioning and animation.

## User experience
- A small horizontal bar appears at the top of each card as a drag affordance
- Dragging downward moves the card with your finger, with slight opacity reduction
- Releasing past the threshold slides the card off screen and calls `onClose`
- Releasing before the threshold smoothly snaps the card back
- Normal scrolling within the card content works unaffected

---

## Technical Details

### `src/hooks/useSwipeToDismiss.ts` (new)
- Tracks `touchstart` Y position, `touchmove` delta, and `touchend` threshold check
- Uses `useRef` for start position and `useState` for current drag offset
- Threshold: 150px downward drag to trigger dismiss
- Returns `{ dragOffset, isDragging, handlers: { onTouchStart, onTouchMove, onTouchEnd } }`
- Includes a `scrollRef` parameter -- only allows drag-to-dismiss when the scroll container is at `scrollTop === 0`

### `src/components/SwipeDismissOverlay.tsx` (new)
- Props: `isOpen`, `onClose`, `children`, `className?`
- Renders the `fixed inset-0 z-50` container with backdrop blur
- Applies `transform: translateY(${dragOffset}px)` and `opacity: 1 - (dragOffset / 500)` during drag
- On dismiss, plays a quick slide-down animation before calling `onClose`
- Contains the drag handle bar (centered, 48px wide, rounded)
- Early returns `null` when `!isOpen`

### Per-screen changes (example for WalletScreen)
Before:
```tsx
return (
  <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up overflow-y-auto">
    <div className="max-w-md mx-auto ...">
      <NeuButton onClick={onClose}><X /></NeuButton>
      ...
    </div>
  </div>
);
```

After:
```tsx
return (
  <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
    <div className="max-w-md mx-auto ...">
      <NeuButton onClick={onClose}><X /></NeuButton>
      ...
    </div>
  </SwipeDismissOverlay>
);
```

The X button is kept as a secondary close method. The only change per file is swapping the outer `div` for `SwipeDismissOverlay`.
