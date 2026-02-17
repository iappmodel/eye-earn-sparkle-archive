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

  // Persist whenever completed set changes
  useEffect(() => {
    saveCompleted(promotionId, completedIds);
  }, [promotionId, completedIds]);

  // Build full action list with completion state
  const actions: EarningAction[] = useMemo(
    () => template.map((a) => ({ ...a, completed: completedIds.has(a.id) })),
    [template, completedIds],
  );

  const totalPossible = useMemo(() => template.reduce((s, a) => s + a.coinReward, 0), [template]);
  const totalEarned = useMemo(
    () => actions.filter((a) => a.completed).reduce((s, a) => s + a.coinReward, 0),
    [actions],
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
    async (actionId: string) => {
      const action = template.find((a) => a.id === actionId);
      if (!action) return;
      if (completedIds.has(actionId)) return; // already done

      // Unique contentId per action so each action can be rewarded once (reward_logs dedupes by user_id, content_id, reward_type)
      const baseContentId = `${promotionId}:${actionId}`;

      // Issue reward through rewards service (best-effort)
      try {
        const coinType = action.coinType === 'both' ? 'vicoin' : action.coinType;
        await rewardsService.issueReward('task_complete', baseContentId, {
          amount: action.coinReward,
          coinType,
        });

        // If "both", issue second coin type with distinct contentId so both rewards are granted
        if (action.coinType === 'both') {
          await rewardsService.issueReward('task_complete', `${baseContentId}:icoin`, {
            amount: action.coinReward,
            coinType: 'icoin',
          });
        }
      } catch (err) {
        console.warn('[PromoEarnings] Reward issue failed (offline?):', err);
      }

      // Dispatch wallet update event so WalletScreen refreshes
      window.dispatchEvent(new CustomEvent('walletBalanceChanged'));

      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.add(actionId);
        return next;
      });
    },
    [completedIds, promotionId, template],
  );

  // Reset (useful for testing)
  const reset = useCallback(() => {
    setCompletedIds(new Set());
    localStorage.removeItem(`${STORAGE_PREFIX}${promotionId}`);
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
    completeAction: (id: string) => Promise<void>;
    reset: () => void;
  };
}
