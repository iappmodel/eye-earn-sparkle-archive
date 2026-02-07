

# Fix: Splash Screen Blocking App Content

## Problem
The app shows a blank black screen because the inline HTML `#splash` div (added to `index.html` to prevent white flash) is never removed after the first splash display.

The removal logic is inside a `useEffect` that only runs when `visible` is `true`. On subsequent loads in the same session, `visible` starts as `false` (due to `sessionStorage`), so the cleanup code never executes -- leaving a solid black `z-index: 200` div covering the entire app.

## Fix

**File: `src/components/SplashScreen.tsx`**

Move the inline `#splash` div removal out of the visibility guard so it always runs on mount, regardless of whether the splash animation plays:

```text
Current (broken):
  useEffect(() => {
    if (!visible) return;          // <-- exits early, skips removal
    const inlineSplash = document.getElementById('splash');
    if (inlineSplash) inlineSplash.remove();
    ...
  }, [visible]);

Fixed:
  // Always remove the HTML placeholder on mount
  useEffect(() => {
    const inlineSplash = document.getElementById('splash');
    if (inlineSplash) inlineSplash.remove();
  }, []);

  // Existing animation timer effect (separate)
  useEffect(() => {
    if (!visible) return;
    ...
  }, [visible]);
```

This splits the logic into two effects:
1. A one-time mount effect that always cleans up the inline HTML div
2. The existing animation timer effect that handles fade-out timing

No other files need changes.

