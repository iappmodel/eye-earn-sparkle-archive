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

// Reward amounts by type — VICOIN for usage & engagement (platform rewards user for beneficial actions).
// Promo rewards are NOT in this map: they come only from campaign_id → promo_campaigns in redeem_attention_reward RPC.
const REWARD_AMOUNTS: Record<string, { amount?: number; min?: number; max?: number; coinType: 'vicoin' | 'icoin' }> = {
  task_complete: { min: 3, max: 20, coinType: 'icoin' },
  referral: { amount: 10, coinType: 'vicoin' },
  milestone: { amount: 20, coinType: 'vicoin' },
  daily_bonus: { min: 1, max: 5, coinType: 'icoin' },
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

    if (isPromoView) {
      const { attentionSessionId, mediaId } = body;
      console.log('[IssueReward] Promo request (single-use redeem by attention session id):', { userId: user.id, attentionSessionId, mediaId });

      // Campaign verification: session.campaign_id → promo_campaigns; amount/currency come from DB only in redeem_attention_reward RPC.
      const { data: session, error: sessionError } = await supabase
        .from('attention_sessions')
        .select('id, user_id, content_id, media_id, validated, validation_score, redeemed_at')
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
      finalCoinType = rewardConfig.coinType;
      if ('amount' in rewardConfig && rewardConfig.amount != null) {
        finalAmount = rewardConfig.amount;
      } else {
        const min = rewardConfig.min ?? 1;
        const max = rewardConfig.max ?? 10;
        finalAmount = Math.floor(Math.random() * (max - min + 1)) + min;
      }

      // --- Server-side action verification: do not trust client contentId; verify the action exists ---
      const userId = user.id;
      if (rewardType === 'login') {
        const loginPrefix = 'login:';
        const today = new Date().toISOString().slice(0, 10);
        const expected = `${loginPrefix}${today}`;
        if (contentId !== expected) {
          console.warn('[IssueReward] Login contentId must be login:YYYY-MM-DD for today:', { contentId, expected });
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid login reward request', code: 'invalid_content_id' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'like') {
        const { data: likeRow } = await supabase.from('content_likes').select('id').eq('user_id', userId).eq('content_id', contentId).limit(1).maybeSingle();
        if (!likeRow) {
          console.warn('[IssueReward] Like not found for user/content:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Like not found for this content', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'save') {
        const { data: saveRow } = await supabase.from('saved_content').select('id').eq('user_id', userId).eq('content_id', contentId).limit(1).maybeSingle();
        if (!saveRow) {
          console.warn('[IssueReward] Save not found for user/content:', { userId, contentId });
          return new Response(
            JSON.stringify({ success: false, error: 'Save not found for this content', code: 'action_not_found' }),
            { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
      } else if (rewardType === 'comment') {
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
      };
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
