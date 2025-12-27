// Step Indicator Component for Onboarding
import React from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingStep } from './OnboardingFlow';

interface StepIndicatorProps {
  steps: OnboardingStep[];
  currentStep: number;
  onClose: () => void;
}

const stepLabels: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  selfie: 'Selfie',
  'id-upload': 'ID Upload',
  verification: 'Verify',
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between">
      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                index < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : index === currentStep
                  ? 'bg-primary/20 text-primary border-2 border-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {index < currentStep ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
