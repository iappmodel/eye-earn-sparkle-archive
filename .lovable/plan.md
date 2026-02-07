

# Fix: Map Pins All Gray When No Route Is Active

## Problem

After implementing the 4-state dynamic pin system, **all map pins appear as muted gray circles** when the user hasn't started building a route. This happens because the current logic treats every pin as "not in route" by default, applying gray styling with 60% opacity -- making the map look broken and lifeless.

Previously, pins displayed colorful gradients based on reward amount (green to red), which made the map visually engaging. That visual richness was lost.

## Solution

Change the pin logic so that the gray muting only kicks in **when a route is actively being built**. When no route exists, all pins keep their original colorful reward gradients.

```text
+----------------------------+------------------------------+
| Scenario                   | Pin Appearance               |
+----------------------------+------------------------------+
| No route active            | Colorful reward gradients    |
|                            | (original look for ALL pins) |
+----------------------------+------------------------------+
| Route active, NOT in route | Muted gray, 60% opacity     |
+----------------------------+------------------------------+
| Route active, IN route     | White border + cyan glow     |
|   (queued)                 |                              |
+----------------------------+------------------------------+
| Route active, IN route     | Amber/yellow pulsing glow   |
|   (nearby, within 500m)    |                              |
+----------------------------+------------------------------+
| Completed (checked in)     | Solid green + checkmark      |
+----------------------------+------------------------------+
```

## Technical Changes

### File: `src/components/DiscoveryMap.tsx`

**1. Update `getMarkerStyle` to accept a `hasActiveRoute` flag**

Add a 5th parameter `hasActiveRoute: boolean`. When `hasActiveRoute` is false and the pin is not completed, return the original colorful reward gradient instead of gray.

The logic becomes:
- Completed? -> Green checkmark (always, regardless of route)
- Nearby + in route? -> Amber pulse
- In route (queued)? -> Reward gradient + white border + cyan glow
- Has active route but NOT in it? -> Muted gray (dimmed)
- No active route at all? -> Original colorful reward gradient (the default look)

**2. Pass route-active status into getMarkerStyle**

In the marker rendering loop (around line 570), determine whether a route is active using `promoRoute.isBuilding && promoRoute.totalStops > 0`, and pass that boolean to `getMarkerStyle`.

**3. Default style (no route active)**

When no route is active, pins will use:
- `background`: reward gradient from `getRewardGradient()`
- `border`: `2px solid rgba(255,255,255,0.2)`
- `glow`: coin-type glow from `getCoinGlow()`
- `opacity`: `1`
- No badge, no animation

This restores the original vibrant map appearance while preserving all 4 route-aware states when a route is being built.

### No other files change

All modifications are contained within the `getMarkerStyle` function and its call site in `DiscoveryMap.tsx`.
