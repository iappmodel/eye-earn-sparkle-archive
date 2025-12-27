// Rewards Service for Managing User Earnings & Transactions
import { supabase } from '@/integrations/supabase/client';
import type { Reward, Campaign } from '@/types/app.types';

// Local transaction type for wallet display
export interface WalletTransaction {
  id: string;
  type: 'earned' | 'spent' | 'received' | 'sent' | 'withdrawn';
  amount: number;
  coinType: 'vicoin' | 'icoin';
  description: string;
  timestamp: Date;
}

// Reward types
export type RewardType = 'promo_view' | 'task_complete' | 'referral' | 'milestone' | 'daily_bonus';
export type CoinType = 'vicoin' | 'icoin';

interface IssueRewardResponse {
  success: boolean;
  amount?: number;
  coinType?: CoinType;
  newBalance?: number;
  dailyRemaining?: {
    icoin: number;
    vicoin: number;
    promo_views: number;
  };
  error?: string;
}

interface DailyLimits {
  icoin_earned: number;
  vicoin_earned: number;
  promo_views: number;
  icoin_limit: number;
  vicoin_limit: number;
  promo_limit: number;
}

class RewardsService {
  // Issue a reward to the user
  async issueReward(
    rewardType: RewardType,
    contentId: string,
    options?: {
      amount?: number;
      attentionScore?: number;
      coinType?: CoinType;
    }
  ): Promise<IssueRewardResponse> {
    try {
      console.log('[Rewards] Issuing reward:', { rewardType, contentId, options });
      
      const { data, error } = await supabase.functions.invoke('issue-reward', {
        body: {
          rewardType,
          contentId,
          amount: options?.amount,
          attentionScore: options?.attentionScore,
          coinType: options?.coinType,
        },
      });

      if (error) {
        console.error('[Rewards] Issue error:', error);
        return { success: false, error: error.message };
      }

      console.log('[Rewards] Issue success:', data);
      return data;
    } catch (error) {
      console.error('[Rewards] Issue error:', error);
      return { success: false, error: 'Failed to issue reward' };
    }
  }

  // Get user's pending rewards
  async getPendingRewards(userId: string): Promise<Reward[]> {
    try {
      console.log('[Rewards] Getting pending rewards for:', userId);
      // Will be implemented when rewards queue table exists
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

  // Get user's transaction history
  async getTransactionHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<WalletTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Map database type to wallet display type
      const typeMap: Record<string, WalletTransaction['type']> = {
        earned: 'earned',
        spent: 'spent',
        received: 'received',
        sent: 'sent',
        withdrawn: 'withdrawn',
      };

      return (data || []).map((tx): WalletTransaction => ({
        id: tx.id,
        type: typeMap[tx.type] || 'earned',
        amount: tx.amount,
        coinType: tx.coin_type as 'vicoin' | 'icoin',
        description: tx.description,
        timestamp: new Date(tx.created_at),
      }));
    } catch (error) {
      console.error('[Rewards] Get transactions error:', error);
      return [];
    }
  }

  // Get daily limits status
  async getDailyLimits(userId: string): Promise<DailyLimits | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_reward_caps')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;

      return {
        icoin_earned: data?.icoin_earned || 0,
        vicoin_earned: data?.vicoin_earned || 0,
        promo_views: data?.promo_views || 0,
        icoin_limit: 100,
        vicoin_limit: 50,
        promo_limit: 20,
      };
    } catch (error) {
      console.error('[Rewards] Get daily limits error:', error);
      return null;
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
    watchDuration: number,
    attentionScore?: number
  ): Promise<{ earned: boolean; amount?: number; coinType?: CoinType }> {
    try {
      // Use the new issue-reward function
      const result = await this.issueReward('promo_view', contentId, {
        attentionScore,
      });

      return {
        earned: result.success,
        amount: result.amount,
        coinType: result.coinType,
      };
    } catch (error) {
      console.error('[Rewards] Record view error:', error);
      return { earned: false };
    }
  }

  // Initiate withdrawal
  async initiateWithdrawal(
    userId: string,
    amount: number,
    coinType: CoinType,
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
      // Get from profile directly
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('vicoin_balance, icoin_balance')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      // Get total earned from transactions
      const { data: earnedTx, error: earnedError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'earned');

      if (earnedError) throw earnedError;

      const totalEarned = (earnedTx || []).reduce((sum, tx) => sum + tx.amount, 0);

      // Get total withdrawn
      const { data: withdrawnTx, error: withdrawnError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('type', 'withdrawn');

      if (withdrawnError) throw withdrawnError;

      const totalWithdrawn = (withdrawnTx || []).reduce((sum, tx) => sum + tx.amount, 0);

      return {
        vicoin: profile?.vicoin_balance || 0,
        icoin: profile?.icoin_balance || 0,
        pending_vicoin: 0,
        pending_icoin: 0,
        total_earned: totalEarned,
        total_withdrawn: totalWithdrawn,
      };
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

  // Check if content was already rewarded (to prevent UI showing reward for already claimed content)
  async isContentRewarded(userId: string, contentId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('reward_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('[Rewards] Check rewarded error:', error);
      return false;
    }
  }
}

export const rewardsService = new RewardsService();
