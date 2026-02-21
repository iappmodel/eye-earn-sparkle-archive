import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/auth';

/**
 * Loads the current user's profile when user changes.
 */
export function useProfileLoader(user: User | null, setProfile: (p: Profile | null) => void) {
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[useProfileLoader] Error:', error);
        setProfile(null);
        return;
      }
      setProfile(data as Profile | null);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, setProfile]);
}
