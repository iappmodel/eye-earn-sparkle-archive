

# Saved Routes -- Persistent Storage and Enhanced UI

## Overview
Currently, saved routes only exist in React state and are lost on page refresh. This plan adds localStorage persistence so saved routes survive between sessions, and upgrades the "Saved Routes" section in the Route Builder with proper actions: load/edit, open directly in Google Maps, duplicate, and delete.

## What Changes

### 1. Persist saved routes to localStorage (usePromoRoute.ts)

The `savedRoutes` and `watchLater` arrays are currently initialized as empty arrays with `useState`. They need to:
- Load from `localStorage` on mount (with a `"promo-saved-routes"` and `"promo-watch-later"` key)
- Write back to `localStorage` whenever they change (via `useEffect`)

This ensures that after a user saves a route and refreshes the page or navigates away, their routes are still there when they come back.

### 2. Upgrade the Saved Routes section UI (RouteBuilder.tsx)

The current saved routes section (lines 602-636) shows each route as a simple card with just an Edit and Delete button. It will be enhanced with:

- **"Use Route" button** (play/navigation icon) -- loads the route as the active route AND immediately opens it in Google Maps so the user can start navigating
- **"Open in Maps" button** (external link icon) -- opens the saved route directly in Google Maps without loading it into the editor
- **"Duplicate" button** (copy icon) -- creates a copy of the route so the user can modify it without affecting the original
- **Transport mode icon** shown on each card so users can see at a glance whether it's a walking/driving/cycling route
- **Date saved** shown as additional context (e.g., "Saved 3 days ago")
- The existing **Edit** (pencil icon) and **Delete** (trash icon) remain

Each saved route card will also show more detail:
- Transport mode badge
- Schedule info if it's a commute route (e.g., "Mon-Fri at 09:00")
- Destination if one was set

### 3. Add a "duplicateRoute" function (usePromoRoute.ts)

A new `duplicateRoute` callback that takes a route ID, creates a copy with a new ID and "(Copy)" appended to the name, and adds it to `savedRoutes`.

## Technical Details

### File: `src/hooks/usePromoRoute.ts`

**localStorage persistence:**
- Add a helper to read/write JSON safely from localStorage
- Change `useState<PromoRoute[]>([])` for `savedRoutes` to initialize from `localStorage.getItem('promo-saved-routes')`
- Change `useState<RouteStop[]>([])` for `watchLater` to initialize from `localStorage.getItem('promo-watch-later')`
- Add two `useEffect` hooks that write to localStorage whenever `savedRoutes` or `watchLater` change
- Import `useEffect` (currently only `useState, useCallback, useMemo` are imported)

**New `duplicateRoute` function:**
```
duplicateRoute(routeId: string):
  - Find route in savedRoutes by id
  - Create a copy with new id (generateRouteId()) and name + " (Copy)"
  - Add to savedRoutes
  - Return the new route
```

**Updated return object:** add `duplicateRoute` to the returned values.

### File: `src/components/RouteBuilder.tsx`

**New props:**
- `onDuplicateRoute?: (routeId: string) => void`

**Enhanced saved route cards (lines 602-636):**

Each card will be restructured to show:
```
[Transport Icon]  Route Name                    [Use] [Maps] [Copy] [Edit] [Delete]
                  3 stops - 150 coins - Daily
                  Destination: Home
                  Saved 2 days ago
```

Action buttons:
- Use (Play icon) -- calls `onLoadRoute(r.id)` then immediately calls `onOpenInGoogleMaps`
- Open in Maps (ExternalLink icon) -- temporarily loads route data to build the Google Maps URL without changing activeRoute, or uses a new helper
- Duplicate (Copy icon) -- calls `onDuplicateRoute(r.id)`
- Edit (Edit2 icon) -- existing `onLoadRoute(r.id)`
- Delete (Trash2 icon) -- existing `onDeleteSavedRoute(r.id)` with a confirmation toast

**Import additions:** Add `Copy, Play` from lucide-react.

### File: `src/pages/Index.tsx`

Pass the new `onDuplicateRoute` prop to the `RouteBuilder` component:
```
onDuplicateRoute={promoRoute.duplicateRoute}
```

### File: `src/components/DiscoveryMap.tsx`

Same change -- pass `onDuplicateRoute` to the `RouteBuilder` rendered inside the map view.

### No new files, no new dependencies, no database changes.
