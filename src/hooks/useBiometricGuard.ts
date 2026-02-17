import { useCallback } from 'react';
import { useBiometricAuth, type BiometricVerifyOptions } from '@/hooks/useBiometricAuth';

export interface UseBiometricGuardReturn {
  /**
   * Run a sensitive action only after successful biometric verification.
   * On web or when biometric is unavailable, runs the action immediately (caller can gate by isAvailable).
   */
  requireBiometric: <T>(action: () => Promise<T>, options?: BiometricVerifyOptions) => Promise<T | null>;
  /** Whether biometric is available on this device. */
  isAvailable: boolean;
  /** Whether the user has enabled biometric in app settings. */
  isEnabled: boolean;
}

const DEFAULT_GUARD_OPTIONS: BiometricVerifyOptions = {
  reason: 'Confirm your identity to continue',
  title: 'Authentication required',
  subtitle: 'Verify it’s you',
  description: 'Use your biometric to confirm this action',
  useFallback: true,
  maxAttempts: 3,
};

/**
 * Hook to protect sensitive actions (e.g. payout, delete account) with biometric verification.
 * Use when the user must prove identity before performing an action.
 */
export function useBiometricGuard(): UseBiometricGuardReturn {
  const { isAvailable, isEnabled, authenticate } = useBiometricAuth();

  const requireBiometric = useCallback(
    async <T>(
      action: () => Promise<T>,
      options?: BiometricVerifyOptions
    ): Promise<T | null> => {
      const opts = { ...DEFAULT_GUARD_OPTIONS, ...options };

      if (!isAvailable || !isEnabled) {
        return action();
      }

      const verified = await authenticate(opts);
      if (!verified) {
        return null;
      }

      return action();
    },
    [isAvailable, isEnabled, authenticate]
  );

  return {
    requireBiometric,
    isAvailable,
    isEnabled,
  };
}
