import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface ReferralCode {
  code: string;
  usesCount: number;
  totalEarnings: number;
}

export interface Referral {
  id: string;
  referred_id: string;
  status: string;
  earnings_shared: number;
  created_at: string;
  expires_at: string | null;
}

export function useReferral() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReferralCode = useCallback(async () => {
    if (!user) {
      setReferralCode(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-referral', {
        body: { action: 'get_or_create' },
      });

      if (error) throw error;

      setReferralCode({
        code: data.code,
        usesCount: data.uses_count,
        totalEarnings: data.total_earnings,
      });
    } catch (error) {
      console.error('Failed to fetch referral code:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchReferrals = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-referral', {
        body: { action: 'get_referrals' },
      });

      if (error) throw error;

      setReferrals(data.referrals || []);
      setTotalReferrals(data.total_referrals || 0);
      setTotalEarnings(data.total_earnings || 0);
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchReferralCode();
    fetchReferrals();
  }, [fetchReferralCode, fetchReferrals]);

  const applyReferralCode = async (code: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to use a referral code',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-referral', {
        body: { action: 'apply', referral_code: code },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Success!',
          description: data.message,
        });
        return true;
      } else {
        toast({
          title: 'Could not apply code',
          description: data.message,
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Failed to apply referral code:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply referral code',
        variant: 'destructive',
      });
      return false;
    }
  };

  const copyReferralLink = () => {
    if (!referralCode) return;
    
    const link = `${window.location.origin}/auth?ref=${referralCode.code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Copied!',
      description: 'Referral link copied to clipboard',
    });
  };

  const shareReferralLink = async () => {
    if (!referralCode) return;
    
    const link = `${window.location.origin}/auth?ref=${referralCode.code}`;
    const text = `Join me on [i] App and earn rewards! Use my referral code: ${referralCode.code}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join [i] App', text, url: link });
      } catch {
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  return {
    referralCode,
    referrals,
    totalReferrals,
    totalEarnings,
    isLoading,
    applyReferralCode,
    copyReferralLink,
    shareReferralLink,
    refresh: () => {
      fetchReferralCode();
      fetchReferrals();
    },
  };
}
