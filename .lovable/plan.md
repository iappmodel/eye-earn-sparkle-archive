
# Enhanced Route Planner: Drag Reorder, Destination Input, Smart Suggestions, and Notifications

## Overview

This plan covers all 7 enhancements to the Route Planner, focusing on practical, implementable features that work within the existing architecture.

---

## 1. Drag-and-Drop Stop Reordering

Replace the current up/down chevron buttons with touch-friendly drag-and-drop reordering in the Route Builder.

**How it works:**
- Each stop gets a drag handle (grip icon) on the left side
- Users press and hold the grip, then drag the stop to a new position
- A visual placeholder shows where the stop will be placed
- On release, the route recalculates order and updates
- Implementation uses native pointer events (no extra library needed) with a custom `useDragReorder` hook

**File:** `src/components/RouteBuilder.tsx`
- Replace the `ChevronUp`/`ChevronDown` buttons with a `GripVertical` drag handle
- Add drag state tracking (dragging item, hover target) with pointer events
- Animate displacement of other stops during drag
- Call `onReorderStops` on drop

---

## 2. Destination Input + Day/Time Planning

Transform the static "Your Location" label at the top of the route into an interactive destination planner.

**How it works:**
- The "Your Location" card becomes tappable, opening a destination input form
- Users can type a destination address (where they're heading)
- The platform then suggests earning stops along the way
- A new "Schedule" section lets users pick day of week and departure time, enabling commute route planning
- When a destination is set, the route optimization factors in the direction of travel

**File:** `src/hooks/usePromoRoute.ts`
- Add `destination` field to `PromoRoute` interface (address, lat, lng)
- Add `scheduledDay` and `scheduledTime` optional fields
- Add `setDestination` and `setSchedule` methods
- Enhance `suggestRoute` to factor in destination direction when available

**File:** `src/components/RouteBuilder.tsx`
- Replace the static "Your Location" card with an interactive origin/destination section
- Add destination input field with autocomplete (reuses MapSearchBar pattern)
- Add day-of-week selector (Mon-Sun chips) and time picker
- When destination is set, show it as the endpoint in the route visualization

---

## 3. Routes Suggested from Saved Promos (Watch Later)

Add a "Suggest from Saved" option that builds a route using items from the Watch Later list.

**How it works:**
- New button in the Route Builder: "Build from Saved" (next to "Platform Suggested Route")
- Takes all Watch Later items, applies current filters, and creates an optimized route from them
- Users can then edit the result before saving

**File:** `src/hooks/usePromoRoute.ts`
- Add `suggestFromWatchLater` method that takes the watchLater array and creates a route from those stops, applying optimization sorting

**File:** `src/components/RouteBuilder.tsx`
- Add "Build from Saved" button in the suggestion card (only visible when Watch Later has items)

---

## 4. Routes Suggested from User Interests

Add interest-based route suggestions using the user's interaction history (liked categories, frequently visited types).

**How it works:**
- Track which promotion categories the user interacts with most
- New "Based on Your Interests" suggestion preset
- Prioritizes categories the user has engaged with (liked, bookmarked, checked in)
- Uses mock interest scoring for now (can connect to real analytics later)

**File:** `src/hooks/usePromoRoute.ts`
- Add `suggestByInterests` method that accepts user interest categories and weights promotions matching those interests higher

**File:** `src/components/RouteBuilder.tsx`
- Add "Based on Your Interests" preset button with a sparkle/heart icon
- Shows the top categories it's optimizing for

---

## 5. Multi-Modal Transport (Mixed Dislocation Types)

Allow users to set different transport modes per segment of the route, not just one mode for the entire route.

**How it works:**
- Each segment between stops can have its own transport mode
- Transport mode selector appears between stops (walking icon between stop 1-2, bus icon between stop 2-3, etc.)
- Tapping the segment icon cycles through: walking, driving, transit
- An "Activity" mode is added for fitness-oriented users (running, cycling)
- The overall route transport mode becomes a "default" that new segments inherit

**File:** `src/hooks/usePromoRoute.ts`
- Extend `TransportMode` type to include `'cycling' | 'running'`
- Add optional `segmentTransport` map to `PromoRoute` (keyed by "fromIndex-toIndex")
- Add `setSegmentTransport` method

**File:** `src/components/RouteBuilder.tsx`
- Between each stop connection line, render a small transport mode icon button
- Tapping it cycles through available modes for that segment
- Add cycling and running icons to the transport options

---

## 6. Location-Based Route Notifications

Leverage the existing `useNearbyPromotions` infrastructure to suggest routes based on the user's current location.

**How it works:**
- When the user is near a cluster of promotions, the app suggests "You're near 5 earning spots -- start a route?"
- The notification appears as an in-app toast and (if permitted) a browser/push notification
- Tapping the notification opens the Route Builder with a pre-suggested route from nearby promos
- Integrates with the existing geolocation watcher and notification system

**File:** `src/hooks/useNearbyPromotions.ts`
- Add route suggestion logic: when 3+ promos are within the alert radius, trigger a "route suggestion" notification
- Add a `suggestedRouteStops` output that the parent can use to auto-build a route

**File:** `src/pages/Index.tsx`
- Listen for route suggestions from `useNearbyPromotions` and show an actionable toast
- Toast action opens the Route Builder with pre-populated stops

---

## 7. AI-Designed Routes Based on User Behavior

Add a "Smart Route" feature that uses platform heuristics (and future AI) to design personalized routes.

**How it works:**
- A prominent "Smart Route" card in the Route Builder with a brain/sparkle icon
- Considers multiple signals:
  - Time of day (morning commute vs evening leisure)
  - Day of week (weekday efficiency vs weekend exploration)
  - Past check-in history (preferred categories)
  - Average session length (short trips vs long routes)
  - Transport preferences (inferred from past routes)
- For now, implemented as a heuristic engine; can be upgraded to use AI later
- Shows a brief explanation: "Designed for your Wednesday morning commute" or "Weekend exploration route based on your interests"

**File:** `src/hooks/usePromoRoute.ts`
- Add `suggestSmartRoute` method with heuristic logic based on:
  - Current time/day
  - User's saved routes patterns
  - Watch later items
  - Default optimization that varies by context

**File:** `src/components/RouteBuilder.tsx`
- Add "Smart Route" card with brain icon in the suggestion section
- Shows a contextual label explaining why this route was designed
- Positioned as the primary suggestion option

---

## Technical Summary

### Files to modify:

| File | Changes |
|------|---------|
| `src/hooks/usePromoRoute.ts` | Add destination, schedule, segment transport, suggestFromWatchLater, suggestByInterests, suggestSmartRoute |
| `src/components/RouteBuilder.tsx` | Drag-and-drop, destination input, schedule picker, multi-modal segments, new suggestion cards |
| `src/components/RouteFilterSheet.tsx` | Add transport mode filter for multi-modal routes |
| `src/hooks/useNearbyPromotions.ts` | Add route cluster detection and suggestion output |
| `src/pages/Index.tsx` | Wire nearby route suggestions to actionable toasts |
| `src/components/DiscoveryMap.tsx` | Pass new props for destination and smart route |

### No database changes or new dependencies required.

All features work with the existing mock data system and can be connected to real backend data when available.
