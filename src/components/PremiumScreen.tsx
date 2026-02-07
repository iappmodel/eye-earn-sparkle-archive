import React, { useState } from 'react';
import { X, Crown, Gift, CreditCard } from 'lucide-react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { NeuButton } from './NeuButton';
import { SubscriptionPlans } from './SubscriptionPlans';
import { ReferralPanel } from './ReferralPanel';
import { cn } from '@/lib/utils';

type Tab = 'plans' | 'referral';

interface PremiumScreenProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

export const PremiumScreen: React.FC<PremiumScreenProps> = ({
  isOpen,
  onClose,
  initialTab = 'plans',
}) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'plans', label: 'Subscription', icon: <Crown className="w-4 h-4" /> },
    { id: 'referral', label: 'Referral', icon: <Gift className="w-4 h-4" /> },
  ];

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col p-6 overflow-y-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-icoin" />
            <h1 className="font-display text-2xl font-bold">Premium</h1>
          </div>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all',
                activeTab === tab.id
                  ? 'neu-button bg-primary/10 text-primary'
                  : 'neu-inset text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'plans' && <SubscriptionPlans />}
        {activeTab === 'referral' && <ReferralPanel />}
      </div>
    </SwipeDismissOverlay>
  );
};

export default PremiumScreen;
