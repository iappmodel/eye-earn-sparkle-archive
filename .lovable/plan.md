
# Smart Route Location Autocomplete

## Overview
Both the "Your Location" (origin) and "Set Destination" fields in the Smart Route builder will get live address autocomplete powered by Mapbox Geocoding API -- the same service already used for the Discovery Map search bar. As you type, location suggestions will appear in a dropdown, similar to Google Maps autocomplete.

## What will change

### 1. New Reusable Component: LocationAutocomplete
A new component (`src/components/LocationAutocomplete.tsx`) that provides a text input with:
- Live address/place suggestions as you type (debounced 300ms)
- Results powered by Mapbox Geocoding API (places, POIs, addresses)
- Recent searches from local storage
- Dropdown with place name + sub-address details
- Clear button and loading indicator
- Returns selected place name + coordinates (lat/lng)

This component extracts the autocomplete logic already proven in the `MapSearchBar` component into a more compact, reusable form suitable for embedding inline within the Route Builder.

### 2. "Your Location" becomes editable
Currently, "Your Location" is a static display block. It will become:
- A tappable block that, when tapped, expands into the autocomplete input
- Users can type a custom starting address and get suggestions
- A "Use Current Location" quick-action button to revert to GPS
- Once an origin is selected, its address is displayed with an edit button
- The selected origin coordinates will be stored and passed to the route system

### 3. "Set Destination" gets autocomplete
Currently, destination is a plain text input with no suggestions. It will become:
- Same autocomplete component with live suggestions
- When a suggestion is selected, real coordinates (from Mapbox) are used instead of the current random mock coordinates
- Properly sets the route destination with actual lat/lng

### 4. Pass Mapbox token to RouteBuilder
The `mapboxToken` is already fetched in `DiscoveryMap`. It will be passed as a new prop to `RouteBuilder`, which passes it to the autocomplete components.

---

## Technical Details

### Files to create:
- `src/components/LocationAutocomplete.tsx` -- Reusable autocomplete input using Mapbox Geocoding API

### Files to modify:

**`src/components/RouteBuilder.tsx`**
- Add `mapboxToken` prop to the interface
- Add `onSetOrigin` callback prop for setting custom origin location
- Replace the static "Your Location" block (lines 259-268) with an editable field using `LocationAutocomplete`
- Add state for `showOriginEdit`, `originAddress`, and origin coordinates
- Replace the plain destination `Input` (lines 271-283) with `LocationAutocomplete`
- When a destination suggestion is selected, call `onSetDestination` with real coordinates from Mapbox instead of mock random offsets

**`src/components/DiscoveryMap.tsx`**
- Pass `mapboxToken` prop to the `RouteBuilder` component
- Add `onSetOrigin` handler to manage custom origin location

**`src/hooks/usePromoRoute.ts`**
- Add optional `origin` field to the `PromoRoute` interface (address + lat/lng)
- Add `setOrigin` callback to store a custom starting location
- Update `openInGoogleMaps` to use the custom origin when set

### API used:
Mapbox Geocoding v5 (already in use):
```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json
  ?access_token={token}
  &types=place,poi,address
  &limit=5
```
If user location is available, a `proximity` parameter will be added to bias results toward the user's area:
```
  &proximity={lng},{lat}
```

### Component flow:
```text
User taps "Your Location" or "Set Destination"
  --> Inline autocomplete input appears
  --> User types address
  --> 300ms debounce fires Mapbox Geocoding request
  --> Dropdown shows up to 5 suggestions
  --> User taps a suggestion
  --> Coordinates + address stored
  --> Input collapses back to display mode
```
