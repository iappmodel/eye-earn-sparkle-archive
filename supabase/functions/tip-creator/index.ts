import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeadersStrict } from "../_shared/cors.ts";

// Abuse controls: per-tip max, per-user/day limits, velocity
const PER_TIP_MAX = 10_000;
const PER_USER_DAY_MAX_TIPS = 100;
const PER_USER_DAY_MAX_AMOUNT = 50_000;
const VELOCITY_MAX_TIPS_IN_5MIN = 10;

const TipCreatorSchema = z.object({
  contentId: z.string().uuid('Invalid content ID'),
  creatorId: z.string().uuid('Invalid creator ID'),
  amount: z.number().int().min(1).max(PER_TIP_MAX),
  coinType: z.enum(['vicoin', 'icoin']),
  idempotencyKey: z.string().uuid().optional(),
});

serve(async (req) => {
  const cors = getCorsHeadersStrict(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors.headers });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input with zod
    const parseResult = TipCreatorSchema.safeParse(await req.json());
    if (!parseResult.success) {
      console.warn('[TipCreator] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors, success: false }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const { contentId, creatorId, amount, coinType, idempotencyKey } = parseResult.data;
    const auditLog = async (outcome: string, errorMessage?: string, tipId?: string) => {
      await supabase.from('tip_audit_log').insert({
        tipper_id: user.id,
        creator_id: creatorId,
        content_id: contentId,
        amount,
        coin_type: coinType,
        idempotency_key: idempotencyKey ?? null,
        outcome,
        error_message: errorMessage ?? null,
        tip_id: tipId ?? null,
      });
    };
    const releaseIdempotencyClaim = async () => {
      if (idempotencyKey && idempotencyClaimed) {
        await supabase.from('tip_idempotency').delete().eq('idempotency_key', idempotencyKey).eq('tipper_id', user.id);
      }
    };

    console.log('[TipCreator] Request:', { userId: user.id, contentId, creatorId, amount, coinType, idempotencyKey: idempotencyKey ?? null });

    // Idempotency: claim key before processing to prevent double-spend
    let idempotencyClaimed = false;
    if (idempotencyKey) {
      const { data: existing, error: insertErr } = await supabase
        .from('tip_idempotency')
        .insert({ idempotency_key: idempotencyKey, tipper_id: user.id, status: 'processing' })
        .select('idempotency_key')
        .maybeSingle();
      const isConflict = insertErr?.code === '23505';
      if (isConflict || (!insertErr && !existing)) {
        const { data: cached } = await supabase
          .from('tip_idempotency')
          .select('status, result')
          .eq('idempotency_key', idempotencyKey)
          .eq('tipper_id', user.id)
          .maybeSingle();
        if (cached?.status === 'complete' && cached?.result) {
          console.log('[TipCreator] Idempotent hit:', idempotencyKey);
          return new Response(
            JSON.stringify({ ...(cached.result as Record<string, unknown>), idempotent: true }),
            { headers: { ...headers, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: 'Duplicate request. Retry with same idempotency key in a few seconds.', success: false }),
          { status: 409, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (insertErr) {
        console.error('[TipCreator] Idempotency insert error:', insertErr);
        return new Response(
          JSON.stringify({ error: 'Unable to process request', success: false }),
          { status: 503, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      idempotencyClaimed = true;
    }

    if (user.id === creatorId) {
      await releaseIdempotencyClaim();
      await auditLog('rejected_self_tip', 'Cannot tip yourself');
      return new Response(
        JSON.stringify({ error: 'Cannot tip yourself', success: false }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limits: per-user/day count, per-user/day amount, velocity (tips in 5 min)
    const { data: stats, error: statsError } = await supabase.rpc('get_tipper_tip_stats', { p_tipper_id: user.id }).single();
    if (statsError) {
      console.error('[TipCreator] Stats RPC error:', statsError);
      await releaseIdempotencyClaim();
      await auditLog('rejected_other', 'Rate limit check failed');
      return new Response(
        JSON.stringify({ error: 'Unable to verify limits. Please try again.', success: false }),
        { status: 503, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }
    if (stats) {
      const dailyCount = Number(stats.daily_count ?? 0);
      const dailyAmount = Number(stats.daily_amount ?? 0);
      const tips5min = Number(stats.tips_5min_count ?? 0);
      if (dailyCount >= PER_USER_DAY_MAX_TIPS) {
        await releaseIdempotencyClaim();
        await auditLog('rejected_daily_count', `Daily tip limit (${PER_USER_DAY_MAX_TIPS}) exceeded`);
        return new Response(
          JSON.stringify({ error: `Daily tip limit reached (${PER_USER_DAY_MAX_TIPS} tips)`, success: false }),
          { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (dailyAmount + amount > PER_USER_DAY_MAX_AMOUNT) {
        await releaseIdempotencyClaim();
        await auditLog('rejected_daily_amount', `Daily amount limit (${PER_USER_DAY_MAX_AMOUNT}) would be exceeded`);
        return new Response(
          JSON.stringify({ error: `Daily tip amount limit would be exceeded (max ${PER_USER_DAY_MAX_AMOUNT})`, success: false }),
          { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (tips5min >= VELOCITY_MAX_TIPS_IN_5MIN) {
        await releaseIdempotencyClaim();
        await auditLog('rejected_velocity', `Too many tips in 5 minutes (max ${VELOCITY_MAX_TIPS_IN_5MIN})`);
        return new Response(
          JSON.stringify({ error: `Too many tips recently. Try again in a few minutes.`, success: false }),
          { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Call atomic stored procedure — handles locking both users, balance transfer, transactions, and notification
    const { data, error: rpcError } = await supabase.rpc('atomic_tip_creator', {
      p_tipper_id: user.id,
      p_creator_id: creatorId,
      p_amount: amount,
      p_coin_type: coinType,
      p_content_id: contentId,
    });

    if (rpcError) {
      console.error('[TipCreator] RPC error:', rpcError);
      const msg = rpcError.message || '';

      if (msg.includes('INSUFFICIENT_BALANCE')) {
        await releaseIdempotencyClaim();
        await auditLog('rejected_insufficient_balance', msg);
        const match = msg.match(/Current:\s*(\d+)/);
        const currentBalance = match ? parseInt(match[1], 10) : undefined;
        return new Response(
          JSON.stringify({
            error: `Insufficient ${coinType} balance`,
            current_balance: currentBalance,
            success: false,
          }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('CREATOR_NOT_FOUND')) {
        await releaseIdempotencyClaim();
        await auditLog('rejected_other', msg);
        return new Response(
          JSON.stringify({ error: 'Creator not found', success: false }),
          { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('TIPPER_NOT_FOUND')) {
        await releaseIdempotencyClaim();
        await auditLog('rejected_other', msg);
        return new Response(
          JSON.stringify({ error: 'User profile not found', success: false }),
          { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      await releaseIdempotencyClaim();
      await auditLog('rejected_other', msg);
      throw new Error('Failed to process tip');
    }

    const result = {
      success: true,
      tip_id: data.tip_id,
      amount: data.amount,
      coin_type: data.coin_type,
      new_balance: data.new_balance,
    };

    await auditLog('success', undefined, data.tip_id);
    if (idempotencyKey && idempotencyClaimed) {
      await supabase.from('tip_idempotency').update({ status: 'complete', result }).eq('idempotency_key', idempotencyKey).eq('tipper_id', user.id);
    }

    console.log('[TipCreator] Success:', data);

    return new Response(
      JSON.stringify(result),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[TipCreator] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
