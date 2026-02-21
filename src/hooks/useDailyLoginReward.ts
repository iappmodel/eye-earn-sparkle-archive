import { useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/auth';

/**
 * Handles daily login reward logic when session/profile changes.
 * Placeholder: no-op for now. Can be extended to trigger check-in, spin wheel, or other daily rewards.
 */
export function useDailyLoginReward(_session: Session | null, _profile: Profile | null) {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
}
