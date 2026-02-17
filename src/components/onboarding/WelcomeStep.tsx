// Welcome Step Component – KYC intro with benefits and localized copy
import React from 'react';
import { Sparkles, Shield, Coins, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalization } from '@/contexts/LocalizationContext';

interface WelcomeStepProps {
  userName: string;
  onContinue: () => void;
  onSkip: () => void;
  /** When true, show "Continue where you left off" instead of only "Get Verified" */
  isResuming?: boolean;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({
  userName,
  onContinue,
  onSkip,
  isResuming = false,
}) => {
  const { t } = useLocalization();

  const benefits = [
    {
      icon: <Coins className="w-6 h-6 text-yellow-500" />,
      titleKey: 'onboarding.welcome.benefitEarn' as const,
      descKey: 'onboarding.welcome.benefitEarnDesc' as const,
    },
    {
      icon: <Shield className="w-6 h-6 text-green-500" />,
      titleKey: 'onboarding.welcome.benefitVerified' as const,
      descKey: 'onboarding.welcome.benefitVerifiedDesc' as const,
    },
    {
      icon: <Sparkles className="w-6 h-6 text-purple-500" />,
      titleKey: 'onboarding.welcome.benefitPremium' as const,
      descKey: 'onboarding.welcome.benefitPremiumDesc' as const,
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full text-center">
      <div className="mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-6 mx-auto">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">
          {t('onboarding.welcome.title', { name: userName || 'there' })}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('onboarding.welcome.subtitle')}
        </p>
        {isResuming && (
          <p className="text-sm text-primary mt-2 font-medium">
            {t('onboarding.welcome.continueWhereLeftOff')}
          </p>
        )}
      </div>

      <div className="w-full max-w-sm space-y-4 mb-8">
        {benefits.map((benefit, index) => (
          <div
            key={index}
            className="neu-card rounded-2xl p-4 flex items-start gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center flex-shrink-0">
              {benefit.icon}
            </div>
            <div>
              <h3 className="font-semibold mb-1">{t(benefit.titleKey)}</h3>
              <p className="text-sm text-muted-foreground">
                {t(benefit.descKey)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={onContinue}
          className="w-full h-14 text-lg font-semibold rounded-2xl"
          size="lg"
        >
          {t('onboarding.welcome.getVerified')}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <button
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('onboarding.welcome.skipForNow')}
        </button>
      </div>
    </div>
  );
};
