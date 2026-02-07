
# Enhance Route Planner with Platform-Suggested Routes and Feed Integration

## Overview

This plan upgrades the Route Planner with a dedicated "Suggest Route" button inside the Route Builder, smarter platform-based route suggestions using filters, and the ability to add promo content to the route directly from the main feed while watching videos.

## Changes

### 1. Enhanced "Suggest Route" in Route Builder

Currently the "Suggest Route" button is a small action chip alongside "Filters" and "Set as Commute". It will be upgraded to a more prominent, dedicated section inside the Route Builder sheet:

- Add a styled "Platform Suggested Route" card at the top of the Route Builder when no route is active, with a sparkle icon and description explaining it generates a route based on nearby promotions and the user's filters.
- When a route IS active, the existing "Suggest Route" chip becomes a "Re-suggest" option that regenerates the route applying the current filters.
- The suggestion logic in `usePromoRoute.suggestRoute()` already supports all filter types (Vicoins, Icoins, both, more earnings, faster, effective, balanced). No changes needed to the core algorithm.

**File:** `src/components/RouteBuilder.tsx`

### 2. Add "Add to Route" Button on the Main Feed

When watching promo content in the main feed, users will see a new "Route" button in the right-side interaction buttons (the sidebar with Like, Comment, Share, Bookmark, etc.). Tapping it adds the current promo's location to the active route (or starts a new one).

- Add a `Route` icon button to `MediaInteractionButtons.tsx` (sidebar variant), visible only for promo-type content.
- Wire the new button through `FloatingControls.tsx` to `Index.tsx`, which will call `promoRoute.addStop()`.
- The `usePromoRoute` hook will be lifted to `Index.tsx` level so it persists across the feed and Discovery Map views. Currently it lives inside `DiscoveryMap` -- it will be moved up and passed down.

**Files:** `src/components/MediaInteractionButtons.tsx`, `src/components/FloatingControls.tsx`, `src/pages/Index.tsx`, `src/components/DiscoveryMap.tsx`

### 3. Lift Route State to App Level

The `usePromoRoute` hook currently lives inside `DiscoveryMap.tsx`. To enable adding stops from the feed, it needs to be shared between `Index.tsx` (main feed) and `DiscoveryMap`. The hook will be called in `Index.tsx` and the route state/methods passed down as props to `DiscoveryMap`.

**Files:** `src/pages/Index.tsx`, `src/components/DiscoveryMap.tsx`

### 4. Route Builder Accessible from Feed

A floating Route indicator/button will appear at the bottom of the main feed when there is an active route being built (similar to the green banner on the Discovery Map). Tapping it opens the Route Builder sheet directly from the feed context.

**File:** `src/pages/Index.tsx`

---

## Technical Details

### File: `src/hooks/usePromoRoute.ts`
- No changes needed -- the hook already supports all required functionality.

### File: `src/pages/Index.tsx`
- Import and call `usePromoRoute()` at the top level.
- Pass route state/methods as new props to `DiscoveryMap`.
- Add a new `onAddToRoute` callback for `FloatingControls`.
- Add a floating route banner when `promoRoute.isBuilding && promoRoute.totalStops > 0` visible on the main feed.
- Import and render `RouteBuilder` sheet from Index level as well, controlled by a new `showRouteBuilderFromFeed` state.
- Map `currentMedia` (promo content) to route stop data when user clicks "Add to Route" from the feed.

### File: `src/components/DiscoveryMap.tsx`
- Remove internal `usePromoRoute()` call.
- Accept route state and methods as props instead.
- Remove the `handleSuggestRoute` wrapper (will receive it as a prop).
- All existing route integrations (add to route, watch later, route builder, markers) continue to work unchanged -- they just use props instead of the local hook.

### File: `src/components/FloatingControls.tsx`
- Add `onAddToRoute` optional callback prop.
- Add `isInRoute` optional boolean prop to show active state.
- Add `showRouteButton` optional boolean prop (only for promo content).
- Pass these through to `MediaInteractionButtons`.

### File: `src/components/MediaInteractionButtons.tsx`
- Add a new `Route` icon button in the sidebar variant, positioned after the Bookmark button.
- Shows a green checkmark state when the current content is already in the route.
- Only visible when `showRouteButton` is true (promo content).

### File: `src/components/RouteBuilder.tsx`
- When no active route exists, show a prominent "Get a Suggested Route" card with:
  - Sparkles icon and title "Platform Suggested Route"
  - Brief description: "We'll find the best earning route near you"
  - Three quick-pick buttons for optimization: "Max Earnings", "Fastest", "Most Effective"
  - Tapping any of them calls `onSuggestRoute` with the chosen optimization preset.
- When an active route exists, keep the existing "Suggest Route" chip but rename to "Re-suggest" for clarity.
- Add a "Start New Route" button alongside the suggestion card for users who want to build manually.

### No database changes or new dependencies required.
