// Hook to manage onboarding state
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useOnboarding() {
  const { user, profile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string>('pending');

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
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

        // Show onboarding if KYC is not approved and hasn't been dismissed
        const dismissed = localStorage.getItem(`onboarding_dismissed_${user.id}`);
        if (status !== 'approved' && !dismissed) {
          // Check if this is a new user (created in the last hour)
          const createdAt = new Date(user.created_at);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          
          if (createdAt > hourAgo) {
            setShowOnboarding(true);
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
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
    // Don't set dismissed - user can access it again from profile
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
