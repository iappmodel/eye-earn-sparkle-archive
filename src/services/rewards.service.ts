// Rewards Service for Managing User Earnings & Transactions
import { supabase } from '@/integrations/supabase/client';
import type { Reward, Transaction, Campaign } from '@/types/app.types';

class RewardsService {
  // Get user's pending rewards (will be implemented when rewards table exists)
  async getPendingRewards(userId: string): Promise<Reward[]> {
    try {
      // This will work once the rewards table is created
      console.log('[Rewards] Getting pending rewards for:', userId);
      return [];
    } catch (error) {
      console.error('[Rewards] Get pending error:', error);
      return [];
    }
  }

  // Claim a reward
  async claimReward(rewardId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('claim-reward', {
        body: { rewardId },
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('[Rewards] Claim error:', error);
      return { success: false, error: 'Failed to claim reward' };
    }
  }

  // Get user's transaction history (will be implemented when transactions table exists)
  async getTransactionHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<Transaction[]> {
    try {
      console.log('[Rewards] Getting transactions for:', userId);
      return [];
    } catch (error) {
      console.error('[Rewards] Get transactions error:', error);
      return [];
    }
  }

  // Get active campaigns near user
  async getNearbyCampaigns(
    latitude: number,
    longitude: number,
    radiusKm = 10
  ): Promise<Campaign[]> {
    try {
      const { data, error } = await supabase.functions.invoke('get-nearby-campaigns', {
        body: { latitude, longitude, radiusKm },
      });

      if (error) throw error;
      return data?.campaigns || [];
    } catch (error) {
      console.error('[Rewards] Get nearby campaigns error:', error);
      return [];
    }
  }

  // Record a view for earning rewards
  async recordView(
    userId: string,
    contentId: string,
    watchDuration: number
  ): Promise<{ earned: boolean; amount?: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('record-view', {
        body: { userId, contentId, watchDuration },
      });

      if (error) throw error;
      return data || { earned: false };
    } catch (error) {
      console.error('[Rewards] Record view error:', error);
      return { earned: false };
    }
  }

  // Initiate withdrawal
  async initiateWithdrawal(
    userId: string,
    amount: number,
    coinType: 'vicoin' | 'icoin',
    method: 'bank' | 'crypto' | 'paypal'
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('initiate-withdrawal', {
        body: { userId, amount, coinType, method },
      });

      if (error) throw error;
      return { success: true, transactionId: data?.transactionId };
    } catch (error) {
      console.error('[Rewards] Withdrawal error:', error);
      return { success: false, error: 'Failed to initiate withdrawal' };
    }
  }

  // Get user's balance summary
  async getBalanceSummary(userId: string): Promise<{
    vicoin: number;
    icoin: number;
    pending_vicoin: number;
    pending_icoin: number;
    total_earned: number;
    total_withdrawn: number;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('get-balance-summary', {
        body: { userId },
      });

      if (error) throw error;
      return (
        data || {
          vicoin: 0,
          icoin: 0,
          pending_vicoin: 0,
          pending_icoin: 0,
          total_earned: 0,
          total_withdrawn: 0,
        }
      );
    } catch (error) {
      console.error('[Rewards] Balance summary error:', error);
      return {
        vicoin: 0,
        icoin: 0,
        pending_vicoin: 0,
        pending_icoin: 0,
        total_earned: 0,
        total_withdrawn: 0,
      };
    }
  }
}

export const rewardsService = new RewardsService();
