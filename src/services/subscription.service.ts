// Subscription service for managing user subscriptions
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: 'free' | 'pro' | 'creator';
  tier_name: string;
  subscription_end: string | null;
  reward_multiplier: number;
}

export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      'Basic features',
      'Standard rewards (1x)',
      'Limited daily rewards',
    ],
    reward_multiplier: 1,
  },
  pro: {
    name: 'Pro',
    price: 4.99,
    price_id: 'price_1Sj6GwA5pO96HvRnf7ck3M9G',
    product_id: 'prod_TgTDyU5HXIH8hh',
    features: [
      'Boosts & Analytics',
      'Custom Themes',
      '2x Reward Multiplier',
      'Priority support',
    ],
    reward_multiplier: 2,
  },
  creator: {
    name: 'Creator',
    price: 14.99,
    price_id: 'price_1Sj6HGA5pO96HvRnEi3u1FqQ',
    product_id: 'prod_TgTDRhBdlgafaX',
    features: [
      'Ad-free experience',
      '3x Reward Multiplier',
      'Creator Tools',
      'Priority support',
      'Early access to features',
    ],
    reward_multiplier: 3,
  },
} as const;

class SubscriptionService {
  async checkSubscription(): Promise<SubscriptionStatus> {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        console.error('[Subscription] Check error:', error);
        return this.getDefaultStatus();
      }

      return {
        subscribed: data.subscribed || false,
        tier: data.tier || 'free',
        tier_name: data.tier_name || 'Free',
        subscription_end: data.subscription_end || null,
        reward_multiplier: data.reward_multiplier || 1,
      };
    } catch (error) {
      console.error('[Subscription] Check error:', error);
      return this.getDefaultStatus();
    }
  }

  async createCheckout(tier: 'pro' | 'creator'): Promise<{ url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier },
      });

      if (error) {
        console.error('[Subscription] Checkout error:', error);
        return { error: error.message };
      }

      return { url: data.url };
    } catch (error) {
      console.error('[Subscription] Checkout error:', error);
      return { error: 'Failed to create checkout session' };
    }
  }

  async openCustomerPortal(): Promise<{ url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) {
        console.error('[Subscription] Portal error:', error);
        return { error: error.message };
      }

      return { url: data.url };
    } catch (error) {
      console.error('[Subscription] Portal error:', error);
      return { error: 'Failed to open customer portal' };
    }
  }

  private getDefaultStatus(): SubscriptionStatus {
    return {
      subscribed: false,
      tier: 'free',
      tier_name: 'Free',
      subscription_end: null,
      reward_multiplier: 1,
    };
  }
}

export const subscriptionService = new SubscriptionService();
