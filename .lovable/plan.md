

# Remove Duplicate "i" from Splash Screen

## Change
Remove the text-based "i" (`<span>` element) that appears below the logo image. The logo image (`i-logo.png`) already displays a stylized, colorful "i" with glow effects -- the extra text "i" below it is redundant.

## Technical Details

**File: `src/components/SplashScreen.tsx`**

- Delete lines 96-105 (the `{/* App name */}` comment and the `<span>` element containing "i")
- Also remove the `splash-text-in` keyframe from the inline `<style>` block (lines 113-115) since it will no longer be used
- No other changes needed -- the logo image with its glow effects remains as the sole branding element

