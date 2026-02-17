import { useState, useEffect, useCallback } from 'react';
import {
  rewardsService,
  type WalletTransaction,
  type TransactionFilters,
  type TransactionPeriodSummary,
  type TransactionSortField,
  type TransactionSortOrder,
} from '@/services/rewards.service';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT: { sortBy: TransactionSortField; sortOrder: TransactionSortOrder } = {
  sortBy: 'created_at',
  sortOrder: 'desc',
};

export interface UseTransactionsOptions {
  userId: string | undefined;
  filters?: TransactionFilters;
  sortBy?: TransactionSortField;
  sortOrder?: TransactionSortOrder;
  pageSize?: number;
  enabled?: boolean;
  subscribeRealtime?: boolean;
}

export interface UseTransactionsResult {
  transactions: WalletTransaction[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setFilters: (filters: TransactionFilters | undefined) => void;
  sortBy: TransactionSortField;
  sortOrder: TransactionSortOrder;
  setSort: (sortBy: TransactionSortField, sortOrder: TransactionSortOrder) => void;
  getTransactionById: (transactionId: string) => Promise<WalletTransaction | null>;
  summary: TransactionPeriodSummary | null;
  fetchSummary: (dateFrom: Date, dateTo: Date) => Promise<TransactionPeriodSummary>;
  periodSummary: TransactionPeriodSummary | null;
  fetchPeriodSummary: () => Promise<TransactionPeriodSummary | null>;
}

export function useTransactions({
  userId,
  filters: initialFilters,
  sortBy: initialSortBy = DEFAULT_SORT.sortBy,
  sortOrder: initialSortOrder = DEFAULT_SORT.sortOrder,
  pageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
  subscribeRealtime = true,
}: UseTransactionsOptions): UseTransactionsResult {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filters, setFiltersState] = useState<TransactionFilters | undefined>(initialFilters);
  const [sortBy, setSortByState] = useState<TransactionSortField>(initialSortBy);
  const [sortOrder, setSortOrderState] = useState<TransactionSortOrder>(initialSortOrder);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TransactionPeriodSummary | null>(null);
  const [periodSummary, setPeriodSummary] = useState<TransactionPeriodSummary | null>(null);

  const setSort = useCallback((by: TransactionSortField, order: TransactionSortOrder) => {
    setSortByState(by);
    setSortOrderState(order);
    setOffset(0);
  }, []);

  const fetchPage = useCallback(
    async (pageOffset: number, append = false) => {
      if (!userId || !enabled) return;

      const loadingState = pageOffset === 0 ? setIsLoading : setIsLoadingMore;
      loadingState(true);
      setError(null);

      try {
        const result = await rewardsService.getTransactions(userId, {
          limit: pageSize,
          offset: pageOffset,
          filters: filters ?? {},
          sortBy,
          sortOrder,
        });

        setTransactions((prev) => (append ? [...prev, ...result.transactions] : result.transactions));
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);
        setOffset(result.nextOffset);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load transactions';
        setError(msg);
        console.error('[useTransactions] Error:', err);
      } finally {
        loadingState(false);
      }
    },
    [userId, enabled, pageSize, filters, sortBy, sortOrder]
  );

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isLoadingMore) return;
    await fetchPage(offset, true);
  }, [hasMore, isLoading, isLoadingMore, offset, fetchPage]);

  const setFilters = useCallback((f: TransactionFilters | undefined) => {
    setFiltersState(f);
    setOffset(0);
  }, []);

  const fetchSummary = useCallback(
    async (dateFrom: Date, dateTo: Date): Promise<TransactionPeriodSummary> => {
      if (!userId) {
        return {
          earnedVicoin: 0,
          earnedIcoin: 0,
          spentVicoin: 0,
          spentIcoin: 0,
          receivedVicoin: 0,
          receivedIcoin: 0,
          sentVicoin: 0,
          sentIcoin: 0,
          withdrawnVicoin: 0,
          withdrawnIcoin: 0,
          count: 0,
        };
      }
      const s = await rewardsService.getTransactionSummary(userId, dateFrom, dateTo);
      setSummary(s);
      return s;
    },
    [userId]
  );

  const getTransactionById = useCallback(
    async (transactionId: string): Promise<WalletTransaction | null> => {
      if (!userId) return null;
      return rewardsService.getTransactionById(userId, transactionId);
    },
    [userId]
  );

  /** Fetch period summary for the current filter date range (if any). */
  const fetchPeriodSummary = useCallback(async (): Promise<TransactionPeriodSummary | null> => {
    if (!userId || !filters?.dateFrom || !filters?.dateTo) {
      setPeriodSummary(null);
      return null;
    }
    const s = await rewardsService.getTransactionSummary(userId, filters.dateFrom, filters.dateTo);
    setPeriodSummary(s);
    return s;
  }, [userId, filters?.dateFrom, filters?.dateTo]);

  // Sync filters from parent when initialFilters (e.g. WalletScreen filter controls) changes
  const initialFilterKey =
    initialFilters == null
      ? 'none'
      : `${initialFilters.type ?? ''}-${initialFilters.coinType ?? ''}-${initialFilters.search ?? ''}-${initialFilters.dateFrom?.toISOString() ?? ''}-${initialFilters.dateTo?.toISOString() ?? ''}`;
  useEffect(() => {
    setFiltersState(initialFilters);
    setOffset(0);
  }, [initialFilterKey]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: sync when filter content changes

  // Initial load and filter/sort changes
  const filterKey = filters
    ? `${filters.type ?? ''}-${filters.coinType ?? ''}-${filters.search ?? ''}-${filters.dateFrom?.toISOString() ?? ''}-${filters.dateTo?.toISOString() ?? ''}-${filters.amountMin ?? ''}-${filters.amountMax ?? ''}`
    : 'none';
  const sortKey = `${sortBy}-${sortOrder}`;
  useEffect(() => {
    if (!userId || !enabled) {
      setTransactions([]);
      setTotalCount(0);
      setHasMore(false);
      setOffset(0);
      return;
    }
    fetchPage(0, false);
  }, [userId, enabled, filterKey, sortKey, fetchPage]);

  // Fetch period summary when filters include a date range
  useEffect(() => {
    if (!userId || !enabled || !filters?.dateFrom || !filters?.dateTo) {
      setPeriodSummary(null);
      return;
    }
    let cancelled = false;
    rewardsService.getTransactionSummary(userId, filters.dateFrom, filters.dateTo).then((s) => {
      if (!cancelled) setPeriodSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, enabled, filters?.dateFrom?.toISOString(), filters?.dateTo?.toISOString()]);

  // Real-time subscription
  useEffect(() => {
    if (!userId || !enabled || !subscribeRealtime) return;

    const channel = rewardsService.subscribeToTransactions(
      userId,
      (newTx) => {
        setTransactions((prev) => [newTx, ...prev]);
        setTotalCount((c) => c + 1);
      },
      (err) => console.warn('[useTransactions] Realtime error:', err)
    );

    return () => {
      channel.unsubscribe();
    };
  }, [userId, enabled, subscribeRealtime]);

  return {
    transactions,
    totalCount,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    loadMore,
    setFilters,
    sortBy,
    sortOrder,
    setSort,
    getTransactionById,
    summary,
    fetchSummary,
    periodSummary,
    fetchPeriodSummary,
  };
}
