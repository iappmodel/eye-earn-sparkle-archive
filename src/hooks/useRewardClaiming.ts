import { useState, useCallback } from 'react';
import {
  rewardsService,
  type IssueRewardResponse,
  type CoinType,
  type RewardType,
} from '@/services/rewards.service';

export interface ClaimRewardOptions {
  attentionScore?: number;
  coinType?: CoinType;
  watchDuration?: number;
  totalDuration?: number;
  amount?: number;
}

export interface UseRewardClaimingReturn {
  /** Claim a promo view reward - returns result, handles loading/error internally */
  claimReward: (
    rewardType: RewardType,
    contentId: string,
    options?: ClaimRewardOptions
  ) => Promise<IssueRewardResponse>;
  isClaiming: boolean;
  lastError: string | null;
  dailyRemaining: IssueRewardResponse['dailyRemaining'] | null;
  clearError: () => void;
}

/**
 * Centralized hook for reward claiming with loading state, error handling,
 * and optional daily limits display. Use across MediaCard, PromoVideosFeed, etc.
 */
export function useRewardClaiming(
  onSuccess?: (amount: number, coinType: CoinType) => void,
  onError?: (error: string) => void
): UseRewardClaimingReturn {
  const [isClaiming, setIsClaiming] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [dailyRemaining, setDailyRemaining] = useState<IssueRewardResponse['dailyRemaining'] | null>(null);

  const claimReward = useCallback(
    async (
      rewardType: RewardType,
      contentId: string,
      options?: ClaimRewardOptions
    ): Promise<IssueRewardResponse> => {
      setIsClaiming(true);
      setLastError(null);
      try {
        const result = await rewardsService.issueReward(rewardType, contentId, {
          amount: options?.amount,
          attentionScore: options?.attentionScore,
          coinType: options?.coinType,
          watchDuration: options?.watchDuration,
          totalDuration: options?.totalDuration,
        });

        if (result.success && result.amount) {
          setDailyRemaining(result.dailyRemaining ?? null);
          onSuccess?.(result.amount, result.coinType ?? 'icoin');
        } else if (result.error) {
          setLastError(result.error);
          onError?.(result.error);
        }
        return result;
      } catch (err) {
        const message = (err as Error)?.message || 'Failed to claim reward';
        setLastError(message);
        onError?.(message);
        return { success: false, error: message };
      } finally {
        setIsClaiming(false);
      }
    },
    [onSuccess, onError]
  );

  const clearError = useCallback(() => setLastError(null), []);

  return {
    claimReward,
    isClaiming,
    lastError,
    dailyRemaining,
    clearError,
  };
}
