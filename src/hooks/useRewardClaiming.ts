import { useState, useCallback } from 'react';
import {
  rewardsService,
  type IssueRewardResponse,
  type CoinType,
  type RewardType,
} from '@/services/rewards.service';

/** Options for claiming; amount/currency are server-computed and never sent. */
export interface ClaimRewardOptions {
  attentionScore?: number;
  watchDuration?: number;
  totalDuration?: number;
  /** Required for promo_view: from validate-attention. */
  attentionSessionId?: string;
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
          attentionScore: options?.attentionScore,
          watchDuration: options?.watchDuration,
          totalDuration: options?.totalDuration,
          attentionSessionId: options?.attentionSessionId,
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
