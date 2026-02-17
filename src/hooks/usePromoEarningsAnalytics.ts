/**
 * usePromoEarningsAnalytics – fetches and caches comprehensive promo earnings
 * from reward_logs + promotion_checkins for the wallet Promo Earnings section.
 */
import { useState, useEffect, useCallback } from 'react';
import { rewardsService, type PromoEarningsItem } from '@/services/rewards.service';

export type PromoEarningsPeriod = 'today' | '7d' | '30d';

export interface PromoEarningsAnalytics {
  totalVicoin: number;
  totalIcoin: number;
  totalCoins: number;
  bySource: { checkin: number; promoView: number; taskComplete: number };
  byPeriod: { today: number; week: number; month: number };
  locations: { name: string; amount: number; count: number; coinType: string }[];
  items: PromoEarningsItem[];
  periodComparison?: { change: number; trend: 'up' | 'down' | 'same' };
}

const DEFAULT_ANALYTICS: PromoEarningsAnalytics = {
  totalVicoin: 0,
  totalIcoin: 0,
  totalCoins: 0,
  bySource: { checkin: 0, promoView: 0, taskComplete: 0 },
  byPeriod: { today: 0, week: 0, month: 0 },
  locations: [],
  items: [],
};

export function usePromoEarningsAnalytics(userId: string | undefined) {
  const [data, setData] = useState<PromoEarningsAnalytics>(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData(DEFAULT_ANALYTICS);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await rewardsService.getPromoEarnings(userId, {
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // ~60 days back
        endDate: new Date(),
        limit: 200,
      });
      setData(result);
    } catch (err) {
      console.error('[usePromoEarningsAnalytics] Error:', err);
      setError((err as Error)?.message || 'Failed to load promo earnings');
      setData(DEFAULT_ANALYTICS);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for wallet balance changes (e.g. after check-in or promo view)
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('walletBalanceChanged', handler);
    return () => window.removeEventListener('walletBalanceChanged', handler);
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
