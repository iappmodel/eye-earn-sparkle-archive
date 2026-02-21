import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { subscriptionService, type SubscriptionStatus } from '@/services/subscription.service';

/**
 * Loads the current user's subscription status when user changes.
 */
export function useSubscriptionLoader(
  user: User | null,
  setSubscription: (s: SubscriptionStatus | null) => void
) {
  useEffect(() => {
    if (!user) {
      setSubscription(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const status = await subscriptionService.checkSubscription();
        if (!cancelled) setSubscription(status);
      } catch (error) {
        if (!cancelled) {
          console.error('[useSubscriptionLoader] Error:', error);
          setSubscription(null);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, setSubscription]);
}
