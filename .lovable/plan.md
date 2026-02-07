
# Fix: Discovery Map Header Buttons Not Clickable on Mobile

## Problem
The Route Builder, Check-In History (clock icon), Bell, Heart, and Close buttons in the Discovery Map header are visually rendered but cannot be tapped. The Mapbox GL map canvas and its built-in navigation controls create a stacking context that sits above the header, intercepting all pointer events.

## Root Cause
- The header div has `z-10`, but the map container (`absolute inset-0`) has no explicit z-index.
- Mapbox GL JS internally applies high z-index values to its controls and canvas.
- On mobile, the Mapbox navigation control (`top-right`) directly overlaps the header button area, stealing all touch events.

## Fix

### File: `src/components/DiscoveryMap.tsx`

1. **Increase header z-index** from `z-10` to `z-20` to ensure it sits above all Mapbox layers.

2. **Add explicit z-index to the map container** (`z-0`) to keep it below the header and other floating UI elements.

3. **Add CSS to suppress Mapbox control z-index conflicts** -- inject a style rule that constrains `.mapboxgl-ctrl-top-right` to a lower z-index (e.g., `z-index: 1 !important`) so it doesn't overlap the app header.

4. **Raise z-index on the floating action buttons** (center-right Navigation and Refresh buttons) to `z-20` to match the header layer.

5. **Raise z-index on the bottom promo cards and selected promotion card** to `z-20` as well for consistency.

### Changes Summary

```
Header:          z-10 -> z-20
Map container:   (none) -> z-0
Floating buttons: (none) -> z-20
Bottom cards:    z-10 -> z-20
Mapbox controls: Inject CSS: .mapboxgl-ctrl-top-right { z-index: 1 !important; }
```

### Result
All header buttons (Route Builder, History, Bell, Favorites, Close) will be tappable on mobile, enabling users to open the Route Builder sheet, view Check-In History, toggle alerts, and navigate back from the Discovery Map.
