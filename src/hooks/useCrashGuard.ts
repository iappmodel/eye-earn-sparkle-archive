import { useState, useEffect, useCallback } from 'react';
import { 
  shouldDisableHeavyComponents, 
  disableHeavyComponents, 
  resetCrashGuard 
} from '@/lib/crashGuard';

/**
 * React hook for crash guard state.
 * Components can use this to check if they should render in "safe mode".
 */
export const useCrashGuard = () => {
  const [isDisabled, setIsDisabled] = useState(() => shouldDisableHeavyComponents());

  useEffect(() => {
    // Re-check periodically in case the disable period expires
    const interval = setInterval(() => {
      setIsDisabled(shouldDisableHeavyComponents());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const disable = useCallback((durationMs = 60_000) => {
    disableHeavyComponents(durationMs);
    setIsDisabled(true);
  }, []);

  const reset = useCallback(() => {
    resetCrashGuard();
    setIsDisabled(false);
  }, []);

  return { isDisabled, disable, reset };
};

export default useCrashGuard;
