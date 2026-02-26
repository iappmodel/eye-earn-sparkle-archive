/**
 * usePromoEarnings – tracks per-promotion earning actions, completion state,
 * and issues rewards through the rewards service.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { rewardsService } from '@/services/rewards.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EarningAction {
  id: string;
  label: string;
  description: string;
  coinReward: number;
  coinType: 'vicoin' | 'icoin' | 'both';
  required: boolean;
  completed: boolean;
}

export interface PromoEarningsState {
  actions: EarningAction[];
  totalEarned: number;
  totalPossible: number;
  streakBonus: number;
  allRequiredDone: boolean;
  allDone: boolean;
}

export interface PromoActionCompleteResult {
  completed: boolean;
  rewarded: boolean;
  rewardErrorCode?: string;
  rewardError?: string;
}

// ---------------------------------------------------------------------------
// Default earning actions for a promotion
// ---------------------------------------------------------------------------

export const DEFAULT_EARNING_ACTIONS: Omit<EarningAction, 'completed'>[] = [
  {
    id: 'checkin',
    label: 'Check in at location',
    description: 'Arrive at the store and verify your presence via GPS.',
    coinReward: 50,
    coinType: 'vicoin',
    required: true,
  },
  {
    id: 'qr_scan',
    label: 'Scan QR code',
    description: 'Scan the QR code displayed at the counter or entrance.',
    coinReward: 50,
    coinType: 'icoin',
    required: false,
  },
  {
    id: 'watch_promo',
    label: 'Watch 30-second promo',
    description: 'Watch the store\u2019s 30-second promotional video.',
    coinReward: 100,
    coinType: 'vicoin',
    required: false,
  },
  {
    id: 'leave_review',
    label: 'Leave a rating',
    description: 'Rate your experience at this location.',
    coinReward: 50,
    coinType: 'icoin',
    required: false,
  },
  {
    id: 'share_social',
    label: 'Share on social media',
    description: 'Share a photo or post with the store\u2019s hashtag.',
    coinReward: 25,
    coinType: 'vicoin',
    required: false,
  },
  {
    id: 'return_visit',
    label: 'Return within 7 days',
    description: 'Visit again within 7 days for a bonus reward.',
    coinReward: 75,
    coinType: 'vicoin',
    required: false,
  },
];

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'promo_earnings_';
const REWARDED_STORAGE_PREFIX = 'promo_earnings_rewarded_';
const SERVER_VERIFIED_REWARDABLE_ACTIONS = new Set(['checkin', 'watch_promo', 'leave_review', 'return_visit']);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function loadCompleted(promotionId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${promotionId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr as string[]);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveCompleted(promotionId: string, ids: Set<string>) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${promotionId}`, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

function loadRewarded(promotionId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${REWARDED_STORAGE_PREFIX}${promotionId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr as string[]);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveRewarded(promotionId: string, ids: Set<string>) {
  try {
    localStorage.setItem(`${REWARDED_STORAGE_PREFIX}${promotionId}`, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Streak bonus helper (mirrors CheckInStreak logic)
// ---------------------------------------------------------------------------

const STREAK_TIERS = [
  { days: 30, bonus: 50 },
  { days: 14, bonus: 35 },
  { days: 7, bonus: 25 },
  { days: 5, bonus: 15 },
  { days: 3, bonus: 10 },
  { days: 2, bonus: 5 },
];

function getStreakBonusPercent(streakDays: number): number {
  for (const tier of STREAK_TIERS) {
    if (streakDays >= tier.days) return tier.bonus;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UsePromoEarningsOptions {
  promotionId: string;
  /** Override which actions to offer (defaults to DEFAULT_EARNING_ACTIONS) */
  actionOverrides?: Omit<EarningAction, 'completed'>[];
  /** Current check-in streak in days */
  streakDays?: number;
}

export function usePromoEarnings(options: UsePromoEarningsOptions) {
  const { promotionId, actionOverrides, streakDays = 0 } = options;

  const template = actionOverrides ?? DEFAULT_EARNING_ACTIONS;

  const [completedIds, setCompletedIds] = useState<Set<string>>(() =>
    loadCompleted(promotionId),
  );
  const [rewardedIds, setRewardedIds] = useState<Set<string>>(() =>
    loadRewarded(promotionId),
  );

  useEffect(() => {
    setCompletedIds(loadCompleted(promotionId));
    setRewardedIds(loadRewarded(promotionId));
  }, [promotionId]);

  // Persist whenever completed set changes
  useEffect(() => {
    saveCompleted(promotionId, completedIds);
  }, [promotionId, completedIds]);

  useEffect(() => {
    saveRewarded(promotionId, rewardedIds);
  }, [promotionId, rewardedIds]);

  // Build full action list with completion state
  const actions: EarningAction[] = useMemo(
    () => template.map((a) => ({ ...a, completed: completedIds.has(a.id) })),
    [template, completedIds],
  );

  const totalPossible = useMemo(() => template.reduce((s, a) => s + a.coinReward, 0), [template]);
  const totalEarned = useMemo(
    () => actions.filter((a) => rewardedIds.has(a.id)).reduce((s, a) => s + a.coinReward, 0),
    [actions, rewardedIds],
  );

  const streakBonus = useMemo(() => {
    const pct = getStreakBonusPercent(streakDays);
    return Math.round(totalEarned * (pct / 100));
  }, [totalEarned, streakDays]);

  const allRequiredDone = useMemo(
    () => actions.filter((a) => a.required).every((a) => a.completed),
    [actions],
  );

  const allDone = useMemo(() => actions.every((a) => a.completed), [actions]);

  // ----------------------------------------------------------
  // Complete an action + issue the reward
  // ----------------------------------------------------------
  const completeAction = useCallback(
    async (actionId: string): Promise<PromoActionCompleteResult> => {
      const action = template.find((a) => a.id === actionId);
      if (!action) return { completed: false, rewarded: false, rewardErrorCode: 'action_not_found', rewardError: 'Action not found' };
      if (completedIds.has(actionId)) {
        const canRetryVerifiedReward =
          isUuid(promotionId) &&
          SERVER_VERIFIED_REWARDABLE_ACTIONS.has(actionId) &&
          !rewardedIds.has(actionId);
        if (canRetryVerifiedReward) {
          // Allow retries until the backend confirms and rewards the action.
        } else {
          return { completed: true, rewarded: rewardedIds.has(actionId) };
        }
      }

      let rewardGranted = false;
      let rewardErrorCode: string | undefined;
      let rewardError: string | undefined;

      if (isUuid(promotionId) && SERVER_VERIFIED_REWARDABLE_ACTIONS.has(actionId)) {
        const baseContentId = `promo_action:${promotionId}:${actionId}`;
        try {
          const primary = await rewardsService.issueReward('promo_action_complete', baseContentId);
          if (primary.success) {
            rewardGranted = true;
          } else {
            rewardErrorCode = primary.code;
            rewardError = primary.error;
          }

          if (rewardGranted && action.coinType === 'both') {
            const secondary = await rewardsService.issueReward('promo_action_complete', `${baseContentId}:secondary`);
            if (!secondary.success) {
              rewardErrorCode = secondary.code;
              rewardError = secondary.error;
            }
          }
        } catch (err) {
          console.warn('[PromoEarnings] Verified reward issue failed:', err);
          rewardError = err instanceof Error ? err.message : 'Failed to issue reward';
        }
      } else {
        rewardErrorCode = 'action_not_supported';
        rewardError = 'Reward pending verified backend integration for this action';
        console.warn('[PromoEarnings] Action completed without server-verifiable reward:', { promotionId, actionId });
      }

      if (rewardGranted) {
        // Dispatch wallet update event so WalletScreen refreshes
        window.dispatchEvent(new CustomEvent('walletBalanceChanged'));
        setRewardedIds((prev) => {
          const next = new Set(prev);
          next.add(actionId);
          return next;
        });
      }

      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.add(actionId);
        return next;
      });

      return { completed: true, rewarded: rewardGranted, rewardErrorCode, rewardError };
    },
    [completedIds, rewardedIds, promotionId, template],
  );

  // Reset (useful for testing)
  const reset = useCallback(() => {
    setCompletedIds(new Set());
    setRewardedIds(new Set());
    localStorage.removeItem(`${STORAGE_PREFIX}${promotionId}`);
    localStorage.removeItem(`${REWARDED_STORAGE_PREFIX}${promotionId}`);
  }, [promotionId]);

  return {
    actions,
    totalEarned,
    totalPossible,
    streakBonus,
    allRequiredDone,
    allDone,
    completeAction,
    reset,
  } satisfies PromoEarningsState & {
    completeAction: (id: string) => Promise<PromoActionCompleteResult>;
    reset: () => void;
  };
}
