/**
 * Crash-loop detection & heavy-component guard.
 * Tracks rapid error sequences and allows temporary disabling of performance-heavy features.
 */

const STORAGE_KEY = 'app_crash_guard';
const CRASH_THRESHOLD = 3; // number of crashes within window
const CRASH_WINDOW_MS = 60_000; // 1 minute

interface CrashGuardState {
  crashes: number[];
  heavyComponentsDisabled: boolean;
  disabledUntil: number | null;
}

const getState = (): CrashGuardState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { crashes: [], heavyComponentsDisabled: false, disabledUntil: null };
    return JSON.parse(raw);
  } catch {
    return { crashes: [], heavyComponentsDisabled: false, disabledUntil: null };
  }
};

const setState = (state: CrashGuardState) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable
  }
};

/**
 * Record a crash/error event.
 * Returns true if we've entered "crash-loop" mode.
 */
export const recordCrash = (): boolean => {
  const now = Date.now();
  const state = getState();
  
  // Add current crash, filter out old ones
  state.crashes = [...state.crashes.filter(t => now - t < CRASH_WINDOW_MS), now];
  
  // Check if we're in a crash loop
  if (state.crashes.length >= CRASH_THRESHOLD) {
    state.heavyComponentsDisabled = true;
    state.disabledUntil = now + 30_000; // Disable for 30 seconds
    console.warn('[CrashGuard] Crash loop detected, disabling heavy components for 30s');
  }
  
  setState(state);
  return state.heavyComponentsDisabled;
};

/**
 * Check if heavy components (camera, AR, eye tracking) should be disabled.
 */
export const shouldDisableHeavyComponents = (): boolean => {
  const state = getState();
  
  // If disabled period has expired, re-enable
  if (state.disabledUntil && Date.now() > state.disabledUntil) {
    state.heavyComponentsDisabled = false;
    state.disabledUntil = null;
    state.crashes = [];
    setState(state);
    return false;
  }
  
  return state.heavyComponentsDisabled;
};

/**
 * Manually disable heavy components (e.g., from UI toggle).
 */
export const disableHeavyComponents = (durationMs = 60_000) => {
  const state = getState();
  state.heavyComponentsDisabled = true;
  state.disabledUntil = Date.now() + durationMs;
  setState(state);
  console.log('[CrashGuard] Heavy components disabled for', durationMs, 'ms');
};

/**
 * Reset crash guard state.
 */
export const resetCrashGuard = () => {
  setState({ crashes: [], heavyComponentsDisabled: false, disabledUntil: null });
  console.log('[CrashGuard] Reset');
};

/**
 * Hook-friendly check with automatic re-check interval.
 */
export const useCrashGuard = () => {
  // This is a simple check - components can call this on mount
  return {
    isDisabled: shouldDisableHeavyComponents(),
    disable: disableHeavyComponents,
    reset: resetCrashGuard,
  };
};
