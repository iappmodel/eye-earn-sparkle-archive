import React, { useEffect, useState } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, CreditCard, Building2, TrendingUp } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { CoinDisplay } from './CoinDisplay';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService, WalletTransaction } from '@/services/rewards.service';
import { Progress } from './ui/progress';

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
  transactions?: WalletTransaction[];
}

export const WalletScreen: React.FC<WalletScreenProps> = ({
  isOpen,
  onClose,
  vicoins,
  icoins,
  transactions: propTransactions,
}) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>(propTransactions || []);
  const [dailyLimits, setDailyLimits] = useState<DailyLimits | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadWalletData();
    }
  }, [isOpen, user?.id]);

  const loadWalletData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    
    try {
      const [txHistory, limits] = await Promise.all([
        rewardsService.getTransactionHistory(user.id, 20),
        rewardsService.getDailyLimits(user.id),
      ]);
      
      setTransactions(txHistory);
      setDailyLimits(limits);
    } catch (error) {
      console.error('[Wallet] Load error:', error);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className="max-w-md mx-auto h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">Wallet</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="neu-card rounded-3xl p-5">
            <CoinDisplay type="vicoin" amount={vicoins} size="lg" />
          </div>
          <div className="neu-card rounded-3xl p-5">
            <CoinDisplay type="icoin" amount={icoins} size="lg" />
          </div>
        </div>

        {/* Daily Limits */}
        {dailyLimits && (
          <div className="neu-inset rounded-2xl p-4 mb-6">
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
                <Progress 
                  value={(dailyLimits.icoin_earned / dailyLimits.icoin_limit) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Vicoins</span>
                  <span>{dailyLimits.vicoin_earned}/{dailyLimits.vicoin_limit}</span>
                </div>
                <Progress 
                  value={(dailyLimits.vicoin_earned / dailyLimits.vicoin_limit) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Promo Views</span>
                  <span>{dailyLimits.promo_views}/{dailyLimits.promo_limit}</span>
                </div>
                <Progress 
                  value={(dailyLimits.promo_views / dailyLimits.promo_limit) * 100} 
                  className="h-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-4 mb-6">
          <button className="flex-1 neu-button rounded-2xl py-4 flex flex-col items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Withdraw</span>
          </button>
          <button className="flex-1 neu-button rounded-2xl py-4 flex flex-col items-center gap-2">
            <Building2 className="w-6 h-6 text-icoin" />
            <span className="text-sm font-medium">Transfer</span>
          </button>
        </div>

        {/* Transactions */}
        <div className="flex-1 overflow-hidden">
          <h2 className="font-display text-lg font-semibold mb-4">Recent Activity</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No transactions yet</p>
              <p className="text-sm">Start watching content to earn rewards!</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[calc(100%-2rem)]">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 p-4 neu-inset rounded-2xl">
                  <div className="w-10 h-10 rounded-full neu-button flex items-center justify-center">
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.timestamp.toLocaleDateString()}
                    </p>
                  </div>
                  <div className={cn(
                    'font-display font-semibold',
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
      </div>
    </div>
  );
};
