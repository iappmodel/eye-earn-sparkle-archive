

# Launch Eye-Control / Remote Control -- Full Wiring

## Problem

The eye-control system has all the building blocks (blink detection, gaze tracking, gesture combos, calibration UI), but they are not connected to the app's actual actions. Specifically:

1. **Gaze navigation does nothing**: The remote control fires `gazeNavigate` events when you look left/right/up/down rapidly, but the main page never listens for those events.
2. **Gesture combos do nothing**: Combos like "Look right + blink twice = Like" fire internally but the `onComboAction` callback is never wired, so the Like/Share/Save/etc. never happen.
3. **"Stare at a button and blink" does nothing**: The system can detect which button you're looking at, but no buttons are registered as targets.

## Solution -- 3 Changes

### 1. Wire gaze navigation events in `Index.tsx`

Add a `useEffect` that listens for the `gazeNavigate` custom event on `window` and maps actions to existing app functions:

| Gaze Action    | App Action                          |
|----------------|-------------------------------------|
| `nextVideo`    | Scroll to next media item           |
| `prevVideo`    | Scroll to previous media item       |
| `friendsFeed`  | Navigate to Friends page (left)     |
| `promoFeed`    | Navigate to Promos page (right)     |

This uses the existing `handleNavigate` and `navigateToMedia` functions already in Index.tsx.

### 2. Wire combo actions via `onComboAction` on `FloatingControls`

Pass `onComboAction` through `FloatingControls` down to `BlinkRemoteControl` so that when a gesture combo fires, the app executes the real action:

| Combo Action     | App Action                               |
|------------------|------------------------------------------|
| `like`           | Toggle like                              |
| `comment`        | Open comments panel                      |
| `share`          | Open share sheet                         |
| `save`           | Save current video                       |
| `follow`         | Follow creator (toast for now)           |
| `nextVideo`      | Next media                               |
| `prevVideo`      | Previous media                           |
| `friendsFeed`    | Navigate left to friends                 |
| `promoFeed`      | Navigate right to promos                 |
| `openSettings`   | Open settings/theme sheet                |
| `toggleMute`     | Toggle mute (toast for now)              |

### 3. Register floating buttons for "stare and blink" targeting

Each `LongPressButtonWrapper` already wraps the sidebar buttons with a `buttonId`. We need to call `registerButton` / `unregisterButton` on the remote control for each of these so that when the user stares at a button, the ghost highlight appears and blinks execute the button's click.

This is done by:
- Passing `registerButton` and `unregisterButton` from `useBlinkRemoteControl` up through `BlinkRemoteControl` as new props.
- In `FloatingControls`, calling `registerButton` on mount for each sidebar button using refs.

However, since `LongPressButtonWrapper` already wraps each button with a `ref` pattern, a simpler approach is to expose a registration callback from `BlinkRemoteControl` and have `FloatingControls` forward it. To keep the change minimal:
- Add a `useEffect` in `FloatingControls` that queries all `[data-button-id]` elements on the page and registers them when remote control is enabled.
- `LongPressButtonWrapper` already renders `data-button-id` attributes (or we add them).

## Technical Details

### File: `src/pages/Index.tsx`

**Add gazeNavigate event listener:**

```typescript
useEffect(() => {
  const handleGazeNavigate = (e: CustomEvent) => {
    const { action } = e.detail;
    switch (action) {
      case 'nextVideo': navigateToMedia('up'); break;
      case 'prevVideo': navigateToMedia('down'); break;
      case 'friendsFeed': pageNavigate('left'); break;
      case 'promoFeed': pageNavigate('right'); break;
    }
  };
  window.addEventListener('gazeNavigate', handleGazeNavigate);
  return () => window.removeEventListener('gazeNavigate', handleGazeNavigate);
}, [navigateToMedia, pageNavigate]);
```

### File: `src/components/FloatingControls.tsx`

**Add combo action handling:**

1. Add new props to `FloatingControlsProps`:
   - `onComboAction?: (action: string) => void`

2. Pass `onComboAction` to `BlinkRemoteControl`:
   ```tsx
   <BlinkRemoteControl
     enabled={remoteControlEnabled}
     onToggle={setRemoteControlEnabled}
     onNavigate={...}
     onComboAction={(action, combo) => {
       onComboAction?.(action);
     }}
     ...
   />
   ```

3. Add button registration: When `remoteControlEnabled` changes to true, query all `[data-button-id]` elements and dispatch a registration event. When false, unregister.

**Back in `Index.tsx`, pass `onComboAction`:**
```tsx
<FloatingControls
  ...
  onComboAction={(action) => {
    switch (action) {
      case 'like': handleLike(); break;
      case 'comment': handleComment(); break;
      case 'share': handleShare(); break;
      case 'save': handleSaveVideo(); break;
      case 'nextVideo': navigateToMedia('up'); break;
      case 'prevVideo': navigateToMedia('down'); break;
      case 'friendsFeed': pageNavigate('left'); break;
      case 'promoFeed': pageNavigate('right'); break;
      case 'openSettings': handleSettings(); break;
      case 'toggleMute': toast.info('Mute toggled'); break;
      case 'follow': toast.success('Followed!'); break;
    }
  }}
/>
```

### File: `src/components/LongPressButtonWrapper.tsx`

Add a `data-button-id` attribute to the wrapper div so buttons can be discovered for registration:
```tsx
<div data-button-id={buttonId} ref={elementRef} ...>
```

### File: `src/components/BlinkRemoteControl.tsx`

Expose `registerButton` and `unregisterButton` from the hook via new props or a registration event system.

Add a `useEffect` that, when `enabled` is true, scans the DOM for `[data-button-id]` elements every 2 seconds and registers them. When disabled, unregisters all.

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Listen for `gazeNavigate` events; pass `onComboAction` to FloatingControls |
| `src/components/FloatingControls.tsx` | Accept and forward `onComboAction`; add button auto-registration |
| `src/components/BlinkRemoteControl.tsx` | Auto-register DOM buttons with `[data-button-id]` when enabled |
| `src/components/LongPressButtonWrapper.tsx` | Add `data-button-id` attribute to wrapper element |

No new files, no new dependencies, no database changes.
