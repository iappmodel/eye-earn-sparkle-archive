import React from 'react';
import { Check, Crown, Zap, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubscription, SUBSCRIPTION_TIERS } from '@/hooks/useSubscription';
import { NeuButton } from './NeuButton';
import { useLocalization } from '@/contexts/LocalizationContext';

interface SubscriptionCardProps {
  tier: 'free' | 'pro' | 'creator';
  isCurrentPlan: boolean;
  onSelect: () => void;
  isLoading?: boolean;
  badge?: 'popular' | 'best-value' | null;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  tier,
  isCurrentPlan,
  onSelect,
  isLoading,
  badge,
}) => {
  const { formatCurrency } = useLocalization();
  const config = SUBSCRIPTION_TIERS[tier];
  
  const icons = {
    free: <Star className="w-6 h-6" />,
    pro: <Zap className="w-6 h-6" />,
    creator: <Crown className="w-6 h-6" />,
  };

  const colors = {
    free: 'text-muted-foreground',
    pro: 'text-primary',
    creator: 'text-icoin',
  };

  return (
    <div className={cn(
      'relative rounded-2xl p-5 transition-all',
      isCurrentPlan 
        ? 'neu-button border-2 border-primary/50 bg-primary/5' 
        : 'neu-card hover:scale-[1.02]',
      badge === 'popular' && 'ring-2 ring-primary/30',
      badge === 'best-value' && 'ring-2 ring-icoin/30'
    )}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          Current Plan
        </div>
      )}
      {!isCurrentPlan && badge === 'popular' && (
        <div className="absolute -top-3 right-3 px-2.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold">
          Most Popular
        </div>
      )}
      {!isCurrentPlan && badge === 'best-value' && (
        <div className="absolute -top-3 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-icoin to-yellow-600 text-primary-foreground text-xs font-semibold">
          Best Value
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          tier === 'creator' 
            ? 'bg-gradient-to-br from-icoin to-yellow-600' 
            : tier === 'pro' 
              ? 'bg-gradient-to-br from-primary to-primary/70' 
              : 'bg-muted',
          tier !== 'free' && 'text-primary-foreground'
        )}>
          {icons[tier]}
        </div>
        <div>
          <h3 className={cn('font-display text-xl font-bold', colors[tier])}>
            {config.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {config.reward_multiplier}x Rewards
          </p>
        </div>
      </div>

      <div className="mb-4">
        <span className="font-display text-3xl font-bold">
          {config.price === 0 ? 'Free' : formatCurrency(config.price)}
        </span>
        {config.price > 0 && (
          <span className="text-muted-foreground text-sm">/month</span>
        )}
        {config.trial_days > 0 && (
          <p className="text-xs text-primary mt-1">{config.trial_days}-day free trial</p>
        )}
      </div>

      <ul className="space-y-2 mb-5">
        {config.features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            <Check className={cn('w-4 h-4', colors[tier])} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {tier !== 'free' && (
        <NeuButton
          onClick={onSelect}
          disabled={isLoading || isCurrentPlan}
          className={cn(
            'w-full',
            tier === 'creator' && 'bg-gradient-to-r from-icoin to-yellow-600 text-primary-foreground'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : (
            `Upgrade to ${config.name}`
          )}
        </NeuButton>
      )}
    </div>
  );
};

interface SubscriptionPlansProps {
  compact?: boolean;
}

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ 
  compact = false 
}) => {
  const {
    tier: currentTier,
    isLoading,
    isCheckingOut,
    subscribe,
    openCustomerPortal,
    subscribed,
    trialEnd,
    subscriptionEnd,
    cancelAtPeriodEnd,
    isInTrial,
    daysLeftInTrial,
  } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const tiers = compact 
    ? (['pro', 'creator'] as const) 
    : (['free', 'pro', 'creator'] as const);

  const getBadge = (t: 'free' | 'pro' | 'creator'): 'popular' | 'best-value' | null => {
    if (t === 'pro') return 'popular';
    if (t === 'creator') return 'best-value';
    return null;
  };

  return (
    <div className="space-y-4">
      <div className={cn(
        'grid gap-4',
        compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
      )}>
        {tiers.map((t) => (
          <SubscriptionCard
            key={t}
            tier={t}
            isCurrentPlan={currentTier === t}
            onSelect={() => subscribe(t as 'pro' | 'creator')}
            isLoading={isCheckingOut}
            badge={getBadge(t)}
          />
        ))}
      </div>

      {subscribed && (
        <div className="space-y-2">
          {(trialEnd || subscriptionEnd || cancelAtPeriodEnd) && (
            <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
              {isInTrial && daysLeftInTrial > 0 && (
                <p className="text-primary font-medium">
                  {daysLeftInTrial} {daysLeftInTrial === 1 ? 'day' : 'days'} left in free trial — ends {new Date(trialEnd!).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
              )}
              {trialEnd && !isInTrial && (
                <p>Trial ended: {new Date(trialEnd).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
              )}
              {subscriptionEnd && (
                <p>{isInTrial ? 'Billing starts' : 'Next billing'}: {new Date(subscriptionEnd).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
              )}
              {cancelAtPeriodEnd && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">Subscription will not renew at period end</p>
              )}
            </div>
          )}
          <button
            onClick={openCustomerPortal}
            className="w-full py-3 rounded-xl neu-button font-medium text-center text-sm"
          >
            Manage Subscription
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlans;
