import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import { checkRewardRateLimit } from "../_shared/rateLimit.ts";
import { getIdempotencyKey, getCachedResponse, setCachedResponse } from "../_shared/idempotency.ts";

// --- Trust boundaries (SECURITY) ---
// - Amount and coinType are NEVER accepted from the client. Reject any request that sends them (FORBIDDEN_CLIENT_KEYS).
// - Idempotency: optional Idempotency-Key header for replay protection; server-issued session ids also prevent double-credit.
// - promo_view: client sends attentionSessionId (from validate-attention) + mediaId. Session is single-use (redeemed_at); ledger ref_id = session id.
// - All other reward types: server creates/obtains a reward_sessions row (unique on user_id, content_id, reward_type); issue_reward_atomic requires
//   valid unredeemed session id. contentId is verified (action exists) before creating session; duplicate prevention is session id, not content_id.
// - Daily and per-type caps enforced in issue_reward_atomic (non-promo) or redeem_attention_reward (promo).

// Daily limits (hard caps)
const DAILY_LIMITS = {
  icoin: 80,
  vicoin: 120,
  promo_views: 20,
};

type DailySpinReward = { amount: number; coinType: 'vicoin' | 'icoin'; probability: number };
const DAILY_SPIN_REWARDS: DailySpinReward[] = [
  { amount: 5, coinType: 'vicoin', probability: 25 },
  { amount: 10, coinType: 'icoin', probability: 20 },
  { amount: 15, coinType: 'vicoin', probability: 18 },
  { amount: 25, coinType: 'icoin', probability: 15 },
  { amount: 50, coinType: 'vicoin', probability: 12 },
  { amount: 100, coinType: 'icoin', probability: 7 },
  { amount: 200, coinType: 'vicoin', probability: 3 },
];

type PromoActionRewardConfig = {
  amount: number;
  coinType: 'vicoin' | 'icoin';
};

const PROMO_ACTION_REWARDS: Record<string, PromoActionRewardConfig> = {
  checkin: { amount: 50, coinType: 'vicoin' },
  qr_scan: { amount: 50, coinType: 'icoin' },
  watch_promo: { amount: 100, coinType: 'vicoin' },
  leave_review: { amount: 50, coinType: 'icoin' },
  share_social: { amount: 25, coinType: 'vicoin' },
  return_visit: { amount: 75, coinType: 'vicoin' },
};

const VERIFIED_PROMO_ACTION_IDS = new Set<string>([
  'checkin',
  'watch_promo',
  'leave_review',
  'return_visit',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pickDailySpinReward(): DailySpinReward {
  const total = DAILY_SPIN_REWARDS.reduce((sum, item) => sum + item.probability, 0);
  let roll = Math.random() * total;
  for (const item of DAILY_SPIN_REWARDS) {
    roll -= item.probability;
    if (roll <= 0) return item;
  }
  return DAILY_SPIN_REWARDS[0];
}

function getXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

async function applyTaskXpReward(
  supabase: SupabaseClientLike,
  userId: string,
  xpGained: number
): Promise<{ xpAwarded: number; level: number; currentXp: number; totalXp: number } | null> {
  const normalizedXp = Math.max(0, Math.floor(xpGained));
  if (normalizedXp <= 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  let { data: levelRow, error: levelFetchError } = await supabase
    .from('user_levels')
    .select('user_id, current_xp, total_xp, level')
    .eq('user_id', userId)
    .maybeSingle();

  if (levelFetchError) {
    throw levelFetchError;
  }

  if (!levelRow) {
    const { data: inserted, error: insertError } = await supabase
      .from('user_levels')
      .insert({
        user_id: userId,
        current_xp: 0,
        total_xp: 0,
        level: 1,
        streak_days: 1,
        longest_streak: 1,
        last_active_date: today,
      })
      .select('user_id, current_xp, total_xp, level')
      .maybeSingle();

    if (insertError && (insertError as { code?: string })?.code !== '23505') {
      throw insertError;
    }
    if (inserted) {
      levelRow = inserted;
    } else {
      const { data: retryRow, error: retryError } = await supabase
        .from('user_levels')
        .select('user_id, current_xp, total_xp, level')
        .eq('user_id', userId)
        .maybeSingle();
      if (retryError) throw retryError;
      levelRow = retryRow;
    }
  }

  const currentXp = Number(levelRow?.current_xp ?? 0);
  const totalXp = Number(levelRow?.total_xp ?? 0);
  let nextLevel = Math.max(1, Number(levelRow?.level ?? 1));
  let nextCurrentXp = currentXp + normalizedXp;
  const nextTotalXp = totalXp + normalizedXp;

  while (nextCurrentXp >= getXpForLevel(nextLevel)) {
    nextCurrentXp -= getXpForLevel(nextLevel);
    nextLevel++;
  }

  const { error: updateError } = await supabase
    .from('user_levels')
    .update({
      current_xp: nextCurrentXp,
      total_xp: nextTotalXp,
      level: nextLevel,
    })
    .eq('user_id', userId);

  if (updateError) {
    throw updateError;
  }

  return {
    xpAwarded: normalizedXp,
    level: nextLevel,
    currentXp: nextCurrentXp,
    totalXp: nextTotalXp,
  };
}

// Reward amounts by type — VICOIN for usage & engagement (platform rewards user for beneficial actions).
// Promo rewards are NOT in this map: they come only from campaign_id → promo_campaigns in redeem_attention_reward RPC.
const REWARD_AMOUNTS: Record<string, { amount?: number; min?: number; max?: number; coinType: 'vicoin' | 'icoin' }> = {
  task_complete: { min: 3, max: 20, coinType: 'icoin' },
  // Server-verified promo actions (check-in/review/watch/return-visit); amount/type resolved from PROMO_ACTION_REWARDS.
  promo_action_complete: { amount: 0, coinType: 'icoin' },
  // Secure task system rewards (user_tasks): actual amount/currency come from task_templates server-side.
  user_task_complete: { amount: 0, coinType: 'icoin' },
  // XP-only achievement rewards; server verifies user_achievements and applies XP (no wallet mutation).
  achievement_unlock: { amount: 0, coinType: 'vicoin' },
  referral: { amount: 10, coinType: 'vicoin' },
  milestone: { amount: 20, coinType: 'vicoin' },
  daily_bonus: { min: 1, max: 5, coinType: 'icoin' },
  // Placeholder coinType/amount; actual daily_spin payout is chosen server-side via DAILY_SPIN_REWARDS.
  daily_spin: { amount: 0, coinType: 'icoin' },
  // Platform VICOIN rewards: login + simple usage + engagement
  login: { amount: 3, coinType: 'vicoin' },
  session_usage: { amount: 1, coinType: 'vicoin' },
  like: { amount: 1, coinType: 'vicoin' },
  share: { amount: 2, coinType: 'vicoin' },
  post: { amount: 5, coinType: 'vicoin' },
  save: { amount: 1, coinType: 'vicoin' },
  comment: { amount: 1, coinType: 'vicoin' },
};

// Per-type daily caps (count of rewards of this type per user per day; prevents gaming by rotating contentId)
const DAILY_REWARD_TYPE_CAPS: Record<string, number> = {
  login: 1,
  daily_spin: 1,
  promo_action_complete: 10,
  // Legacy promo/local task_complete path is low-trust (no server action table). Keep a tight cap.
  task_complete: 5,
  session_usage: 12,
  like: 20,
  share: 10,
  post: 10,
  save: 15,
  comment: 20,
};

const VALID_REWARD_TYPES = Object.keys(REWARD_AMOUNTS) as [string, ...string[]];

// Promo rewards: client sends only attentionSessionId (from validate-attention) + mediaId. Single-use per session id.
// Amount, currency, duration, and rules are NEVER from client: server resolves session.campaign_id → promo_campaigns (reward_amount, currency); RPC computes final amount.
const PromoViewSchema = z.object({
  rewardType: z.literal('promo_view'),
  attentionSessionId: z.string().uuid('attentionSessionId is required for promo_view'),
  mediaId: z.string().uuid('mediaId is required for promo_view'),
}).strict();
// Other rewards: client sends only rewardType + contentId. amount/coinType are SERVER-ONLY (REWARD_AMOUNTS); reject if client sends.
const OtherRewardSchema = z.object({
  rewardType: z.enum(VALID_REWARD_TYPES as [string, ...string[]]),
  contentId: z.string().min(1, 'Content ID is required').max(256, 'Content ID too long'),
}).strict();
const IssueRewardSchema = z.union([PromoViewSchema, OtherRewardSchema]);

// Reject requests that send amount/currency/campaign, userId, or raw attention metrics; server-authoritative only.
const FORBIDDEN_CLIENT_KEYS = [
  'amount', 'coinType', 'currency', 'reward_amount', 'campaign_id', 'reward_multiplier', 'min_watch_ratio',
  'attentionScore', 'attentiveMs', 'totalMs', 'validationScore', 'samples', 'samplesHash',
  'userId', // Identity from Authorization only; never from body.
];
function rejectForbiddenRewardKeys(raw: unknown): void {
  if (raw == null || typeof raw !== 'object') return;
  const obj = raw as Record<string, unknown>;
  for (const key of FORBIDDEN_CLIENT_KEYS) {
    if (key in obj && obj[key] !== undefined) {
      throw new Error(`Forbidden: do not send '${key}'; amount and currency are set by the server.`);
    }
  }
}

/** Supabase client or test mock; loose type so tests can inject mocks. */
// deno-lint-ignore no-explicit-any
export type SupabaseClientLike = any;

/**
 * Core handler: validates auth, input, and issues reward. Injected supabase for testability.
 * Exported for critical-path tests (no reward without validated session, forged payloads blocked, caps).
 */
export async function handleIssueReward(
  req: Request,
  supabase: SupabaseClientLike,
  headers: Record<string, string>
): Promise<Response> {
  // Get user from auth header
  const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[IssueReward] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const cached = await getCachedResponse(supabase, idempotencyKey, user.id, 'issue_reward');
      if (cached) {
        return new Response(JSON.stringify(cached.body), {
          status: cached.status,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
    }

    const rateLimit = await checkRewardRateLimit(supabase, user.id, req);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          code: 'rate_limit_exceeded',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }),
        { status: 429, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

  try {
    // Validate input: reject forbidden keys first, then zod
    const rawBody = await req.json();
    try {
      rejectForbiddenRewardKeys(rawBody);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid input';
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }
    const parseResult = IssueRewardSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.warn('[IssueReward] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    const rewardType = body.rewardType;
    const isPromoView = rewardType === 'promo_view';

    let contentId: string;
    let finalCoinType: 'vicoin' | 'icoin';
    let finalAmount: number;
    let attentionScoreForLog: number | null = null;
    let userTaskXpReward = 0;
    let userTaskIsXpOnly = false;
    let achievementXpReward = 0;
    let achievementUnlockRowForResponse: { id: string; achievementId: string; unlockedAt: string } | null = null;
    let promoActionMeta: { promotionId: string; actionId: string; variant: string | null } | null = null;

    if (isPromoView) {
      const { attentionSessionId, mediaId } = body;
      console.log('[IssueReward] Promo request (single-use redeem by attention session id):', { userId: user.id, attentionSessionId, mediaId });

      // Campaign verification: session.campaign_id → promo_campaigns; amount/currency come from DB only in redeem_attention_reward RPC.
      const { data: session, error: sessionError } = await supabase
        .from('attention_sessions')
        .select('id, user_id, content_id, media_id, validated, validation_score, redeemed_at, expires_at')
        .eq('id', attentionSessionId)
        .maybeSingle();

      if (sessionError || !session) {
        console.warn('[IssueReward] Session not found or error:', sessionError);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or expired attention session', code: 'invalid_session' }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (session.user_id !== user.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Session does not belong to user', code: 'invalid_session' }),
          { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (!session.validated || session.redeemed_at != null) {
        return new Response(
          JSON.stringify({ success: false, error: 'Session not validated or already redeemed', code: 'invalid_session' }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      const expiresAt = typeof session.expires_at === 'string' ? Date.parse(session.expires_at) : NaN;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Attention session expired', code: 'invalid_session' }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      const sessionMedia = session.media_id ?? session.content_id;
      if (sessionMedia !== mediaId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Session does not match media', code: 'invalid_session' }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      // Single-use redemption: one attention session id → one redeem (RPC locks session, ledger ref_id = session_id, sets redeemed_at).
      const { data: redeemResult, error: redeemError } = await supabase.rpc('redeem_attention_reward', {
        p_user_id: user.id,
        p_session_id: attentionSessionId,
        p_daily_promo_limit: DAILY_LIMITS.promo_views,
        p_daily_icoin_limit: DAILY_LIMITS.icoin,
        p_daily_vicoin_limit: DAILY_LIMITS.vicoin,
      });

      if (redeemError) {
        console.error('[IssueReward] Redeem RPC error:', redeemError);
        throw redeemError;
      }

      const redeem = redeemResult as { success: boolean; code?: string; limit_type?: string; amount?: number; coin_type?: string; new_balance?: number; daily_remaining_promo_views?: number; daily_remaining_icoin?: number; daily_remaining_vicoin?: number };
      if (!redeem.success) {
        if (redeem.code === 'invalid_session' || redeem.code === 'promotion_not_found') {
          return new Response(
            JSON.stringify({ success: false, error: redeem.code === 'promotion_not_found' ? 'Promotion not found' : 'Invalid or expired attention session', code: redeem.code }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (redeem.code === 'daily_limit_reached') {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Daily limit reached',
              code: 'daily_limit_reached',
              limitType: redeem.limit_type,
            }),
            { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(redeem.code ?? 'Redeem failed');
      }

      await supabase.from('reward_logs').insert({
        user_id: user.id,
        content_id: mediaId,
        reward_type: 'promo_view',
        coin_type: redeem.coin_type ?? 'icoin',
        amount: redeem.amount ?? 0,
        attention_score: Number(session.validation_score) ?? null,
      }).then(() => {}, () => {});

      const successBody = {
        success: true,
        amount: redeem.amount ?? 0,
        coinType: redeem.coin_type ?? 'icoin',
        newBalance: redeem.new_balance ?? 0,
        dailyRemaining: {
          icoin: redeem.daily_remaining_icoin ?? DAILY_LIMITS.icoin,
          vicoin: redeem.daily_remaining_vicoin ?? DAILY_LIMITS.vicoin,
          promo_views: redeem.daily_remaining_promo_views ?? DAILY_LIMITS.promo_views,
        },
      };
      if (idempotencyKey) await setCachedResponse(supabase, idempotencyKey, user.id, 'issue_reward', 200, successBody);
      return new Response(
        JSON.stringify(successBody),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    } else {
      contentId = body.contentId;
      console.log('[IssueReward] Request:', { userId: user.id, rewardType, contentId });

      // Amount and coinType from server config only (client cannot send them; forbidden keys rejected above).
      const rewardConfig = REWARD_AMOUNTS[rewardType as keyof typeof REWARD_AMOUNTS];
      if (!rewardConfig) {
        return new Response(
          JSON.stringify({ error: 'Invalid reward type', code: 'invalid_reward_type' }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (rewardType === 'daily_spin') {
        const dailySpinReward = pickDailySpinReward();
        finalCoinType = dailySpinReward.coinType;
        finalAmount = dailySpinReward.amount;
      } else {
        finalCoinType = rewardConfig.coinType;
        if ('amount' in rewardConfig && rewardConfig.amount != null) {
          finalAmount = rewardConfig.amount;
        } else {
          const min = rewardConfig.min ?? 1;
          const max = rewardConfig.max ?? 10;
          finalAmount = Math.floor(Math.random() * (max - min + 1)) + min;
        }
      }

      // --- Server-side action verification: do not trust client contentId; verify the action exists ---
      const userId = user.id;
      if (rewardType === 'login' || rewardType === 'daily_spin') {
        const prefix = rewardType === 'daily_spin' ? 'daily_spin:' : 'login:';
        const today = new Date().toISOString().slice(0, 10);
        const expected = `${prefix}${today}`;
        if (contentId !== expected) {
          console.warn('[IssueReward] Date-scoped reward contentId mismatch:', { rewardType, contentId, expected });
          return new Response(
            JSON.stringify({
              success: false,
              error: rewardType === 'daily_spin' ? 'Invalid daily spin reward request' : 'Invalid login reward request',
              code: 'invalid_content_id',
            }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'promo_action_complete') {
        const promoActionMatch = /^promo_action:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([a-z0-9_]{1,64})(?::([a-z0-9_-]{1,32}))?$/i.exec(contentId);
        if (!promoActionMatch) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid promo action reward request', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        const [, promotionId, rawActionId, variantRaw] = promoActionMatch;
        const actionId = rawActionId.toLowerCase();
        const variant = variantRaw ? variantRaw.toLowerCase() : null;
        const rewardConfig = PROMO_ACTION_REWARDS[actionId];
        if (!rewardConfig) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unsupported promo action reward', code: 'action_not_supported' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (variant != null) {
          // Reserved for future multi-currency promo actions; fail closed for now.
          return new Response(
            JSON.stringify({ success: false, error: 'Unsupported promo action reward variant', code: 'action_not_supported' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (!VERIFIED_PROMO_ACTION_IDS.has(actionId)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Promo action reward requires verified backend proof', code: 'action_not_supported' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        promoActionMeta = { promotionId, actionId, variant };

        if (actionId === 'checkin') {
          const { data: checkinRow, error: checkinError } = await supabase
            .from('promotion_checkins')
            .select('id, checked_in_at, status')
            .eq('user_id', userId)
            .eq('promotion_id', promotionId)
            .eq('status', 'verified')
            .order('checked_in_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (checkinError) throw checkinError;
          if (!checkinRow) {
            return new Response(
              JSON.stringify({ success: false, error: 'Verified check-in not found', code: 'action_not_found' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }
        } else if (actionId === 'watch_promo') {
          const { data: sessionRow, error: sessionError } = await supabase
            .from('attention_sessions')
            .select('id, redeemed_at, validated')
            .eq('user_id', userId)
            .eq('campaign_id', promotionId)
            .eq('validated', true)
            .not('redeemed_at', 'is', null)
            .order('redeemed_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (sessionError) throw sessionError;
          if (!sessionRow) {
            return new Response(
              JSON.stringify({ success: false, error: 'Verified promo watch not found', code: 'action_not_found' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }
        } else if (actionId === 'leave_review') {
          const { data: checkinForReview, error: checkinForReviewError } = await supabase
            .from('promotion_checkins')
            .select('id')
            .eq('user_id', userId)
            .eq('promotion_id', promotionId)
            .eq('status', 'verified')
            .order('checked_in_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (checkinForReviewError) throw checkinForReviewError;
          if (!checkinForReview) {
            return new Response(
              JSON.stringify({ success: false, error: 'Verified check-in required before review reward', code: 'action_not_found' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }

          const { data: reviewRow, error: reviewError } = await supabase
            .from('promotion_reviews')
            .select('id')
            .eq('user_id', userId)
            .eq('promotion_id', promotionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (reviewError) throw reviewError;
          if (!reviewRow) {
            return new Response(
              JSON.stringify({ success: false, error: 'Promotion review not found', code: 'action_not_found' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }
        } else if (actionId === 'return_visit') {
          const { data: checkins, error: checkinsError } = await supabase
            .from('promotion_checkins')
            .select('id, checked_in_at')
            .eq('user_id', userId)
            .eq('promotion_id', promotionId)
            .eq('status', 'verified')
            .order('checked_in_at', { ascending: false })
            .limit(2);
          if (checkinsError) throw checkinsError;
          const rows = (checkins ?? []) as Array<{ id: string; checked_in_at: string }>;
          if (rows.length < 2) {
            return new Response(
              JSON.stringify({ success: false, error: 'Return visit not verified yet', code: 'action_not_found' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }
          const latest = Date.parse(rows[0].checked_in_at);
          const previous = Date.parse(rows[1].checked_in_at);
          if (!Number.isFinite(latest) || !Number.isFinite(previous) || latest <= previous || (latest - previous) > (7 * 24 * 60 * 60 * 1000)) {
            return new Response(
              JSON.stringify({ success: false, error: 'Return visit must be within 7 days', code: 'action_not_found' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }
        }

        finalCoinType = rewardConfig.coinType;
        finalAmount = rewardConfig.amount;
      } else if (rewardType === 'user_task_complete') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contentId);
        if (!isUuid) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid task reward request', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        const { data: taskRow, error: taskError } = await supabase
          .from('user_tasks')
          .select(`
            id,
            user_id,
            completed,
            reward_claimed,
            template:template_id (
              reward_type,
              reward_value,
              xp_reward
            )
          `)
          .eq('id', contentId)
          .maybeSingle();

        if (taskError || !taskRow || taskRow.user_id !== userId) {
          console.warn('[IssueReward] user_task_complete not found or unauthorized:', { userId, contentId, taskError });
          return new Response(
            JSON.stringify({ success: false, error: 'Task not found', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (!taskRow.completed) {
          return new Response(
            JSON.stringify({ success: false, error: 'Task not completed', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (taskRow.reward_claimed) {
          return new Response(
            JSON.stringify({ success: false, error: 'Reward already claimed for this task', code: 'reward_already_claimed' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        const template = Array.isArray(taskRow.template) ? taskRow.template[0] : taskRow.template;
        const templateRewardType = template?.reward_type;
        const templateRewardValue = Number(template?.reward_value ?? 0);
        const normalizedTemplateRewardValue = Number.isFinite(templateRewardValue) ? Math.max(0, Math.floor(templateRewardValue)) : 0;
        const normalizedTemplateXpReward = Math.max(0, Math.floor(Number(template?.xp_reward ?? 0)));

        if (templateRewardType === 'xp') {
          userTaskIsXpOnly = true;
          // Prefer xp_reward (existing client behavior); fall back to reward_value for legacy/custom templates.
          userTaskXpReward = normalizedTemplateXpReward > 0 ? normalizedTemplateXpReward : normalizedTemplateRewardValue;
          if (userTaskXpReward <= 0) {
            return new Response(
              JSON.stringify({ success: false, error: 'Task has no XP reward', code: 'invalid_reward_type' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          userTaskXpReward = normalizedTemplateXpReward;
          if ((templateRewardType !== 'vicoin' && templateRewardType !== 'icoin') || normalizedTemplateRewardValue <= 0) {
            return new Response(
              JSON.stringify({ success: false, error: 'Task has no coin reward', code: 'invalid_reward_type' }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }

          finalCoinType = templateRewardType;
          finalAmount = normalizedTemplateRewardValue;
        }
      } else if (rewardType === 'achievement_unlock') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contentId);
        if (!isUuid) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid achievement reward request', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        const { data: achievementMetaRow, error: achievementMetaError } = await supabase
          .from('achievements')
          .select('id, is_active, requirement_type, requirement_value, xp_reward')
          .eq('id', contentId)
          .maybeSingle();

        if (achievementMetaError || !achievementMetaRow || achievementMetaRow.is_active === false) {
          console.warn('[IssueReward] achievement_unlock metadata not found:', { userId, contentId, achievementMetaError });
          return new Response(
            JSON.stringify({ success: false, error: 'Achievement not found', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        achievementXpReward = Math.max(0, Math.floor(Number(achievementMetaRow.xp_reward ?? 0)));
        if (achievementXpReward <= 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Achievement has no XP reward', code: 'invalid_reward_type' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        const requirementType = String(achievementMetaRow.requirement_type ?? '');
        const requirementValue = Math.max(0, Math.floor(Number(achievementMetaRow.requirement_value ?? 0)));

        let meetsRequirement = false;
        if (requirementType === 'level' || requirementType === 'streak') {
          const { data: levelRow, error: levelError } = await supabase
            .from('user_levels')
            .select('level, streak_days')
            .eq('user_id', userId)
            .maybeSingle();
          if (levelError) throw levelError;
          const level = Math.max(0, Number(levelRow?.level ?? 0));
          const streakDays = Math.max(0, Number(levelRow?.streak_days ?? 0));
          meetsRequirement = requirementType === 'level'
            ? level >= requirementValue
            : streakDays >= requirementValue;
        } else if (requirementType === 'tasks_completed') {
          const { data: completedTasks, error: completedTasksError } = await supabase
            .from('user_tasks')
            .select('id')
            .eq('user_id', userId)
            .eq('completed', true);
          if (completedTasksError) throw completedTasksError;
          meetsRequirement = (completedTasks?.length ?? 0) >= requirementValue;
        } else if (requirementType === 'coins_earned') {
          const { data: vicoinLedgerRows, error: vicoinLedgerError } = await supabase
            .from('wallet_ledger')
            .select('amount')
            .eq('user_id', userId)
            .eq('currency', 'vicoin')
            .gt('amount', 0);
          if (vicoinLedgerError) throw vicoinLedgerError;
          const totalVicoinEarned = (vicoinLedgerRows ?? []).reduce(
            (sum: number, row: { amount?: number | null }) => sum + Math.max(0, Number(row?.amount ?? 0)),
            0,
          );
          meetsRequirement = totalVicoinEarned >= requirementValue;
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Unsupported achievement requirement', code: 'invalid_reward_type' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        if (!meetsRequirement) {
          return new Response(
            JSON.stringify({ success: false, error: 'Achievement requirement not met', code: 'requirement_not_met' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        const { data: insertedAchievementUnlock, error: insertAchievementUnlockError } = await supabase
          .from('user_achievements')
          .insert({ user_id: userId, achievement_id: contentId })
          .select('id, achievement_id, unlocked_at')
          .maybeSingle();

        let unlockedAchievementRow = insertedAchievementUnlock;
        if (insertAchievementUnlockError) {
          const code = (insertAchievementUnlockError as { code?: string })?.code;
          if (code === '23505') {
            const { data: existingAchievementUnlock, error: existingAchievementUnlockError } = await supabase
              .from('user_achievements')
              .select('id, achievement_id, unlocked_at')
              .eq('user_id', userId)
              .eq('achievement_id', contentId)
              .maybeSingle();
            if (existingAchievementUnlockError) throw existingAchievementUnlockError;
            unlockedAchievementRow = existingAchievementUnlock;
          } else {
            throw insertAchievementUnlockError;
          }
        }

        if (!unlockedAchievementRow) {
          throw new Error('Failed to create or load achievement unlock row');
        }

        achievementUnlockRowForResponse = {
          id: String(unlockedAchievementRow.id),
          achievementId: String(unlockedAchievementRow.achievement_id),
          unlockedAt: String(unlockedAchievementRow.unlocked_at),
        };
      } else if (rewardType === 'task_complete') {
        // Legacy promo/local task rewards (e.g. PromoEarnings hook) are still client-driven. Restrict
        // to namespaced IDs so random generic strings cannot claim task rewards, and rely on tight type caps.
        if (!contentId.startsWith('promo_task:')) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid promo task reward request', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const segments = contentId.split(':');
        if (segments.length < 3 || !segments[1] || !segments[2]) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid promo task reward request', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'like') {
        if (!UUID_RE.test(contentId)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid content id for like reward', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: likeContentRow } = await supabase
          .from('user_content')
          .select('id, user_id')
          .eq('id', contentId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (!likeContentRow) {
          console.warn('[IssueReward] Like content not found/active:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Content not found for like reward', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (String(likeContentRow.user_id ?? '') === userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Self-like rewards are not eligible', code: 'self_interaction_not_rewardable' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: likeRow } = await supabase.from('content_likes').select('id').eq('user_id', userId).eq('content_id', contentId).limit(1).maybeSingle();
        if (!likeRow) {
          console.warn('[IssueReward] Like not found for user/content:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Like not found for this content', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'save') {
        if (!UUID_RE.test(contentId)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid content id for save reward', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: saveContentRow } = await supabase
          .from('user_content')
          .select('id, user_id')
          .eq('id', contentId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (!saveContentRow) {
          console.warn('[IssueReward] Save content not found/active:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Content not found for save reward', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (String(saveContentRow.user_id ?? '') === userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Self-save rewards are not eligible', code: 'self_interaction_not_rewardable' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: saveRow } = await supabase.from('saved_content').select('id').eq('user_id', userId).eq('content_id', contentId).limit(1).maybeSingle();
        if (!saveRow) {
          console.warn('[IssueReward] Save not found for user/content:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Save not found for this content', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'comment') {
        if (!UUID_RE.test(contentId)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid content id for comment reward', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: commentContentRow } = await supabase
          .from('user_content')
          .select('id, user_id')
          .eq('id', contentId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (!commentContentRow) {
          console.warn('[IssueReward] Comment content not found/active:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Content not found for comment reward', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (String(commentContentRow.user_id ?? '') === userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Self-comment rewards are not eligible', code: 'self_interaction_not_rewardable' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: commentRow } = await supabase.from('comments').select('id').eq('user_id', userId).eq('content_id', contentId).limit(1).maybeSingle();
        if (!commentRow) {
          console.warn('[IssueReward] Comment not found for user/content:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Comment not found for this content', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'post') {
        const { data: postRow } = await supabase.from('user_content').select('id').eq('id', contentId).eq('user_id', userId).eq('status', 'active').limit(1).maybeSingle();
        if (!postRow) {
          console.warn('[IssueReward] Post not found or not owned/active:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Post not found or not eligible for reward', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'share') {
        if (!UUID_RE.test(contentId)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid content id for share reward', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: contentRow } = await supabase
          .from('user_content')
          .select('id, user_id')
          .eq('id', contentId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (!contentRow) {
          console.warn('[IssueReward] Share content not found/active:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Content not found for share reward', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (String(contentRow.user_id ?? '') === userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Self-share rewards are not eligible', code: 'self_interaction_not_rewardable' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        const { data: shareRow } = await supabase.from('content_interactions').select('id').eq('user_id', userId).eq('content_id', contentId).or('shared.eq.true,last_event_type.eq.share').limit(1).maybeSingle();
        if (!shareRow) {
          console.warn('[IssueReward] Share not found for user/content:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Share not found for this content', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      }
      // session_usage, task_complete, referral, milestone, daily_bonus: no server-side action table to verify; rely on type caps + daily limits only.

      if (rewardType === 'achievement_unlock') {
        // XP-only achievement rewards: use reward_sessions as replay protection, then apply XP server-side.
        const { data: insertedAchievementSession, error: achievementSessionInsertError } = await supabase
          .from('reward_sessions')
          .insert({ user_id: userId, content_id: contentId, reward_type: rewardType })
          .select('id, redeemed_at')
          .maybeSingle();

        let achievementSessionId: string | null = insertedAchievementSession?.id ?? null;
        let achievementSessionRedeemed = insertedAchievementSession?.redeemed_at != null;

        if (achievementSessionInsertError) {
          const code = (achievementSessionInsertError as { code?: string })?.code;
          if (code === '23505') {
            const { data: existingAchievementSession, error: existingAchievementSessionError } = await supabase
              .from('reward_sessions')
              .select('id, redeemed_at')
              .eq('user_id', userId)
              .eq('content_id', contentId)
              .eq('reward_type', rewardType)
              .limit(1)
              .maybeSingle();
            if (existingAchievementSessionError) {
              console.error('[IssueReward] achievement_unlock reward session lookup error:', existingAchievementSessionError);
              throw existingAchievementSessionError;
            }
            achievementSessionId = existingAchievementSession?.id ?? null;
            achievementSessionRedeemed = existingAchievementSession?.redeemed_at != null;
          } else {
            console.error('[IssueReward] achievement_unlock reward session insert error:', achievementSessionInsertError);
            throw achievementSessionInsertError;
          }
        }

        if (!achievementSessionId || achievementSessionRedeemed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Reward already claimed for this achievement',
              code: 'reward_already_claimed',
            }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        const claimTime = new Date().toISOString();
        const { data: claimedAchievementSession, error: claimAchievementSessionError } = await supabase
          .from('reward_sessions')
          .update({ redeemed_at: claimTime })
          .eq('id', achievementSessionId)
          .eq('user_id', userId)
          .is('redeemed_at', null)
          .select('id')
          .maybeSingle();

        if (claimAchievementSessionError) {
          console.error('[IssueReward] achievement_unlock session claim error:', claimAchievementSessionError);
          throw claimAchievementSessionError;
        }
        if (!claimedAchievementSession) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Reward already claimed for this achievement',
              code: 'reward_already_claimed',
            }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        let achievementXpResult: Awaited<ReturnType<typeof applyTaskXpReward>> = null;
        try {
          achievementXpResult = await applyTaskXpReward(supabase, user.id, achievementXpReward);
        } catch (achievementXpError) {
          await supabase
            .from('reward_sessions')
            .update({ redeemed_at: null })
            .eq('id', achievementSessionId)
            .eq('user_id', userId)
            .then(
              () => {},
              (rollbackError) => console.warn('[IssueReward] Failed to rollback achievement_unlock session claim:', rollbackError),
            );
          throw achievementXpError;
        }

        const successBody = {
          success: true,
          amount: 0,
          coinType: null,
          achievementXp: achievementXpResult,
          achievementUnlock: achievementUnlockRowForResponse,
          dailyRemaining: {
            icoin: DAILY_LIMITS.icoin,
            vicoin: DAILY_LIMITS.vicoin,
            promo_views: DAILY_LIMITS.promo_views,
          },
        };
        if (idempotencyKey) await setCachedResponse(supabase, idempotencyKey, user.id, 'issue_reward', 200, successBody);
        return new Response(
          JSON.stringify(successBody),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      if (rewardType === 'user_task_complete' && userTaskIsXpOnly) {
        // XP-only task rewards: no wallet mutation, but still server-authoritative. Claim the task atomically
        // (reward_claimed=false -> true) before applying XP to prevent duplicate XP on concurrent requests.
        const { data: claimedTask, error: claimTaskError } = await supabase
          .from('user_tasks')
          .update({ reward_claimed: true })
          .eq('id', contentId)
          .eq('user_id', user.id)
          .eq('completed', true)
          .eq('reward_claimed', false)
          .select('id')
          .maybeSingle();

        if (claimTaskError) {
          console.error('[IssueReward] Failed to claim XP-only task reward:', claimTaskError);
          throw claimTaskError;
        }

        if (!claimedTask) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Reward already claimed for this task',
              code: 'reward_already_claimed',
            }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }

        let xpResult: Awaited<ReturnType<typeof applyTaskXpReward>> = null;
        try {
          xpResult = await applyTaskXpReward(supabase, user.id, userTaskXpReward);
        } catch (xpError) {
          // Best-effort rollback if XP application failed after the claim flag was set.
          await supabase
            .from('user_tasks')
            .update({ reward_claimed: false })
            .eq('id', contentId)
            .eq('user_id', user.id)
            .then(() => {}, (rollbackError) => console.warn('[IssueReward] Failed to rollback XP-only task claim:', rollbackError));
          throw xpError;
        }

        const successBody = {
          success: true,
          amount: 0,
          coinType: null,
          taskRewardType: 'xp',
          taskXp: xpResult,
          dailyRemaining: {
            icoin: DAILY_LIMITS.icoin,
            vicoin: DAILY_LIMITS.vicoin,
            promo_views: DAILY_LIMITS.promo_views,
          },
        };
        if (idempotencyKey) await setCachedResponse(supabase, idempotencyKey, user.id, 'issue_reward', 200, successBody);
        return new Response(
          JSON.stringify(successBody),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      // --- Idempotency via server-issued session id: one session per (user_id, content_id, reward_type); single-use (redeemed_at) ---
      const { data: insertedSession, error: sessionInsertError } = await supabase
        .from('reward_sessions')
        .insert({ user_id: userId, content_id: contentId, reward_type: rewardType })
        .select('id')
        .maybeSingle();

      let sessionId: string | null = insertedSession?.id ?? null;

      if (sessionInsertError) {
        const code = (sessionInsertError as { code?: string })?.code;
        if (code === '23505') {
          const { data: existingSession } = await supabase
            .from('reward_sessions')
            .select('id, redeemed_at')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .eq('reward_type', rewardType)
            .limit(1)
            .maybeSingle();
          if (existingSession?.redeemed_at != null) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Reward already claimed for this content',
                code: 'reward_already_claimed',
              }),
              { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
            );
          }
          sessionId = existingSession?.id ?? null;
        } else {
          console.error('[IssueReward] reward_sessions insert error:', sessionInsertError);
          throw sessionInsertError;
        }
      }

      if (!sessionId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Could not create or obtain reward session',
            code: 'invalid_session',
          }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      // Atomic caps + single-use session enforcement in Postgres (issue_reward_atomic locks session, checks unredeemed, applies reward, marks redeemed)
      const typeCap = DAILY_REWARD_TYPE_CAPS[rewardType] ?? null;
      const { data: rpcResult, error: rpcError } = await supabase.rpc('issue_reward_atomic', {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_reward_type: rewardType,
        p_coin_type: finalCoinType,
        p_amount: finalAmount,
        p_attention_score: attentionScoreForLog ?? null,
        p_is_promo_view: false,
        p_type_cap: typeCap,
        p_daily_icoin_limit: DAILY_LIMITS.icoin,
        p_daily_vicoin_limit: DAILY_LIMITS.vicoin,
        p_daily_promo_limit: DAILY_LIMITS.promo_views,
      });

      if (rpcError) {
        console.error('[IssueReward] RPC error:', rpcError);
        throw rpcError;
      }

      const result = rpcResult as { success: boolean; code?: string; amount?: number; new_balance?: number; daily_remaining_icoin?: number; daily_remaining_vicoin?: number; daily_remaining_promo_views?: number };
      if (!result.success) {
        if (result.code === 'reward_already_claimed') {
          if (rewardType === 'user_task_complete') {
            await supabase
              .from('user_tasks')
              .update({ reward_claimed: true })
              .eq('id', contentId)
              .eq('user_id', user.id)
              .then(() => {}, () => {});
          }
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Reward already claimed for this content',
              code: 'reward_already_claimed',
            }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (result.code === 'daily_type_cap') {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Daily limit for ${rewardType} rewards reached`,
              code: 'daily_type_cap',
            }),
            { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (result.code === 'daily_limit_reached' || result.code === 'cap_row_missing') {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Daily limit reached',
              code: 'daily_limit_reached',
            }),
            { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        if (result.code === 'invalid_session') {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Invalid or expired reward session',
              code: 'invalid_session',
            }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(result.code ?? 'Unknown RPC failure');
      }

      const newBalance = result.new_balance ?? 0;
      const appliedAmount = result.amount ?? finalAmount;

      console.log('[IssueReward] Success:', {
        userId: user.id,
        amount: appliedAmount,
        coinType: finalCoinType,
        newBalance,
      });

      const successBody = {
        success: true,
        amount: appliedAmount,
        coinType: finalCoinType,
        newBalance,
        dailyRemaining: {
          icoin: result.daily_remaining_icoin ?? DAILY_LIMITS.icoin,
          vicoin: result.daily_remaining_vicoin ?? DAILY_LIMITS.vicoin,
          promo_views: result.daily_remaining_promo_views ?? DAILY_LIMITS.promo_views,
        },
      } as Record<string, unknown>;
      if (rewardType === 'promo_action_complete' && promoActionMeta) {
        successBody.promoAction = promoActionMeta;
      }
      if (rewardType === 'user_task_complete') {
        try {
          const xpResult = await applyTaskXpReward(supabase, user.id, userTaskXpReward);
          if (xpResult) {
            successBody.taskXp = xpResult;
          }
        } catch (xpError) {
          console.warn('[IssueReward] Failed to apply task XP reward:', xpError);
          successBody.taskXpSyncFailed = true;
        }
      }
      if (rewardType === 'user_task_complete') {
        await supabase
          .from('user_tasks')
          .update({ reward_claimed: true })
          .eq('id', contentId)
          .eq('user_id', user.id)
          .then(() => {}, (e) => console.warn('[IssueReward] Failed to sync user_task reward_claimed:', e));
      }
      if (idempotencyKey) await setCachedResponse(supabase, idempotencyKey, user.id, 'issue_reward', 200, successBody);
      return new Response(
        JSON.stringify(successBody),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('[IssueReward] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}

// Only start server when this file is the entrypoint (not when imported by tests)
if (import.meta.main) {
  serve(async (req) => {
    const cors = getCorsHeadersStrict(req);
    if (!cors.ok) return cors.response;
    const headers = { ...cors.headers, 'Content-Type': 'application/json' };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors.headers });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    return await handleIssueReward(req, supabase, headers);
  });
}
