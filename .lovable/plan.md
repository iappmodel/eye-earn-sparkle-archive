

# Fix: Infinite Re-Render Loop Blocking the App

## Problem

The app is stuck in an infinite re-render loop, which prevents any UI from rendering properly. The console shows **"Maximum update depth exceeded"** errors caused by two dependency issues.

---

## Root Cause 1: `useNearbyPromotions.ts` circular state

The `startWatching` function depends on `isWatching` in its dependency array. When `startWatching` runs:
- It calls `setIsWatching(true)`
- That changes `isWatching`
- Which recreates `startWatching` (new function reference)
- Which triggers the `useEffect` that depends on `startWatching`
- Which calls `startWatching` again -- **infinite loop**

### Fix
- Remove `isWatching` from `startWatching`'s dependency array
- Use a ref (`isWatchingRef`) for the guard check instead of state
- Remove `startWatching` and `stopWatching` from the `useEffect` dependency array, using refs internally

---

## Root Cause 2: `Index.tsx` useEffect depends on `promoRoute` object

The route suggestion `useEffect` (line 255) lists `promoRoute` as a dependency. Since `usePromoRoute()` returns a new object on every render, this effect fires every render, creating a cascade of state updates.

### Fix
- Replace `promoRoute` with only the specific function needed: `promoRoute.suggestRoute`
- Extract `suggestRoute` into a stable ref or destructure it before the effect

---

## Files to Change

### File: `src/hooks/useNearbyPromotions.ts`
- Add `isWatchingRef` using `useRef(false)` to track watching state without triggering re-renders
- In `startWatching`: check `isWatchingRef.current` instead of `isWatching` state for the guard
- Set `isWatchingRef.current = true` alongside `setIsWatching(true)` (state still used for external consumers)
- In `stopWatching`: set `isWatchingRef.current = false`
- Remove `isWatching` from `startWatching`'s dependency array
- Change the main `useEffect` to not depend on `startWatching`/`stopWatching` -- instead inline the logic or use stable refs

### File: `src/pages/Index.tsx`
- Destructure `suggestRoute` from `promoRoute` before the effect
- Replace `promoRoute` in the dependency array with the specific stable references needed (`promoRoute.suggestRoute` -- which is already wrapped in `useCallback` in the hook)
- This prevents the effect from firing on every render

---

## Result

After these fixes the infinite loop stops, and all the new Route Planner features (drag reorder, smart suggestions, feed integration, etc.) will render correctly on the phone view.

