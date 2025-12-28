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
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  tier,
  isCurrentPlan,
  onSelect,
  isLoading,
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
        : 'neu-card hover:scale-[1.02]'
    )}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          Current Plan
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
            {config.rewardMultiplier}x Rewards
          </p>
        </div>
      </div>

      <div className="mb-4">
        <span className="font-display text-3xl font-bold">
          {config.price === 0 ? 'Free' : formatCurrency(config.price / 100)}
        </span>
        {config.price > 0 && (
          <span className="text-muted-foreground text-sm">/month</span>
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
  const { tier, isLoading, isCheckingOut, subscribe, openCustomerPortal, subscribed } = useSubscription();

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
            isCurrentPlan={tier === t}
            onSelect={() => subscribe(t as 'pro' | 'creator')}
            isLoading={isCheckingOut}
          />
        ))}
      </div>

      {subscribed && (
        <button
          onClick={openCustomerPortal}
          className="w-full text-center text-sm text-primary hover:underline py-2"
        >
          Manage Subscription
        </button>
      )}
    </div>
  );
};

export default SubscriptionPlans;
