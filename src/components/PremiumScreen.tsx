import React, { useState } from 'react';
import {
  X,
  Crown,
  Gift,
  Zap,
  Star,
  Shield,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { NeuButton } from './NeuButton';
import { SubscriptionPlans } from './SubscriptionPlans';
import { ReferralPanel } from './ReferralPanel';
import { useSubscription } from '@/hooks/useSubscription';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

type Tab = 'plans' | 'referral';

interface PremiumScreenProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: Tab;
}

const PREMIUM_BENEFIT_KEYS = [
  { icon: Zap, key: 'premium.benefitMultiplier' as const, highlight: true },
  { icon: Sparkles, key: 'premium.benefitStudio' as const },
  { icon: Shield, key: 'premium.benefitSecure' as const },
  { icon: CreditCard, key: 'premium.benefitCancel' as const },
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'When am I charged?',
    a: 'After your free trial ends. You can cancel before the trial ends and never be charged. Pro and Creator both include a 14-day free trial.',
  },
  {
    q: 'How do I cancel?',
    a: 'Tap "Manage Subscription" and use the Stripe customer portal to cancel. Your plan stays active until the end of the current period.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards, and other payment methods supported by Stripe in your region.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes. Use "Manage Subscription" to upgrade or change your plan. Changes take effect at the next billing cycle where applicable.',
  },
];

export const PremiumScreen: React.FC<PremiumScreenProps> = ({
  isOpen,
  onClose,
  initialTab = 'plans',
}) => {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const {
    tier,
    tierName,
    rewardMultiplier,
    isInTrial,
    daysLeftInTrial,
  } = useSubscription();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'plans', label: t('premium.plans'), icon: <Crown className="w-4 h-4" /> },
    { id: 'referral', label: t('premium.referral'), icon: <Gift className="w-4 h-4" /> },
  ];

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col p-6 overflow-y-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">{t('premium.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('premium.subtitle')}</p>
            </div>
          </div>
          <NeuButton onClick={onClose} size="sm" aria-label="Close">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Current plan hero */}
        <div
          className={cn(
            'rounded-2xl p-4 mb-6 border-2',
            tier === 'creator' && 'bg-gradient-to-br from-icoin/10 to-yellow-600/10 border-icoin/40',
            tier === 'pro' && 'bg-primary/10 border-primary/40',
            tier === 'free' && 'neu-inset border-transparent'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  tier === 'creator' && 'bg-gradient-to-br from-icoin to-yellow-600 text-primary-foreground',
                  tier === 'pro' && 'bg-primary text-primary-foreground',
                  tier === 'free' && 'bg-muted'
                )}
              >
                {tier === 'creator' && <Crown className="w-6 h-6" />}
                {tier === 'pro' && <Zap className="w-6 h-6" />}
                {tier === 'free' && <Star className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-semibold">{tierName} Plan</p>
                <p className="text-sm text-muted-foreground">
                  {rewardMultiplier}x reward multiplier
                </p>
              </div>
            </div>
            {isInTrial && daysLeftInTrial > 0 && (
              <div className="text-right">
                <p className="text-xs font-medium text-primary">Free trial</p>
                <p className="text-sm font-bold">{daysLeftInTrial} days left</p>
              </div>
            )}
          </div>
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
                  ? 'neu-button bg-primary/10 text-primary border border-primary/30'
                  : 'neu-inset text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            {/* Why upgrade */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t('premium.whyUpgrade')}
              </h2>
              <ul className="space-y-2">
                {PREMIUM_BENEFIT_KEYS.map((item, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex items-center gap-3 py-2 px-3 rounded-xl',
                      item.highlight ? 'bg-primary/10 text-primary' : 'neu-inset'
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm">{t(item.key)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <SubscriptionPlans />

            {/* FAQ */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                {t('premium.faq')}
              </h2>
              <div className="space-y-1">
                {FAQ_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="neu-card rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                      className="w-full flex items-center justify-between gap-2 p-3 text-left text-sm font-medium"
                    >
                      {item.q}
                      {faqOpen === i ? (
                        <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {faqOpen === i && (
                      <div className="px-3 pb-3 pt-3 text-sm text-muted-foreground border-t border-border/50 mx-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Trust line */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
              <Shield className="w-4 h-4" />
              <span>{t('premium.securedByStripe')}</span>
            </div>
          </div>
        )}
        {activeTab === 'referral' && <ReferralPanel />}
      </div>
    </SwipeDismissOverlay>
  );
};

export default PremiumScreen;
