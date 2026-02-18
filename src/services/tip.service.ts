/**
 * Tip Service – Send tips to content creators via tip-creator edge function.
 * Handles validation, balance checks, error parsing, and retries for transient failures.
 *
 * Identity: Feed creator.id is the creator's auth user id (user_id). For self-tip
 * checks use the current auth user id (user.id), not profile.id.
 */
import { supabase } from '@/integrations/supabase/client';

export type CoinType = 'vicoin' | 'icoin';

export interface TipResult {
  success: boolean;
  tipId?: string;
  amount?: number;
  coinType?: CoinType;
  newBalance?: number;
  error?: string;
}

/** Min/max tip amounts (enforced by backend and TipSheet). */
export const TIP_AMOUNT_MIN = 10;
export const TIP_AMOUNT_MAX = 10000;

const MAX_TIP_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRetryableTipError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(msg)) return true;
  if (/500|502|503|504|internal server error|service unavailable/i.test(msg)) return true;
  if ((err as Error)?.name === 'TypeError' && /fetch/i.test(msg)) return true;
  return false;
}

function getTipErrorMessage(raw: string | undefined, currentBalance?: number): string {
  if (!raw) return 'Unable to send tip. Please try again.';
  const lower = raw.toLowerCase();
  if (lower.includes('insufficient') || lower.includes('balance')) {
    return currentBalance != null
      ? `Insufficient balance. You have ${currentBalance} coins. Please choose a smaller amount.`
      : 'Insufficient balance. Please check your wallet and try again.';
  }
  if (lower.includes('creator not found') || lower.includes('user profile not found')) {
    return 'Creator not found. Please refresh and try again.';
  }
  if (lower.includes('cannot tip yourself')) return "You can't tip yourself.";
  if (lower.includes('daily tip limit') || lower.includes('daily amount limit')) return raw;
  if (lower.includes('too many tips recently')) return 'Too many tips in a short time. Please wait a few minutes and try again.';
  if (lower.includes('duplicate request')) return 'Duplicate request. Please wait a moment and try again.';
  if (lower.includes('invalid') || lower.includes('unauthorized')) return 'Session may have expired. Please refresh and try again.';
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
    return 'Connection issue. Please check your internet and try again.';
  }
  return raw.length > 120 ? 'Something went wrong. Please try again.' : raw;
}

/** True when creator id is a real user UUID (backend can credit tips). Non-UUID creators (e.g. mock/shell) cannot receive tips. */
export function isCreatorIdValidForTip(creatorId: string): boolean {
  return UUID_REGEX.test(creatorId);
}

export function isValidTipTarget(contentId: string, creatorId: string): boolean {
  return UUID_REGEX.test(contentId) && UUID_REGEX.test(creatorId);
}

/**
 * True when the current user (auth user id) is the same as the creator (feed creator id = user_id).
 * Use this for self-tip checks; pass user.id from AuthContext, not profile.id.
 */
export function isSelfTip(currentAuthUserId: string | undefined, creatorId: string): boolean {
  return Boolean(currentAuthUserId && creatorId && currentAuthUserId === creatorId);
}

/** Clamp amount to allowed tip range. */
export function clampTipAmount(amount: number): number {
  return Math.min(TIP_AMOUNT_MAX, Math.max(TIP_AMOUNT_MIN, Math.floor(amount)));
}

async function sendTipOnce(params: {
  contentId: string;
  creatorId: string;
  amount: number;
  coinType: CoinType;
  idempotencyKey?: string;
}): Promise<TipResult> {
  const { contentId, creatorId, amount, coinType, idempotencyKey } = params;
  const body: Record<string, unknown> = { contentId, creatorId, amount, coinType };
  if (idempotencyKey) body.idempotencyKey = idempotencyKey;
  const { data, error } = await supabase.functions.invoke('tip-creator', {
    body,
  });

  if (error) {
    let rawError = 'Failed to send tip';
    let currentBalance: number | undefined;
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      try {
        const parsed = await (ctx as Response).clone().json().catch(() => null);
        if (parsed?.error && typeof parsed.error === 'string') rawError = parsed.error;
        if (typeof parsed?.current_balance === 'number') currentBalance = parsed.current_balance;
      } catch {
        /* ignore */
      }
    }
    if (!rawError && (error as Error)?.message) rawError = (error as Error).message;
    return {
      success: false,
      error: getTipErrorMessage(rawError, currentBalance),
    };
  }

  if (data?.success) {
    return {
      success: true,
      tipId: data.tip_id,
      amount: data.amount,
      coinType: data.coin_type,
      newBalance: data.new_balance,
    };
  }

  return {
    success: false,
    error: getTipErrorMessage(data?.error ?? 'Failed to send tip'),
  };
}

export async function sendTip(params: {
  contentId: string;
  creatorId: string;
  amount: number;
  coinType: CoinType;
}): Promise<TipResult> {
  const { contentId, creatorId, amount: rawAmount, coinType } = params;
  const amount = clampTipAmount(rawAmount);

  if (!isValidTipTarget(contentId, creatorId)) {
    return { success: false, error: 'Invalid content or creator for tipping.' };
  }

  let lastResult: TipResult = { success: false, error: 'Something went wrong. Please try again.' };
  const idempotencyKey = crypto.randomUUID();

  for (let attempt = 0; attempt <= MAX_TIP_RETRIES; attempt++) {
    try {
      const result = await sendTipOnce({ contentId, creatorId, amount, coinType, idempotencyKey });
      if (result.success) return result;

      lastResult = result;
      const isRetryable =
        attempt < MAX_TIP_RETRIES &&
        isRetryableTipError(new Error(result.error ?? ''));
      if (!isRetryable) return result;

      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS + attempt * 500));
    } catch (err) {
      console.error('[TipService] Error:', err);
      lastResult = {
        success: false,
        error: getTipErrorMessage(err instanceof Error ? err.message : 'Failed to send tip'),
      };
      if (attempt < MAX_TIP_RETRIES && isRetryableTipError(err)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS + attempt * 500));
        continue;
      }
      return lastResult;
    }
  }

  return lastResult;
}
