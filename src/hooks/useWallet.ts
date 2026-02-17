/**
 * useWallet – Single source of truth for wallet balance and summary.
 * Reads vicoin/icoin from profile (AuthContext), fetches balance summary
 * (total earned, withdrawn) and exposes refresh for Wallet and other consumers.
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService } from '@/services/rewards.service';

export interface WalletBalanceSummary {
  vicoin: number;
  icoin: number;
  pending_vicoin: number;
  pending_icoin: number;
  total_earned: number;
  total_withdrawn: number;
}

export interface UseWalletReturn {
  /** From profile (AuthContext) – always in sync with app */
  vicoins: number;
  icoins: number;
  /** Fetched summary: total earned/withdrawn, pending */
  summary: WalletBalanceSummary | null;
  /** Whether summary is currently loading */
  summaryLoading: boolean;
  /** Refresh profile (balance) and optionally summary */
  refresh: (options?: { includeSummary?: boolean }) => Promise<void>;
  /** True if user is logged in and profile has been loaded */
  isReady: boolean;
}

export function useWallet(): UseWalletReturn {
  const { user, profile, refreshProfile } = useAuth();
  const [summary, setSummary] = useState<WalletBalanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const vicoins = profile?.vicoin_balance ?? 0;
  const icoins = profile?.icoin_balance ?? 0;
  const isReady = !!user && profile !== undefined;

  const refresh = useCallback(
    async (options?: { includeSummary?: boolean }) => {
      await refreshProfile();
      if (options?.includeSummary !== false && user?.id) {
        setSummaryLoading(true);
        try {
          const s = await rewardsService.getBalanceSummary(user.id);
          setSummary(s);
        } catch (e) {
          console.error('[useWallet] getBalanceSummary error:', e);
        } finally {
          setSummaryLoading(false);
        }
      }
    },
    [user?.id, refreshProfile]
  );

  useEffect(() => {
    if (user?.id) {
      setSummaryLoading(true);
      rewardsService
        .getBalanceSummary(user.id)
        .then(setSummary)
        .catch((e) => console.error('[useWallet] getBalanceSummary error:', e))
        .finally(() => setSummaryLoading(false));
    } else {
      setSummary(null);
    }
  }, [user?.id]);

  return {
    vicoins,
    icoins,
    summary,
    summaryLoading,
    refresh,
    isReady,
  };
}
