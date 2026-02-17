// Subscription service for managing user subscriptions (Stripe + Supabase)
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: 'free' | 'pro' | 'creator';
  tier_name: string;
  subscription_end: string | null;
  reward_multiplier: number;
  /** When the trial ends (if in trial). */
  trial_end: string | null;
  /** Subscription will not renew at period end. */
  cancel_at_period_end: boolean;
  /** Start of current billing period. */
  current_period_start: string | null;
}

export type SubscriptionTierKey = 'free' | 'pro' | 'creator';

export interface SubscriptionTierConfig {
  name: string;
  price: number;
  price_id: string | null;
  product_id: string | null;
  reward_multiplier: number;
  trial_days: number;
  features: readonly string[];
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierKey, SubscriptionTierConfig> = {
  free: {
    name: 'Free',
    price: 0,
    price_id: null,
    product_id: null,
    reward_multiplier: 1,
    trial_days: 0,
    features: [
      'Basic features',
      'Standard rewards (1x)',
      'Limited daily rewards',
    ],
  },
  pro: {
    name: 'Pro',
    price: 4.99,
    price_id: 'price_1Sj6GwA5pO96HvRnf7ck3M9G',
    product_id: 'prod_TgTDyU5HXIH8hh',
    reward_multiplier: 2,
    trial_days: 14,
    features: [
      'Boosts & Analytics',
      'Custom Themes',
      '2x Reward Multiplier',
      'Priority support',
      '14-day free trial',
    ],
  },
  creator: {
    name: 'Creator',
    price: 14.99,
    price_id: 'price_1Sj6HGA5pO96HvRnEi3u1FqQ',
    product_id: 'prod_TgTDRhBdlgafaX',
    reward_multiplier: 3,
    trial_days: 14,
    features: [
      'Ad-free experience',
      '3x Reward Multiplier',
      'Creator Tools',
      'Priority support',
      'Early access to features',
      '14-day free trial',
    ],
  },
} as const;

/** Default status for unauthenticated or error. */
function getDefaultStatus(): SubscriptionStatus {
  return {
    subscribed: false,
    tier: 'free',
    tier_name: 'Free',
    subscription_end: null,
    reward_multiplier: 1,
    trial_end: null,
    cancel_at_period_end: false,
    current_period_start: null,
  };
}

/** Whether the user is currently in a trial (subscribed and trial_end is in the future). */
export function isInTrial(status: SubscriptionStatus): boolean {
  if (!status.subscribed || !status.trial_end) return false;
  return new Date(status.trial_end) > new Date();
}

/** Days remaining in trial (0 if not in trial or expired). */
export function daysLeftInTrial(status: SubscriptionStatus): number {
  if (!isInTrial(status) || !status.trial_end) return 0;
  const end = new Date(status.trial_end);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function mapResponseToStatus(data: Record<string, unknown>): SubscriptionStatus {
  return {
    subscribed: Boolean(data.subscribed),
    tier: (data.tier as SubscriptionStatus['tier']) || 'free',
    tier_name: (data.tier_name as string) || 'Free',
    subscription_end: (data.subscription_end as string) || null,
    reward_multiplier: Number(data.reward_multiplier) || 1,
    trial_end: (data.trial_end as string) || null,
    cancel_at_period_end: Boolean(data.cancel_at_period_end),
    current_period_start: (data.current_period_start as string) || null,
  };
}

class SubscriptionService {
  /**
   * Read subscription status from Supabase cache (subscription_status table).
   * Use for fast UI; call checkSubscription() to refresh from Stripe.
   */
  async getCachedStatus(): Promise<SubscriptionStatus | null> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return null;

      const { data, error } = await supabase
        .from('subscription_status')
        .select('is_subscribed, tier, subscription_end, reward_multiplier, trial_end, cancel_at_period_end, current_period_start')
        .eq('user_id', session.session.user.id)
        .maybeSingle();

      if (error || !data) return null;

      const tier = (data.tier as SubscriptionStatus['tier']) || 'free';
      const tierName = SUBSCRIPTION_TIERS[tier]?.name ?? (tier === 'creator' ? 'Creator' : tier === 'pro' ? 'Pro' : 'Free');
      return {
        subscribed: Boolean(data.is_subscribed),
        tier,
        tier_name: tierName,
        subscription_end: data.subscription_end ?? null,
        reward_multiplier: Number(data.reward_multiplier) ?? 1,
        trial_end: data.trial_end ?? null,
        cancel_at_period_end: Boolean(data.cancel_at_period_end),
        current_period_start: data.current_period_start ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check subscription against Stripe (and sync subscription_status). Preferred source of truth.
   */
  async checkSubscription(): Promise<SubscriptionStatus> {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        console.error('[Subscription] Check error:', error);
        return getDefaultStatus();
      }

      return mapResponseToStatus(data ?? {});
    } catch (error) {
      console.error('[Subscription] Check error:', error);
      return getDefaultStatus();
    }
  }

  /**
   * Create a Stripe Checkout session for the given tier. Opens in new tab; user returns with ?subscription=success.
   */
  async createCheckout(tier: 'pro' | 'creator'): Promise<{ url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier },
      });

      if (error) {
        console.error('[Subscription] Checkout error:', error);
        return { error: error.message };
      }

      return { url: data?.url };
    } catch (error) {
      console.error('[Subscription] Checkout error:', error);
      return { error: 'Failed to create checkout session' };
    }
  }

  /**
   * Open Stripe Customer Portal (manage subscription, payment methods, invoices). Opens in new tab.
   */
  async openCustomerPortal(): Promise<{ url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) {
        console.error('[Subscription] Portal error:', error);
        return { error: error.message };
      }

      return { url: data?.url };
    } catch (error) {
      console.error('[Subscription] Portal error:', error);
      return { error: 'Failed to open customer portal' };
    }
  }
}

export const subscriptionService = new SubscriptionService();
