import React, { useEffect, useState } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, CreditCard, Building2, TrendingUp, RefreshCw, Wallet, Crown, Zap } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { CoinDisplay } from './CoinDisplay';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService, WalletTransaction } from '@/services/rewards.service';
import { subscriptionService, SUBSCRIPTION_TIERS, SubscriptionStatus } from '@/services/subscription.service';
import { Progress } from './ui/progress';
import { toast } from 'sonner';

interface DailyLimits {
  icoin_earned: number;
  vicoin_earned: number;
  promo_views: number;
  icoin_limit: number;
  vicoin_limit: number;
  promo_limit: number;
}

interface WalletScreenProps {
  isOpen: boolean;
  onClose: () => void;
  vicoins: number;
  icoins: number;
}

type WalletTab = 'overview' | 'transactions' | 'subscription' | 'payout';

export const WalletScreen: React.FC<WalletScreenProps> = ({
  isOpen,
  onClose,
  vicoins,
  icoins,
}) => {
  const { user, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [dailyLimits, setDailyLimits] = useState<DailyLimits | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<WalletTab>('overview');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadWalletData();
    }
  }, [isOpen, user?.id]);

  const loadWalletData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    
    try {
      const [txHistory, limits, subStatus] = await Promise.all([
        rewardsService.getTransactionHistory(user.id, 20),
        rewardsService.getDailyLimits(user.id),
        subscriptionService.checkSubscription(),
      ]);
      
      setTransactions(txHistory);
      setDailyLimits(limits);
      setSubscription(subStatus);
    } catch (error) {
      console.error('[Wallet] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (tier: 'pro' | 'creator') => {
    const result = await subscriptionService.createCheckout(tier);
    if (result.url) {
      window.open(result.url, '_blank');
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleManageSubscription = async () => {
    const result = await subscriptionService.openCustomerPortal();
    if (result.url) {
      window.open(result.url, '_blank');
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount);
    if (!amount || amount < 100) {
      toast.error('Minimum transfer is 100 Icoins');
      return;
    }
    if (amount % 10 !== 0) {
      toast.error('Amount must be divisible by 10');
      return;
    }
    if (amount > icoins) {
      toast.error('Insufficient Icoin balance');
      return;
    }

    setIsTransferring(true);
    try {
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase
        .functions.invoke('transfer-coins', {
          body: { icoinAmount: amount },
        });

      if (error) throw error;

      if (data.success) {
        toast.success(`Converted ${data.icoin_spent} Icoins to ${data.vicoin_received} Vicoins!`);
        setTransferAmount('');
        await refreshProfile();
        await loadWalletData();
      }
    } catch (error) {
      console.error('[Wallet] Transfer error:', error);
      toast.error('Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  if (!isOpen) return null;

  const getTransactionIcon = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'earned':
      case 'received':
        return <ArrowDownLeft className="w-4 h-4 text-primary" />;
      case 'spent':
      case 'sent':
      case 'withdrawn':
        return <ArrowUpRight className="w-4 h-4 text-destructive" />;
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Wallet },
    { id: 'transactions' as const, label: 'History', icon: RefreshCw },
    { id: 'subscription' as const, label: 'Plans', icon: Crown },
    { id: 'payout' as const, label: 'Payout', icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up overflow-y-auto">
      <div className="max-w-md mx-auto min-h-full flex flex-col p-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold">Wallet</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'neu-button'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Balance Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="neu-card rounded-3xl p-5">
                    <CoinDisplay type="vicoin" amount={vicoins} size="lg" />
                  </div>
                  <div className="neu-card rounded-3xl p-5">
                    <CoinDisplay type="icoin" amount={icoins} size="lg" />
                  </div>
                </div>

                {/* Current Plan Badge */}
                {subscription && (
                  <div className={cn(
                    'neu-card rounded-2xl p-4 border-2',
                    subscription.tier === 'creator' && 'border-icoin',
                    subscription.tier === 'pro' && 'border-primary',
                    subscription.tier === 'free' && 'border-muted'
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          subscription.tier === 'creator' && 'bg-icoin/20',
                          subscription.tier === 'pro' && 'bg-primary/20',
                          subscription.tier === 'free' && 'bg-muted'
                        )}>
                          <Crown className={cn(
                            'w-5 h-5',
                            subscription.tier === 'creator' && 'text-icoin',
                            subscription.tier === 'pro' && 'text-primary',
                            subscription.tier === 'free' && 'text-muted-foreground'
                          )} />
                        </div>
                        <div>
                          <p className="font-semibold">{subscription.tier_name} Plan</p>
                          <p className="text-xs text-muted-foreground">
                            {subscription.reward_multiplier}x reward multiplier
                          </p>
                        </div>
                      </div>
                      {subscription.subscribed && (
                        <button
                          onClick={handleManageSubscription}
                          className="text-sm text-primary underline"
                        >
                          Manage
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Daily Progress */}
                {dailyLimits && (
                  <div className="neu-inset rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Daily Progress</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Icoins</span>
                          <span>{dailyLimits.icoin_earned}/{dailyLimits.icoin_limit}</span>
                        </div>
                        <Progress value={(dailyLimits.icoin_earned / dailyLimits.icoin_limit) * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Vicoins</span>
                          <span>{dailyLimits.vicoin_earned}/{dailyLimits.vicoin_limit}</span>
                        </div>
                        <Progress value={(dailyLimits.vicoin_earned / dailyLimits.vicoin_limit) * 100} className="h-2" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Coin Transfer */}
                <div className="neu-card rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Convert Icoins → Vicoins</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Exchange rate: 10 Icoins = 1 Vicoin
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="Enter Icoins"
                      className="flex-1 px-3 py-2 rounded-xl neu-inset text-sm bg-transparent"
                      min={100}
                      step={10}
                    />
                    <button
                      onClick={handleTransfer}
                      disabled={isTransferring || !transferAmount}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                    >
                      {isTransferring ? '...' : 'Convert'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="flex-1">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No transactions yet</p>
                    <p className="text-sm">Start watching content to earn rewards!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-4 p-4 neu-inset rounded-2xl">
                        <div className="w-10 h-10 rounded-full neu-button flex items-center justify-center">
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.timestamp.toLocaleDateString()}
                          </p>
                        </div>
                        <div className={cn(
                          'font-display font-semibold whitespace-nowrap',
                          tx.type === 'earned' || tx.type === 'received' ? 'text-primary' : 'text-destructive'
                        )}>
                          {tx.type === 'earned' || tx.type === 'received' ? '+' : '-'}
                          {tx.amount}
                          <span className="text-xs ml-1">{tx.coinType === 'icoin' ? 'i' : 'v'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <div className="space-y-4">
                {Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => {
                  const isCurrentPlan = subscription?.tier === key;
                  const tierKey = key as 'free' | 'pro' | 'creator';
                  
                  return (
                    <div
                      key={key}
                      className={cn(
                        'neu-card rounded-2xl p-5 border-2 transition-all',
                        isCurrentPlan && 'border-primary',
                        !isCurrentPlan && 'border-transparent'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-lg">{tier.name}</h3>
                            {isCurrentPlan && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                Your Plan
                              </span>
                            )}
                          </div>
                          <p className="text-2xl font-bold mt-1">
                            ${tier.price}
                            {tier.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Zap className="w-4 h-4 text-primary" />
                          <span>{tier.reward_multiplier}x</span>
                        </div>
                      </div>
                      
                      <ul className="space-y-2 mb-4">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {!isCurrentPlan && tierKey !== 'free' && (
                        <button
                          onClick={() => handleSubscribe(tierKey)}
                          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
                        >
                          Upgrade to {tier.name}
                        </button>
                      )}
                      
                      {isCurrentPlan && subscription?.subscribed && (
                        <button
                          onClick={handleManageSubscription}
                          className="w-full py-3 rounded-xl neu-button font-medium"
                        >
                          Manage Subscription
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Payout Tab */}
            {activeTab === 'payout' && (
              <div className="space-y-6">
                <div className="neu-card rounded-2xl p-5">
                  <h3 className="font-semibold mb-2">Payout Requirements</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Minimum 500 Vicoins or 1000 Icoins</li>
                    <li>• KYC verification required</li>
                    <li>• Processing time: 3-5 business days</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="neu-card rounded-2xl p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Available</p>
                    <p className="font-display text-2xl font-bold gradient-text">{vicoins}v</p>
                    <p className="text-xs text-muted-foreground">Min: 500</p>
                  </div>
                  <div className="neu-card rounded-2xl p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Available</p>
                    <p className="font-display text-2xl font-bold gradient-text-gold">{icoins}i</p>
                    <p className="text-xs text-muted-foreground">Min: 1000</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    disabled={vicoins < 500}
                    className="w-full py-4 rounded-2xl neu-button flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <Building2 className="w-5 h-5" />
                    <span>Withdraw to Bank</span>
                  </button>
                  <button
                    disabled={vicoins < 500}
                    className="w-full py-4 rounded-2xl neu-button flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Withdraw to PayPal</span>
                  </button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Complete KYC verification in your profile to enable payouts
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
