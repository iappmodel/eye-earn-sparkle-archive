import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: 'free' | 'pro' | 'creator';
  tierName: string;
  subscriptionEnd: string | null;
  rewardMultiplier: number;
}

export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    productId: null,
    rewardMultiplier: 1,
    features: [
      'Basic feed access',
      'Standard rewards (1x)',
      'Community support',
    ],
  },
  pro: {
    name: 'Pro',
    price: 499,
    priceId: 'price_1Sj6GwA5pO96HvRnf7ck3M9G',
    productId: 'prod_TgTDyU5HXIH8hh',
    rewardMultiplier: 2,
    features: [
      'All Free features',
      '2x Reward Multiplier',
      'Advanced Analytics',
      'Custom Themes',
      'Priority Feed',
      'Boost Credits',
    ],
  },
  creator: {
    name: 'Creator',
    price: 1499,
    priceId: 'price_1Sj6HGA5pO96HvRnEi3u1FqQ',
    productId: 'prod_TgTDRhBdlgafaX',
    rewardMultiplier: 3,
    features: [
      'All Pro features',
      '3x Reward Multiplier',
      'Creator Tools',
      'Audience Analytics',
      'Priority Support',
      'Ad-free Experience',
      'Early Feature Access',
    ],
  },
};

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    tier: 'free',
    tierName: 'Free',
    subscriptionEnd: null,
    rewardMultiplier: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus({
        subscribed: false,
        tier: 'free',
        tierName: 'Free',
        subscriptionEnd: null,
        rewardMultiplier: 1,
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) throw error;

      setStatus({
        subscribed: data.subscribed,
        tier: data.tier || 'free',
        tierName: data.tier_name || 'Free',
        subscriptionEnd: data.subscription_end,
        rewardMultiplier: data.reward_multiplier || 1,
      });
    } catch (error) {
      console.error('Failed to check subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh subscription status periodically
  useEffect(() => {
    const interval = setInterval(checkSubscription, 60000); // Every minute
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const subscribe = async (tier: 'pro' | 'creator') => {
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
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
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
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast({
        title: 'Portal Error',
        description: 'Failed to open subscription management',
        variant: 'destructive',
      });
    }
  };

  return {
    ...status,
    isLoading,
    isCheckingOut,
    checkSubscription,
    subscribe,
    openCustomerPortal,
    tiers: SUBSCRIPTION_TIERS,
  };
}
