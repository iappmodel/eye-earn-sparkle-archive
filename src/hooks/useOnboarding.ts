// Hook to manage onboarding state
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const { user, profile } = useAuth();

  // Onboarding is a blocking, full-screen overlay, so default must be CLOSED.
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string>('pending');

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setShowOnboarding(false);
        setIsLoading(false);
        return;
      }

      try {
        // Check if user has completed KYC
        const { data: kycData } = await supabase
          .from('kyc_submissions')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        const status = kycData?.status || profile?.kyc_status || 'pending';
        setKycStatus(status);

        const dismissed = localStorage.getItem(`onboarding_dismissed_${user.id}`);

        // Only show onboarding for brand-new users who still need verification
        let shouldShow = false;
        if (status !== 'approved' && !dismissed) {
          const createdAt = new Date(user.created_at);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          shouldShow = createdAt > hourAgo;
        }

        setShowOnboarding(shouldShow);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Fail closed so we never block the app
        setShowOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, profile]);

  const openOnboarding = () => setShowOnboarding(true);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    if (user) {
      localStorage.setItem(`onboarding_dismissed_${user.id}`, 'true');
    }
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
    // Treat completion as dismissal to prevent blocking on refresh.
    if (user) {
      localStorage.setItem(`onboarding_dismissed_${user.id}`, 'true');
    }
  };

  return {
    showOnboarding,
    openOnboarding,
    closeOnboarding,
    completeOnboarding,
    isLoading,
    kycStatus,
    needsVerification: kycStatus !== 'approved',
  };
}
