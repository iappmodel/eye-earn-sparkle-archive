
# Splash Screen with iView Logo

## Overview
When the app launches from the home screen on mobile (as a PWA or native app), a full-screen splash screen will display the iView logo with a glowing animation for ~1.5 seconds before fading into the app content. This provides a polished, native-app feel.

## How it will work
- On first render, a full-screen dark splash overlay appears on top of everything
- The iView logo (the existing `i-logo.png`) fades in with a neon glow pulse animation
- The app name "iView" appears below the logo with a gradient text effect
- After 1.5 seconds, the splash screen fades out and is removed from the DOM
- The splash only shows once per session (not on every route change)
- Uses `sessionStorage` so it re-appears if the user closes and reopens the app

## What the user sees
1. App opens to a deep black screen (#0A0A0F, matching the app theme)
2. The "i" logo scales in with a soft neon purple/magenta glow
3. "iView" text fades in below the logo
4. After ~1.5s, the entire splash fades out smoothly revealing the app beneath

## Technical Details

### New file: `src/components/SplashScreen.tsx`
A React component that:
- Uses `useState` to track visibility (`showing` and `fadeOut` states)
- On mount, sets a 1.2s timer to begin the fade-out animation (300ms fade), then a second timer at 1.5s to fully unmount
- Checks `sessionStorage` for a `splash_shown` flag -- skips if already shown this session
- Renders a `fixed inset-0 z-[100]` overlay with the app's dark background color
- Contains the logo image (`i-logo.png`) at a large size with the existing glow/drop-shadow effects from `AppLogo`
- Contains "iView" text with the `gradient-text` class
- Entry animation: logo scales from 0.8 to 1 with opacity 0 to 1
- Exit animation: entire overlay fades to opacity 0 with a slight scale-up
- Respects `prefers-reduced-motion` by skipping animations (instant show then hide)

### Modified file: `src/App.tsx`
- Import and render `<SplashScreen />` inside the `App` component, above all other content
- Placed at the top level so it overlays everything including route content

### Modified file: `index.html`
- Add an inline `<div id="splash">` with inline styles matching the splash background color. This provides an instant visual (no white flash) before React even boots. It gets hidden by the React splash component once mounted, and is removed after the splash ends.
- The inline splash only shows the background color -- no logo (since the logo is a React-rendered image). This prevents any flash of white while JS loads.

### No other files changed
The splash screen is self-contained. It uses the existing `i-logo.png` asset and existing CSS utility classes.

### Component structure
```text
SplashScreen (fixed, z-[100], full screen)
  |-- Dark background div (#0A0A0F)
  |-- Glow backdrop (radial gradient, animated)
  |-- Logo container
  |     |-- Blur glow layer (neon purple/magenta)
  |     |-- <img> i-logo.png (scale-in animation)
  |-- "iView" text (gradient-text, fade-in with delay)
```

### Timing
```text
0ms     -- Splash mounts, logo begins scale-in animation (400ms)
200ms   -- "iView" text begins fade-in (300ms)  
1200ms  -- Fade-out animation starts (300ms duration)
1500ms  -- Component unmounts, sessionStorage flag set
```
