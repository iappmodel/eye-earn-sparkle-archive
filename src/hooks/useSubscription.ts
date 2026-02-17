import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscriptionService,
  SUBSCRIPTION_TIERS,
  type SubscriptionStatus,
  isInTrial as checkIsInTrial,
  daysLeftInTrial as getDaysLeftInTrial,
} from '@/services/subscription.service';
import { toast } from '@/hooks/use-toast';

const DEFAULT_STATUS: SubscriptionStatus = {
  subscribed: false,
  tier: 'free',
  tier_name: 'Free',
  subscription_end: null,
  reward_multiplier: 1,
  trial_end: null,
  cancel_at_period_end: false,
  current_period_start: null,
};

export type { SubscriptionStatus };
export { SUBSCRIPTION_TIERS };

export function useSubscription() {
  const { user, subscription, refreshSubscription, loading: authLoading } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const status: SubscriptionStatus = subscription ?? DEFAULT_STATUS;
  const isInTrial = checkIsInTrial(status);
  const daysLeftInTrial = getDaysLeftInTrial(status);

  // Refresh subscription when user is present and we have no subscription yet (e.g. first load)
  useEffect(() => {
    if (user && !subscription) {
      refreshSubscription();
    }
  }, [user, subscription, refreshSubscription]);

  // When user returns from Stripe (e.g. new tab), refresh subscription on window focus
  useEffect(() => {
    const handleFocus = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscription') === 'success' && user) {
        refreshSubscription();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, refreshSubscription]);

  const subscribe = useCallback(async (tier: 'pro' | 'creator') => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to subscribe',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingOut(true);
    try {
      const result = await subscriptionService.createCheckout(tier);
      if (result.error) {
        toast({
          title: 'Checkout Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }
      if (result.url) {
        window.open(result.url, '_blank');
        toast({
          title: 'Checkout opened',
          description: 'Complete payment in the new tab. Your plan will update when done.',
        });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Error',
        description: 'Failed to start checkout process',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
    }
  }, [user]);

  const openCustomerPortal = useCallback(async () => {
    try {
      const result = await subscriptionService.openCustomerPortal();
      if (result.error) {
        toast({
          title: 'Portal Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast({
        title: 'Portal Error',
        description: 'Failed to open subscription management',
        variant: 'destructive',
      });
    }
  }, []);

  return {
    ...status,
    tierName: status.tier_name,
    subscriptionEnd: status.subscription_end,
    rewardMultiplier: status.reward_multiplier,
    trialEnd: status.trial_end,
    cancelAtPeriodEnd: status.cancel_at_period_end,
    currentPeriodStart: status.current_period_start,
    isInTrial,
    daysLeftInTrial,
    isLoading: authLoading,
    isCheckingOut,
    checkSubscription: refreshSubscription,
    subscribe,
    openCustomerPortal,
    tiers: SUBSCRIPTION_TIERS,
  };
}
