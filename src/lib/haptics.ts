/**
 * Safe haptic feedback utilities
 * 
 * This module provides vibration feedback that respects browser security policies.
 * Browsers block navigator.vibrate() unless triggered by a user gesture.
 * 
 * DISABLED FOR DEBUGGING: All vibration is currently disabled to diagnose page responsiveness.
 */

// Global flag: set to false to completely disable all haptic feedback
const HAPTICS_ENABLED = false;

// Track if user has interacted with the page
let hasUserInteracted = false;

const markUserInteraction = () => {
  hasUserInteracted = true;
  if (typeof window !== 'undefined') {
    window.removeEventListener('touchstart', markUserInteraction);
    window.removeEventListener('click', markUserInteraction);
    window.removeEventListener('pointerdown', markUserInteraction);
  }
};

// Set up interaction listeners once
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', markUserInteraction, { once: true, passive: true });
  window.addEventListener('click', markUserInteraction, { once: true });
  window.addEventListener('pointerdown', markUserInteraction, { once: true });
}

/**
 * Check if vibration is currently allowed
 * Uses navigator.userActivation when available (modern browsers)
 * Falls back to tracking user interaction manually
 */
function canVibrate(): boolean {
  // Master kill switch
  if (!HAPTICS_ENABLED) return false;
  
  // Check if vibrate API exists
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
  
  // Disable in embedded frames (preview mode) to avoid intervention warnings
  if (typeof window !== 'undefined' && window.self !== window.top) return false;
  
  // Check for transient user activation (modern browsers)
  if ('userActivation' in navigator) {
    const activation = (navigator as any).userActivation;
    if (activation && typeof activation.isActive === 'boolean') {
      return activation.isActive;
    }
  }
  
  // Fallback: check our manual tracking
  return hasUserInteracted;
}

/**
 * Safely trigger vibration only if allowed by browser policy
 * Never throws or logs warnings - just silently skips if not allowed
 */
export function safeVibrate(pattern: number | readonly number[] = 10): void {
  if (canVibrate()) {
    try {
      navigator.vibrate(pattern as VibratePattern);
    } catch {
      // Silently ignore any errors
    }
  }
}

// Preset patterns
export const hapticPatterns = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  error: [50, 100, 50],
  tap: 10,
  doubleTap: [10, 30, 10],
  longPress: [50, 30, 50],
  snap: 15,
  release: 30,
} as const;

export function safeHapticLight(): void {
  safeVibrate(hapticPatterns.light);
}

export function safeHapticMedium(): void {
  safeVibrate(hapticPatterns.medium);
}

export function safeHapticHeavy(): void {
  safeVibrate(hapticPatterns.heavy);
}

export function safeHapticSuccess(): void {
  safeVibrate(hapticPatterns.success);
}

export function safeHapticError(): void {
  safeVibrate(hapticPatterns.error);
}
