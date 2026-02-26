// Rewards Service for Managing User Earnings & Transactions
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Reward, Campaign } from '@/types/app.types';

// Promo earnings item for analytics
export interface PromoEarningsItem {
  id: string;
  source: 'checkin' | 'promo_view' | 'task_complete' | 'other';
  amount: number;
  coinType: 'vicoin' | 'icoin';
  label: string;
  timestamp: Date;
  promotionId?: string;
  metadata?: Record<string, unknown>;
}

// Local transaction type for wallet display
export interface WalletTransaction {
  id: string;
  type: 'earned' | 'spent' | 'received' | 'sent' | 'withdrawn';
  amount: number;
  coinType: 'vicoin' | 'icoin';
  description: string;
  timestamp: Date;
  referenceId: string | null;
}

// Transaction filters for getTransactions
export interface TransactionFilters {
  type?: WalletTransaction['type'] | WalletTransaction['type'][];
  coinType?: 'vicoin' | 'icoin';
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  /** Filter by minimum amount (inclusive) */
  amountMin?: number;
  /** Filter by maximum amount (inclusive) */
  amountMax?: number;
}

// Transaction sort options
export type TransactionSortField = 'created_at' | 'amount';
export type TransactionSortOrder = 'asc' | 'desc';

// Paginated response for getTransactions
export interface GetTransactionsResult {
  transactions: WalletTransaction[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
}

// Period summary for transaction stats
export interface TransactionPeriodSummary {
  earnedVicoin: number;
  earnedIcoin: number;
  spentVicoin: number;
  spentIcoin: number;
  receivedVicoin: number;
  receivedIcoin: number;
  sentVicoin: number;
  sentIcoin: number;
  withdrawnVicoin: number;
  withdrawnIcoin: number;
  count: number;
}

// Reward types — platform rewards VICOIN for login, usage, and engagement
export type RewardType =
  | 'promo_view'
  | 'promo_action_complete'
  | 'task_complete'
  | 'referral'
  | 'milestone'
  | 'daily_bonus'
  | 'login'
  | 'session_usage'
  | 'like'
  | 'share'
  | 'post'
  | 'save'
  | 'comment';
export type CoinType = 'vicoin' | 'icoin';

export interface IssueRewardResponse {
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
  code?: string;
}

/** Options for issueReward. Amount and currency are never sent — server computes them (promo from DB + session). */
export interface IssueRewardOptions {
  attentionScore?: number;
  watchDuration?: number;
  totalDuration?: number;
  /** Required for promo_view: attention session id from validate-attention. Single-use: each session id can be redeemed only once. */
  attentionSessionId?: string;
}

// Transfer/convert coins between Vicoin and Icoin
export type TransferCoinsDirection = 'icoin_to_vicoin' | 'vicoin_to_icoin';

export interface TransferCoinsLimits {
  min: number;
  max: number;
  sourceCurrency: 'icoin' | 'vicoin';
  targetCurrency: 'vicoin' | 'icoin';
}

export interface TransferCoinsResponse {
  success: true;
  direction: TransferCoinsDirection;
  source_spent: number;
  target_received: number;
  new_icoin_balance: number;
  new_vicoin_balance: number;
  exchange_rate: number;
  transfer_id?: string;
}

export interface TransferCoinsErrorResponse {
  success: false;
  error: string;
  code?: 'INSUFFICIENT_BALANCE' | 'PROFILE_NOT_FOUND';
  details?: Record<string, string[]>;
  limits?: TransferCoinsLimits;
}

const DEFAULT_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 800;

interface DailyLimits {
  icoin_earned: number;
  vicoin_earned: number;
  promo_views: number;
  icoin_limit: number;
  vicoin_limit: number;
  promo_limit: number;
}

class RewardsService {
  // Issue a reward to the user with optional retry on transient failures
  async issueReward(
    rewardType: RewardType,
    contentId: string,
    options?: IssueRewardOptions
  ): Promise<IssueRewardResponse> {
    const attempt = async (attemptNum: number): Promise<IssueRewardResponse> => {
      try {
        if (attemptNum > 0) {
          logger.log(`[Rewards] Retry attempt ${attemptNum} for ${contentId}`);
        } else {
          logger.log('[Rewards] Issuing reward:', { rewardType, contentId, options });
        }
        
        const isPromoView = rewardType === 'promo_view';
        const body = isPromoView && options?.attentionSessionId
          ? { rewardType: 'promo_view' as const, attentionSessionId: options.attentionSessionId, mediaId: contentId }
          : { rewardType, contentId };

        const { data, error } = await supabase.functions.invoke('issue-reward', {
          body,
        });

        // Handle edge function errors - parse the response body when available
        if (error) {
          logger.log('[Rewards] Issue response:', { data, error });

          // supabase-js returns FunctionsHttpError with `context` as a Response object.
          const ctx = (error as any)?.context;
          let parsedError: string | undefined;
          let parsedCode: string | undefined;
          if (ctx && typeof ctx === 'object' && typeof (ctx as Response).json === 'function') {
            try {
              const parsed = await (ctx as Response).clone().json().catch(() => null);
              parsedError = parsed?.error || parsed?.message;
              parsedCode = parsed?.code;
            } catch { /* ignore */ }
          }
          const message = typeof parsedError === 'string' && parsedError.length > 0
            ? parsedError
            : (error as Error)?.message || 'Failed to issue reward';
          return { success: false, error: message, code: parsedCode };
        }

        // Check if response indicates failure - do not retry these
        if (data && !data.success) {
          logger.log('[Rewards] Issue failed:', data);
          const code = data.code || '';
          if (code === 'reward_already_claimed' || code === 'invalid_session' || (data.error && (
            data.error.includes('already claimed') ||
            data.error.includes('Daily limit') ||
            data.error.includes('promo view limit') ||
            data.error.includes('attention session')
          ))) {
            return { success: false, error: data.error || 'Reward not issued', code };
          }
          return { success: false, error: data.error || 'Reward not issued', code };
        }

        logger.log('[Rewards] Issue success:', data);
        return data || { success: false, error: 'No response data' };
      } catch (err) {
        logger.error('[Rewards] Issue error:', err);
        throw err; // Re-throw for retry logic
      }
    };

    try {
      let lastResult: IssueRewardResponse = { success: false, error: 'Unknown error' };
      for (let i = 0; i <= DEFAULT_RETRY_ATTEMPTS; i++) {
        try {
          const result = await attempt(i);
          if (result.success) return result;
          // Don't retry on user/business logic failures
          if (result.code === 'reward_already_claimed' || result.code === 'invalid_session' ||
              result.code === 'action_not_supported' || result.code === 'action_not_found' || result.code === 'requirement_not_met' ||
              result.code === 'self_interaction_not_rewardable' || result.code === 'invalid_content_id' || result.code === 'invalid_reward_type' ||
              result.error?.includes('already claimed') ||
              result.error?.includes('limit') ||
              result.error?.includes('attention session')) {
            return result;
          }
          lastResult = result;
          if (i < DEFAULT_RETRY_ATTEMPTS) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          }
        } catch (err) {
          lastResult = { success: false, error: (err as Error)?.message || 'Failed to issue reward' };
          if (i < DEFAULT_RETRY_ATTEMPTS) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          } else {
            return lastResult;
          }
        }
      }
      return lastResult;
    } catch (error) {
      logger.error('[Rewards] Issue error:', error);
      return { success: false, error: (error as Error)?.message || 'Failed to issue reward' };
    }
  }

  // Get user's pending rewards
  async getPendingRewards(userId: string): Promise<Reward[]> {
    try {
      logger.log('[Rewards] Getting pending rewards for:', userId);
      // Will be implemented when rewards queue table exists
      return [];
    } catch (error) {
      logger.error('[Rewards] Get pending error:', error);
      return [];
    }
  }

  // Claim a reward
  async claimReward(_rewardId: string): Promise<{ success: boolean; error?: string }> {
    logger.warn('[Rewards] claimReward() is deprecated; use issueReward()/recordView() with server-issued sessions.');
    return {
      success: false,
      error: 'Claim flow is deprecated. Use the current reward issuance flow.',
    };
  }

  /**
   * Convert between Icoin and Vicoin via the transfer-coins edge function.
   * - icoin_to_vicoin: amount is in Icoins (min 100, max 100000, must be divisible by 10). Rate: 10 I = 1 V.
   * - vicoin_to_icoin: amount is in Vicoins (min 1, max 10000). Rate: 1 V = 10 I.
   */
  async transferCoins(
    direction: TransferCoinsDirection,
    amount: number
  ): Promise<TransferCoinsResponse | TransferCoinsErrorResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('transfer-coins', {
        body: { direction, amount },
      });

      if (error) {
        return {
          success: false,
          error: (data as TransferCoinsErrorResponse)?.error ?? error.message ?? 'Transfer failed',
          code: (data as TransferCoinsErrorResponse)?.code,
          limits: (data as TransferCoinsErrorResponse)?.limits,
        };
      }

      const result = data as TransferCoinsResponse | TransferCoinsErrorResponse;
      if (!result.success) {
        return {
          success: false,
          error: result.error ?? 'Transfer failed',
          code: (result as TransferCoinsErrorResponse).code,
          details: (result as TransferCoinsErrorResponse).details,
          limits: (result as TransferCoinsErrorResponse).limits,
        };
      }

      return result as TransferCoinsResponse;
    } catch (err) {
      logger.error('[Rewards] transferCoins error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Transfer failed',
      };
    }
  }

  private mapDbTransactionToWallet(tx: {
    id: string;
    type: string;
    amount: number;
    coin_type: string;
    description: string;
    created_at: string;
    reference_id?: string | null;
  }): WalletTransaction {
    const typeMap: Record<string, WalletTransaction['type']> = {
      earned: 'earned',
      spent: 'spent',
      received: 'received',
      sent: 'sent',
      withdrawn: 'withdrawn',
    };
    return {
      id: tx.id,
      type: typeMap[tx.type] || 'earned',
      amount: tx.amount,
      coinType: tx.coin_type as 'vicoin' | 'icoin',
      description: tx.description,
      timestamp: new Date(tx.created_at),
      referenceId: tx.reference_id ?? null,
    };
  }

  /**
   * Get a single transaction by ID (must belong to the user).
   */
  async getTransactionById(
    userId: string,
    transactionId: string
  ): Promise<WalletTransaction | null> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('id', transactionId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return this.mapDbTransactionToWallet(data);
    } catch (error) {
      logger.error('[Rewards] Get transaction by ID error:', error);
      return null;
    }
  }

  // Get user's transactions with filters, pagination, and sorting (primary API)
  async getTransactions(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: TransactionFilters;
      sortBy?: TransactionSortField;
      sortOrder?: TransactionSortOrder;
    } = {}
  ): Promise<GetTransactionsResult> {
    const {
      limit = 20,
      offset = 0,
      filters = {},
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = options;

    try {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply type filter
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        query = query.in('type', types);
      }

      // Apply coin type filter
      if (filters.coinType) {
        query = query.eq('coin_type', filters.coinType);
      }

      // Apply date range filters
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.lte('created_at', to.toISOString());
      }

      // Apply amount range filters
      if (filters.amountMin != null && !Number.isNaN(filters.amountMin)) {
        query = query.gte('amount', filters.amountMin);
      }
      if (filters.amountMax != null && !Number.isNaN(filters.amountMax)) {
        query = query.lte('amount', filters.amountMax);
      }

      // Apply search filter (case-insensitive description match)
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.ilike('description', term);
      }

      const { data, error, count } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const transactions = (data || []).map((tx) => this.mapDbTransactionToWallet(tx));
      const totalCount = count ?? transactions.length;
      const hasMore = offset + transactions.length < totalCount;
      const nextOffset = offset + limit;

      return {
        transactions,
        totalCount,
        hasMore,
        nextOffset,
      };
    } catch (error) {
      logger.error('[Rewards] Get transactions error:', error);
      return {
        transactions: [],
        totalCount: 0,
        hasMore: false,
        nextOffset: offset,
      };
    }
  }

  // Backward-compatible wrapper
  async getTransactionHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<WalletTransaction[]> {
    const result = await this.getTransactions(userId, { limit, offset });
    return result.transactions;
  }

  // Get transaction summary for a period (e.g. today, this week, this month)
  async getTransactionSummary(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<TransactionPeriodSummary> {
    const summary: TransactionPeriodSummary = {
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

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, coin_type, amount')
        .eq('user_id', userId)
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());

      if (error) throw error;

      for (const tx of data || []) {
        const amt = tx.amount;
        const isVicoin = tx.coin_type === 'vicoin';
        summary.count++;

        switch (tx.type) {
          case 'earned':
            if (isVicoin) summary.earnedVicoin += amt;
            else summary.earnedIcoin += amt;
            break;
          case 'spent':
            if (isVicoin) summary.spentVicoin += amt;
            else summary.spentIcoin += amt;
            break;
          case 'received':
            if (isVicoin) summary.receivedVicoin += amt;
            else summary.receivedIcoin += amt;
            break;
          case 'sent':
            if (isVicoin) summary.sentVicoin += amt;
            else summary.sentIcoin += amt;
            break;
          case 'withdrawn':
            if (isVicoin) summary.withdrawnVicoin += amt;
            else summary.withdrawnIcoin += amt;
            break;
        }
      }
    } catch (error) {
      logger.error('[Rewards] Get transaction summary error:', error);
    }

    return summary;
  }

  // Subscribe to real-time transaction updates for the user
  subscribeToTransactions(
    userId: string,
    onInsert: (tx: WalletTransaction) => void,
    onError?: (err: Error) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            type: string;
            amount: number;
            coin_type: string;
            description: string;
            created_at: string;
            reference_id?: string | null;
          };
          onInsert(this.mapDbTransactionToWallet(row));
        }
      )
      .subscribe((status, err) => {
        if (err && onError) onError(err);
      });

    return channel;
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
      logger.error('[Rewards] Get daily limits error:', error);
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
      const { data, error } = await supabase.functions.invoke('get-nearby-promotions', {
        body: { latitude, longitude, radiusKm },
      });

      if (error) throw error;
      return (data?.promotions || data?.campaigns || []) as Campaign[];
    } catch (error) {
      logger.error('[Rewards] Get nearby campaigns error:', error);
      return [];
    }
  }

  // Record a view for earning rewards. For promo_view, attentionSessionId from validate-attention is required; redemption is single-use per session id.
  async recordView(
    _userId: string,
    contentId: string,
    watchDuration: number,
    attentionScore?: number,
    totalDuration?: number,
    attentionSessionId?: string
  ): Promise<{ earned: boolean; amount?: number; coinType?: CoinType }> {
    try {
      const result = await this.issueReward('promo_view', contentId, {
        attentionScore,
        watchDuration,
        totalDuration,
        attentionSessionId,
      });
      return {
        earned: result.success,
        amount: result.amount,
        coinType: result.coinType,
      };
    } catch (error) {
      logger.error('[Rewards] Record view error:', error);
      return { earned: false };
    }
  }

  // Initiate withdrawal
  async initiateWithdrawal(
    _userId: string,
    amount: number,
    coinType: CoinType,
    method: 'bank' | 'crypto' | 'paypal'
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('request-payout', {
        body: { amount, coinType, method },
      });

      if (error) throw error;
      return { success: true, transactionId: data?.transaction_id ?? data?.transactionId };
    } catch (error) {
      logger.error('[Rewards] Withdrawal error:', error);
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
      logger.error('[Rewards] Balance summary error:', error);
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

  // Get comprehensive promo earnings from reward_logs + promotion_checkins
  async getPromoEarnings(
    userId: string,
    options?: { startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<{
    totalVicoin: number;
    totalIcoin: number;
    totalCoins: number;
    bySource: { checkin: number; promoView: number; taskComplete: number };
    byPeriod: { today: number; week: number; month: number };
    locations: { name: string; amount: number; count: number; coinType: string }[];
    items: PromoEarningsItem[];
    periodComparison?: { change: number; trend: 'up' | 'down' | 'same' };
  }> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 6);
      const monthStart = new Date(todayStart);
      monthStart.setMonth(monthStart.getMonth() - 1);

      const startDate = options?.startDate ?? monthStart;
      const endDate = options?.endDate ?? now;
      const limit = options?.limit ?? 100;

      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      // 1. Reward logs (promo_view, task_complete) – authoritative source for watch/task rewards
      const { data: rewardLogs, error: rlError } = await supabase
        .from('reward_logs')
        .select('id, amount, coin_type, reward_type, content_id, created_at')
        .eq('user_id', userId)
        .in('reward_type', ['promo_view', 'task_complete'])
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (rlError) throw rlError;

      // 2. Promotion check-ins (check-in rewards - not in transactions)
      const { data: checkins, error: pcError } = await supabase
        .from('promotion_checkins')
        .select('id, business_name, reward_amount, reward_type, streak_bonus, checked_in_at, promotion_id')
        .eq('user_id', userId)
        .not('reward_amount', 'is', null)
        .gte('checked_in_at', startIso)
        .lte('checked_in_at', endIso)
        .order('checked_in_at', { ascending: false })
        .limit(limit);

      if (pcError) throw pcError;

      // 3. Transactions (fallback for any earned with promo/task/check in description)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('id, amount, coin_type, description, reference_id, created_at, type')
        .eq('user_id', userId)
        .eq('type', 'earned')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .or('description.ilike.%promo%,description.ilike.%task%,description.ilike.%check%')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (txError) throw txError;

      const items: PromoEarningsItem[] = [];
      const seenIds = new Set<string>();

      // Process reward_logs
      for (const r of rewardLogs || []) {
        const ts = new Date(r.created_at);
        const coinType = (r.coin_type || 'icoin') as 'vicoin' | 'icoin';
        const source = r.reward_type === 'promo_view' ? 'promo_view' : 'task_complete';
        const promoId = r.content_id?.includes(':') ? r.content_id.split(':')[0] : r.content_id;
        items.push({
          id: `rl-${r.id}`,
          source,
          amount: r.amount,
          coinType,
          label: source === 'promo_view' ? 'Watched promo video' : 'Completed task',
          timestamp: ts,
          promotionId: /^[0-9a-f-]{36}$/i.test(promoId || '') ? promoId : undefined,
        });
        seenIds.add(`rl-${r.id}`);
      }

      // Process check-ins (may duplicate if we also had task_complete for same check-in - dedupe by time+amount)
      for (const c of checkins || []) {
        const totalAmount = (c.reward_amount || 0) + (c.streak_bonus || 0);
        if (totalAmount <= 0) continue;
        const ts = new Date(c.checked_in_at);
        const coinType = (c.reward_type || 'vicoin') as 'vicoin' | 'icoin';
        const cid = `pc-${c.id}`;
        if (seenIds.has(cid)) continue;
        items.push({
          id: cid,
          source: 'checkin',
          amount: totalAmount,
          coinType,
          label: `Check-in at ${c.business_name || 'location'}`,
          timestamp: ts,
          promotionId: c.promotion_id || undefined,
          metadata: { streakBonus: c.streak_bonus },
        });
        seenIds.add(cid);
      }

      // Process transactions (filter out any already covered by reward_logs/checkins)
      const txRefIds = new Set((rewardLogs || []).map((r) => r.content_id));
      const checkinIds = new Set((checkins || []).map((c) => c.id));
      for (const t of txData || []) {
        if (t.type !== 'earned') continue;
        if (txRefIds.has(t.reference_id || '')) continue;
        if (t.reference_id && checkinIds.has(t.reference_id)) continue;
        const ts = new Date(t.created_at);
        const coinType = (t.coin_type || 'icoin') as 'vicoin' | 'icoin';
        let source: PromoEarningsItem['source'] = 'other';
        if (/check|checkin/i.test(t.description || '')) source = 'checkin';
        else if (/promo|view/i.test(t.description || '')) source = 'promo_view';
        else if (/task/i.test(t.description || '')) source = 'task_complete';
        items.push({
          id: `tx-${t.id}`,
          source,
          amount: t.amount,
          coinType,
          label: t.description || 'Promo reward',
          timestamp: ts,
        });
      }

      // Sort by timestamp desc
      items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Aggregate stats
      let totalVicoin = 0;
      let totalIcoin = 0;
      const bySource = { checkin: 0, promoView: 0, taskComplete: 0 };
      const byPeriod = { today: 0, week: 0, month: 0 };
      const locationMap = new Map<string, { amount: number; count: number; coinType: string }>();

      const todayMs = todayStart.getTime();
      const weekMs = weekStart.getTime();
      const monthMs = monthStart.getTime();

      for (const it of items) {
        const amt = it.amount;
        const ms = it.timestamp.getTime();
        if (it.coinType === 'vicoin') totalVicoin += amt;
        else totalIcoin += amt;

        if (it.source === 'checkin') bySource.checkin += amt;
        else if (it.source === 'promo_view') bySource.promoView += amt;
        else if (it.source === 'task_complete') bySource.taskComplete += amt;

        if (ms >= todayMs) byPeriod.today += amt;
        if (ms >= weekMs) byPeriod.week += amt;
        if (ms >= monthMs) byPeriod.month += amt;

        if (it.source === 'checkin' && it.label) {
          const locName = it.label.replace(/^Check-in at /, '').trim() || 'Unknown';
          const cur = locationMap.get(locName) || { amount: 0, count: 0, coinType: it.coinType };
          cur.amount += amt;
          cur.count += 1;
          locationMap.set(locName, cur);
        }
      }

      const locations = Array.from(locationMap.entries()).map(([name, v]) => ({
        name,
        amount: v.amount,
        count: v.count,
        coinType: v.coinType,
      }));

      // Period comparison (this week vs last week)
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const { data: lastWeekItems } = await supabase
        .from('reward_logs')
        .select('amount, coin_type, created_at')
        .eq('user_id', userId)
        .in('reward_type', ['promo_view', 'task_complete'])
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', weekStart.toISOString());

      const { data: lastWeekCheckins } = await supabase
        .from('promotion_checkins')
        .select('reward_amount, streak_bonus, reward_type, checked_in_at')
        .eq('user_id', userId)
        .not('reward_amount', 'is', null)
        .gte('checked_in_at', lastWeekStart.toISOString())
        .lt('checked_in_at', weekStart.toISOString());

      let lastWeekTotal = 0;
      for (const r of lastWeekItems || []) {
        lastWeekTotal += r.amount;
      }
      for (const c of lastWeekCheckins || []) {
        lastWeekTotal += (c.reward_amount || 0) + (c.streak_bonus || 0);
      }

      const weekTotal = byPeriod.week;
      let change = 0;
      let trend: 'up' | 'down' | 'same' = 'same';
      if (lastWeekTotal > 0) {
        change = Math.round(((weekTotal - lastWeekTotal) / lastWeekTotal) * 100);
        trend = change > 0 ? 'up' : change < 0 ? 'down' : 'same';
      } else if (weekTotal > 0) trend = 'up';

      return {
        totalVicoin,
        totalIcoin,
        totalCoins: totalVicoin + totalIcoin,
        bySource,
        byPeriod,
        locations,
        items,
        periodComparison: { change, trend },
      };
    } catch (error) {
      logger.error('[Rewards] Get promo earnings error:', error);
      return {
        totalVicoin: 0,
        totalIcoin: 0,
        totalCoins: 0,
        bySource: { checkin: 0, promoView: 0, taskComplete: 0 },
        byPeriod: { today: 0, week: 0, month: 0 },
        locations: [],
        items: [],
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
      logger.error('[Rewards] Check rewarded error:', error);
      return false;
    }
  }
}

export const rewardsService = new RewardsService();
