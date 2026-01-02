// Hook to manage onboarding state (TEMPORARILY DISABLED)
import { useState } from 'react';

export function useOnboarding() {
  // TEMPORARILY DISABLED - always return false to skip onboarding and go straight to feed
  const [showOnboarding] = useState(false);
  const [isLoading] = useState(false);
  const [kycStatus] = useState<string>('none');

  const openOnboarding = () => {
    // Disabled - do nothing
  };

  const closeOnboarding = () => {
    // Disabled - do nothing
  };

  const completeOnboarding = () => {
    // Disabled - do nothing
  };

  return {
    showOnboarding,
    openOnboarding,
    closeOnboarding,
    completeOnboarding,
    isLoading,
    kycStatus,
    needsVerification: false,
  };
}
