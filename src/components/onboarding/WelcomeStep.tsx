// Welcome Step Component
import React from 'react';
import { Sparkles, Shield, Coins, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  userName: string;
  onContinue: () => void;
  onSkip: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({
  userName,
  onContinue,
  onSkip,
}) => {
  const benefits = [
    {
      icon: <Coins className="w-6 h-6 text-yellow-500" />,
      title: 'Earn Real Rewards',
      description: 'Get paid for watching content and engaging with brands',
    },
    {
      icon: <Shield className="w-6 h-6 text-green-500" />,
      title: 'Verified Account',
      description: 'Unlock higher earning limits and exclusive campaigns',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-purple-500" />,
      title: 'Premium Features',
      description: 'Access creator tools and priority payouts',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full text-center">
      {/* Hero */}
      <div className="mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-6 mx-auto">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome, {userName}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Let's get you verified to unlock all features
        </p>
      </div>

      {/* Benefits */}
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
              <h3 className="font-semibold mb-1">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">
                {benefit.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={onContinue}
          className="w-full h-14 text-lg font-semibold rounded-2xl"
          size="lg"
        >
          Get Verified
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <button
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};
