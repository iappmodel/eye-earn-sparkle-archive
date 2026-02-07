

# Dynamic Map Pin Colors: Route Status Awareness

## Overview

Redesign the map pin visual system so that pins clearly communicate their relationship to the active route, the user's proximity, and their completion status.

## Visual States

The pins will have **4 distinct visual states**:

```text
+------------------+-------------------+---------------------------------+
| State            | Appearance        | When                            |
+------------------+-------------------+---------------------------------+
| Not in route     | Light gray, muted | Default for all unselected pins |
| In route (queued)| White border,     | Selected but not yet close      |
|                  | cyan/blue glow    |                                 |
| In route (nearby)| Yellow/amber      | User is within ~500m of stop    |
|                  | pulsing glow      |                                 |
| Completed        | Green with        | User has checked in at stop     |
|                  | check mark        |                                 |
+------------------+-------------------+---------------------------------+
```

- **Not in route**: Pin becomes a desaturated gray circle with dimmed text. Still clickable to add to route.
- **In route (queued)**: Pin keeps its coin icon but gets a white border and a subtle blue/cyan glow to indicate it's selected. No checkmark.
- **In route (nearby)**: Pin shifts to amber/yellow with a pulsing animation, signaling the user is approaching this stop.
- **Completed**: Pin turns solid green with a white checkmark badge -- the only state that shows green.

## How It Works

### Tracking completed stops

A new `completedStops` state (`Set<string>` of promotion IDs) is added to the DiscoveryMap component. When a user successfully checks in at a promotion (the `CheckInButton` calls `onSuccess`), the promotion ID is added to this set.

### Proximity detection

The existing `userLocation` state is used to calculate the distance between the user and each route stop using the Haversine formula (already available in `usePromoRoute`). Stops within 500m are considered "nearby."

### Pin rendering logic

The marker rendering loop (currently lines 500-528) is updated to determine each pin's visual state before setting its styles:

1. Check if `promoRoute.isInRoute(promo.id)` -- is the pin in the active route?
2. If yes, check if `completedStops.has(promo.id)` -- has the user checked in here?
3. If not completed, check if user is within 500m -- is it "nearby"?
4. If none of the above, the pin is "not in route" and gets the gray treatment.

## Technical Details

### File: `src/components/DiscoveryMap.tsx`

**New state:**
- Add `const [completedStops, setCompletedStops] = useState<Set<string>>(new Set());`

**New helper function:**
- `getMarkerStyle(promo, isInRoute, isCompleted, isNearby)` returns an object with `background`, `border`, `glow`, `opacity`, and `badgeHTML` based on the pin's state.

**Marker rendering changes (lines 500-528):**
- Replace the current `gradient`/`glow`/`inRoute` logic with the new state-aware system:
  - **Not in route**: `background: #3a3a4a` (dark gray), `border: 1px solid rgba(255,255,255,0.1)`, `opacity: 0.6`, no badge, glow removed
  - **In route (queued)**: `background: original gradient`, `border: 2px solid white`, `glow: 0 0 12px rgba(96, 165, 250, 0.5)`, coin icon visible, no badge
  - **In route (nearby)**: `background: linear-gradient(135deg, #f59e0b, #d97706)`, `border: 2px solid #fbbf24`, pulsing animation class, amber glow
  - **Completed**: `background: #22c55e`, `border: 2px solid white`, green glow, white checkmark badge

**Proximity calculation:**
- Add a simple Haversine helper inline (or import from usePromoRoute) to compute distance between `userLocation` and each pin
- Threshold: 500 meters for "nearby" state

**Check-in completion wiring:**
- In the selected promotion card's `CheckInButton`, pass an `onSuccess` callback that adds the promo ID to `completedStops`

**Effect dependency update:**
- Add `completedStops` and `userLocation` to the marker rendering useEffect dependency array so pins re-render when status changes

### File: `src/components/DiscoveryMap.tsx` -- Popup and bottom card updates

- The selected promotion card already has a `CheckInButton`. Its `onSuccess` callback will be extended to call `setCompletedStops(prev => new Set([...prev, promo.id]))`.

### No changes to other files

The `usePromoRoute` hook, `RouteBuilder`, and `CheckInButton` components remain unchanged. All logic is self-contained within the DiscoveryMap component.

## Summary

| Change | Location |
|--------|----------|
| Add `completedStops` state | DiscoveryMap.tsx |
| Add `getMarkerStyle()` helper | DiscoveryMap.tsx |
| Rewrite marker innerHTML logic | DiscoveryMap.tsx, lines 500-528 |
| Add Haversine distance check | DiscoveryMap.tsx |
| Wire CheckInButton onSuccess | DiscoveryMap.tsx, selected promo card |
| Add completedStops + userLocation to effect deps | DiscoveryMap.tsx |

