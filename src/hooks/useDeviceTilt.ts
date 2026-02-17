import { useState, useEffect, useRef, useCallback } from 'react';

type TiltDirection = 'phoneTiltLeft' | 'phoneTiltRight' | 'phoneTiltForward' | 'phoneTiltBack';

interface UseDeviceTiltOptions {
  enabled?: boolean;
  /** 1-10, maps to tilt threshold 25..5 degrees (higher = more sensitive) */
  sensitivity?: number;
  onTilt?: (direction: TiltDirection) => void;
}

interface DeviceTiltState {
  isSupported: boolean;
  isActive: boolean;
  permissionGranted: boolean | null;
  currentTilt: { gamma: number; beta: number };
  baseline: { gamma: number; beta: number };
}

// Maps sensitivity 1..10 to threshold in degrees (25..5).
// Higher sensitivity = smaller threshold = easier to trigger.
const sensitivityToThreshold = (s: number): number => {
  const clamped = Math.max(1, Math.min(10, s));
  return 25 - (clamped - 1) * (20 / 9); // 1→25°, 10→5°
};

// Hysteresis band (degrees): must return within this of baseline to re-arm.
const HYSTERESIS_BAND = 4;

// Per-direction cooldown (ms).
const COOLDOWN_MS = 500;

// Low-pass filter coefficient (0-1, higher = less smoothing, more responsive).
const LP_ALPHA = 0.15;

// Adaptive baseline EMA alpha (very slow drift).
const BASELINE_ALPHA = 0.005;

// Number of initial samples to establish baseline (at ~60Hz this is ~0.5s).
const BASELINE_SAMPLES = 30;

const dispatch = (trigger: TiltDirection) => {
  try {
    window.dispatchEvent(
      new CustomEvent('remoteGestureTrigger', {
        detail: { trigger, timestamp: Date.now() },
      }),
    );
  } catch {
    // ignore
  }
};

export function useDeviceTilt(options: UseDeviceTiltOptions = {}) {
  const { enabled = false, sensitivity = 5, onTilt } = options;

  const [state, setState] = useState<DeviceTiltState>({
    isSupported: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,
    isActive: false,
    permissionGranted: null,
    currentTilt: { gamma: 0, beta: 0 },
    baseline: { gamma: 0, beta: 0 },
  });

  const onTiltRef = useRef(onTilt);
  useEffect(() => {
    onTiltRef.current = onTilt;
  }, [onTilt]);

  // Mutable refs for the hot path (event handler runs at 60Hz).
  const filteredRef = useRef({ gamma: 0, beta: 0 });
  const baselineRef = useRef({ gamma: 0, beta: 0 });
  const baselineInitCountRef = useRef(0);
  const baselineInitAccRef = useRef({ gamma: 0, beta: 0 });
  const baselineReadyRef = useRef(false);

  // Per-direction: armed (ready to fire) and last-fire timestamp.
  const armedRef = useRef<Record<TiltDirection, boolean>>({
    phoneTiltLeft: true,
    phoneTiltRight: true,
    phoneTiltForward: true,
    phoneTiltBack: true,
  });
  const cooldownRef = useRef<Record<TiltDirection, number>>({
    phoneTiltLeft: 0,
    phoneTiltRight: 0,
    phoneTiltForward: 0,
    phoneTiltBack: 0,
  });

  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  // iOS 13+ permission request (must be called from user gesture).
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === 'function') {
        const result = await DOE.requestPermission();
        const granted = result === 'granted';
        setState(s => ({ ...s, permissionGranted: granted }));
        return granted;
      }
      // Non-iOS: permission is implicitly granted.
      setState(s => ({ ...s, permissionGranted: true }));
      return true;
    } catch {
      setState(s => ({ ...s, permissionGranted: false }));
      return false;
    }
  }, []);

  // Reset mutable state for a fresh activation.
  const resetState = useCallback(() => {
    filteredRef.current = { gamma: 0, beta: 0 };
    baselineRef.current = { gamma: 0, beta: 0 };
    baselineInitCountRef.current = 0;
    baselineInitAccRef.current = { gamma: 0, beta: 0 };
    baselineReadyRef.current = false;
    armedRef.current = {
      phoneTiltLeft: true,
      phoneTiltRight: true,
      phoneTiltForward: true,
      phoneTiltBack: true,
    };
    cooldownRef.current = {
      phoneTiltLeft: 0,
      phoneTiltRight: 0,
      phoneTiltForward: 0,
      phoneTiltBack: 0,
    };
  }, []);

  useEffect(() => {
    if (!enabled || !state.isSupported) {
      setState(s => ({ ...s, isActive: false }));
      return;
    }

    // If permission hasn't been checked yet, try silently (works on Android / desktop).
    if (state.permissionGranted === null) {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission !== 'function') {
        setState(s => ({ ...s, permissionGranted: true }));
      }
    }

    if (state.permissionGranted === false) return;

    resetState();

    const handleOrientation = (e: DeviceOrientationEvent) => {
      try {
        const rawGamma = typeof (e as any).gamma === 'number' ? (e as any).gamma : 0; // left/right tilt (–90..90)
        const rawBeta = typeof (e as any).beta === 'number' ? (e as any).beta : 0; // forward/back tilt (–180..180)

      // --- Low-pass filter ---
      const prev = filteredRef.current;
      const gamma = prev.gamma + LP_ALPHA * (rawGamma - prev.gamma);
      const beta = prev.beta + LP_ALPHA * (rawBeta - prev.beta);
      filteredRef.current = { gamma, beta };

      // --- Baseline initialization ---
      if (!baselineReadyRef.current) {
        baselineInitAccRef.current.gamma += gamma;
        baselineInitAccRef.current.beta += beta;
        baselineInitCountRef.current += 1;
        if (baselineInitCountRef.current >= BASELINE_SAMPLES) {
          const n = baselineInitCountRef.current;
          baselineRef.current = {
            gamma: baselineInitAccRef.current.gamma / n,
            beta: baselineInitAccRef.current.beta / n,
          };
          baselineReadyRef.current = true;
          setState(s => ({
            ...s,
            isActive: true,
            baseline: { ...baselineRef.current },
          }));
        }
        return;
      }

      // --- Adaptive baseline drift ---
      const bl = baselineRef.current;
      baselineRef.current = {
        gamma: bl.gamma + BASELINE_ALPHA * (gamma - bl.gamma),
        beta: bl.beta + BASELINE_ALPHA * (beta - bl.beta),
      };

      // --- Update React state (throttled to ~10fps to avoid over-rendering) ---
      setState(s => ({
        ...s,
        currentTilt: { gamma: Math.round(gamma * 10) / 10, beta: Math.round(beta * 10) / 10 },
        baseline: {
          gamma: Math.round(baselineRef.current.gamma * 10) / 10,
          beta: Math.round(baselineRef.current.beta * 10) / 10,
        },
      }));

      // --- Tilt detection ---
      const threshold = sensitivityToThreshold(sensitivityRef.current);
      const now = Date.now();

      const deltaGamma = gamma - baselineRef.current.gamma;
      const deltaBeta = beta - baselineRef.current.beta;

      const checkAndFire = (dir: TiltDirection, delta: number, positive: boolean) => {
        const exceeds = positive ? delta > threshold : delta < -threshold;
        const inNeutral = Math.abs(delta) < HYSTERESIS_BAND;

        if (inNeutral) {
          armedRef.current[dir] = true;
        }

        if (exceeds && armedRef.current[dir] && now - cooldownRef.current[dir] > COOLDOWN_MS) {
          armedRef.current[dir] = false;
          cooldownRef.current[dir] = now;
          dispatch(dir);
          onTiltRef.current?.(dir);
        }
      };

      checkAndFire('phoneTiltLeft', deltaGamma, false);
      checkAndFire('phoneTiltRight', deltaGamma, true);
      checkAndFire('phoneTiltForward', deltaBeta, false);
      checkAndFire('phoneTiltBack', deltaBeta, true);
      } catch {
        // ignore orientation errors (e.g. null gamma/beta on some devices)
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      setState(s => ({ ...s, isActive: false }));
    };
  }, [enabled, state.isSupported, state.permissionGranted, resetState]);

  return {
    ...state,
    requestPermission,
  };
}
