import { useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type SetSession = (session: Session | null) => void;
type SetUser = (user: User | null) => void;
type SetIsRecoverySession = (value: boolean) => void;
type SetLoading = (loading: boolean) => void;

/**
 * Syncs Supabase auth state to React state.
 * Subscribes to onAuthStateChange and updates session, user, and recovery flag.
 */
export function useAuthSessionSync(
  setSession: SetSession,
  setUser: SetUser,
  setIsRecoverySession: SetIsRecoverySession,
  setLoading: SetLoading,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [enabled, setSession, setUser, setIsRecoverySession, setLoading]);
}
