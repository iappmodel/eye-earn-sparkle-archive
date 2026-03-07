// Payout Service – request withdrawals and list payout history.
// Handles retries for transient errors and user-friendly error messages.
import { supabase } from '@/integrations/supabase/client';
import { isDemoMode } from '@/lib/appMode';
import { addDemoBalance, getDemoBalances, pushDemoTransaction } from '@/lib/demoState';

export type PayoutMethod = 'paypal' | 'bank' | 'crypto';

const MAX_PAYOUT_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function isRetryablePayoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(msg)) return true;
  if (/500|502|503|504|429|internal server error|service unavailable/i.test(msg)) return true;
  if ((err as Error)?.name === 'TypeError' && /fetch/i.test(msg)) return true;
  return false;
}

/** User-friendly payout error message. Exported for use in hooks/UI. */
export function getPayoutErrorMessage(raw: string | undefined): string {
  if (!raw) return 'Payout request failed. Please try again.';
  const lower = raw.toLowerCase();
  if (lower.includes('kyc') || lower.includes('verification required')) {
    return 'Identity verification (KYC) is required before requesting a payout. Complete verification in your profile.';
  }
  if (lower.includes('insufficient balance')) return 'Insufficient balance. Please check your wallet and try again.';
  if (lower.includes('invalid') && lower.includes('payment method')) {
    return 'Invalid or unauthorized payment method. Please add or select a valid payout destination.';
  }
  if (lower.includes('profile not found') || lower.includes('user profile not found')) {
    return 'Profile not found. Please refresh and try again.';
  }
  if (lower.includes('unauthorized')) return 'Session may have expired. Please sign in again and retry.';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
    return 'Connection issue. Please check your internet and try again.';
  }
  return raw.length > 120 ? 'Something went wrong. Please try again.' : raw;
}
export type CoinType = 'vicoin' | 'icoin';

export const MIN_PAYOUT_VICOIN = 500;
export const MIN_PAYOUT_ICOIN = 1000;
export const MAX_PAYOUT_VICOIN = 500_000;
export const MAX_PAYOUT_ICOIN = 1_000_000;

/** Fee: 2% with min 10 and max 500 coins */
export function getPayoutFee(amount: number): { fee: number; netAmount: number } {
  const rawFee = Math.floor((amount * 2) / 100);
  const fee = Math.min(500, Math.max(10, rawFee));
  const netAmount = Math.max(0, amount - fee);
  return { fee, netAmount };
}

export interface RequestPayoutParams {
  amount: number;
  coinType: CoinType;
  method: PayoutMethod;
  paymentMethodId?: string | null;
  payoutDetails?: Record<string, string>;
}

export interface RequestPayoutResult {
  success: boolean;
  payout_request_id?: string | null;
  transaction_id?: string;
  amount?: number;
  coin_type?: string;
  method?: string;
  fee?: number;
  net_amount?: number;
  status?: string;
  reference_id?: string;
  estimated_arrival?: string;
  new_balance?: number;
  error?: string;
}

export interface PayoutRequestRow {
  id: string;
  user_id: string;
  payment_method_id: string | null;
  amount: number;
  coin_type: string;
  status: string;
  fee: number | null;
  net_amount: number | null;
  reference_id: string | null;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodRow {
  id: string;
  user_id: string;
  method_type: string;
  is_default: boolean;
  nickname: string | null;
  details: {
    account_last4?: string;
    email?: string;
    wallet_address?: string;
    bank_name?: string;
  };
  verified: boolean;
  created_at: string;
  updated_at: string;
}

const DEMO_PAYOUT_HISTORY_KEY = 'i_demo_payout_history_v1';

function getDemoPayoutHistory(): PayoutRequestRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DEMO_PAYOUT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PayoutRequestRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDemoPayoutHistory(next: PayoutRequestRow[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_PAYOUT_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage quota failures in private mode.
  }
}

function createDemoPayoutId(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `demo-payout-${uuid}`;
}

async function requestPayoutOnce(params: RequestPayoutParams): Promise<RequestPayoutResult> {
  if (isDemoMode) {
    const { amount, coinType, method } = params;
    const balances = getDemoBalances();
    const current = coinType === 'vicoin' ? balances.vicoins : balances.icoins;
    if (current < amount) {
      return { success: false, error: getPayoutErrorMessage('Insufficient balance') };
    }

    const { fee, netAmount } = getPayoutFee(amount);
    addDemoBalance(coinType, -amount);
    const tx = pushDemoTransaction({
      type: 'withdrawn',
      amount,
      coinType,
      description: `Demo payout (${method})`,
      referenceId: null,
    });

    const now = new Date().toISOString();
    const payoutRow: PayoutRequestRow = {
      id: createDemoPayoutId(),
      user_id: 'demo-user',
      payment_method_id: params.paymentMethodId ?? null,
      amount,
      coin_type: coinType,
      status: 'pending',
      fee,
      net_amount: netAmount,
      reference_id: tx.id,
      failure_reason: null,
      processed_at: null,
      created_at: now,
      updated_at: now,
    };
    const history = [payoutRow, ...getDemoPayoutHistory()].slice(0, 200);
    saveDemoPayoutHistory(history);

    const nextBalances = getDemoBalances();
    return {
      success: true,
      payout_request_id: payoutRow.id,
      transaction_id: tx.id,
      amount,
      coin_type: coinType,
      method,
      fee,
      net_amount: netAmount,
      status: 'pending',
      reference_id: tx.id,
      estimated_arrival: '1-2 business days',
      new_balance: coinType === 'vicoin' ? nextBalances.vicoins : nextBalances.icoins,
    };
  }

  const { amount, coinType, method, paymentMethodId, payoutDetails } = params;
  const { data, error } = await supabase.functions.invoke('request-payout', {
    body: {
      amount,
      coinType,
      method,
      paymentMethodId: paymentMethodId ?? null,
      payoutDetails: payoutDetails ?? undefined,
    },
  });

  if (error) {
    const ctx = (error as { context?: Response })?.context;
    let parsedError: string | undefined;
    if (ctx && typeof (ctx as Response).json === 'function') {
      try {
        const parsed = await (ctx as Response).clone().json().catch(() => null);
        parsedError = parsed?.error || parsed?.message;
      } catch {
        /* ignore */
      }
    }
    const raw =
      typeof parsedError === 'string' && parsedError.length > 0
        ? parsedError
        : (error as Error)?.message ?? 'Payout request failed';
    return { success: false, error: getPayoutErrorMessage(raw) };
  }

  if (data && !data.success && data.error) {
    return { success: false, error: getPayoutErrorMessage(data.error) };
  }

  return {
    success: true,
    payout_request_id: data?.payout_request_id,
    transaction_id: data?.transaction_id,
    amount: data?.amount,
    coin_type: data?.coin_type,
    method: data?.method,
    fee: data?.fee,
    net_amount: data?.net_amount,
    status: data?.status,
    reference_id: data?.reference_id,
    estimated_arrival: data?.estimated_arrival,
    new_balance: data?.new_balance,
  };
}

class PayoutService {
  async requestPayout(params: RequestPayoutParams): Promise<RequestPayoutResult> {
    let lastResult: RequestPayoutResult = {
      success: false,
      error: 'Something went wrong. Please try again.',
    };

    for (let attempt = 0; attempt <= MAX_PAYOUT_RETRIES; attempt++) {
      try {
        const result = await requestPayoutOnce(params);
        if (result.success) return result;

        lastResult = result;
        const isRetryable =
          attempt < MAX_PAYOUT_RETRIES && isRetryablePayoutError(new Error(result.error ?? ''));
        if (!isRetryable) return result;

        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS + attempt * 500));
      } catch (err) {
        console.error('[Payout] requestPayout error:', err);
        lastResult = {
          success: false,
          error: getPayoutErrorMessage((err as Error)?.message ?? 'Payout request failed'),
        };
        if (attempt < MAX_PAYOUT_RETRIES && isRetryablePayoutError(err)) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS + attempt * 500));
          continue;
        }
        return lastResult;
      }
    }

    return lastResult;
  }

  async getPayoutRequests(limit = 20): Promise<PayoutRequestRow[]> {
    if (isDemoMode) {
      return getDemoPayoutHistory().slice(0, limit);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return [];

    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Payout] getPayoutRequests error:', error);
      return [];
    }
    return (data ?? []) as PayoutRequestRow[];
  }

  async getPaymentMethods(): Promise<PaymentMethodRow[]> {
    if (isDemoMode) {
      const now = new Date().toISOString();
      return [
        {
          id: 'demo-paypal',
          user_id: 'demo-user',
          method_type: 'paypal',
          is_default: true,
          nickname: 'PayPal (Demo)',
          details: { email: 'investor.demo@iview.local' },
          verified: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: 'demo-bank',
          user_id: 'demo-user',
          method_type: 'bank',
          is_default: false,
          nickname: 'Bank **** 9021 (Demo)',
          details: { account_last4: '9021', bank_name: 'Demo National Bank' },
          verified: true,
          created_at: now,
          updated_at: now,
        },
      ];
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return [];

    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('[Payout] getPaymentMethods error:', error);
      return [];
    }
    return (data ?? []) as PaymentMethodRow[];
  }
}

export const payoutService = new PayoutService();
