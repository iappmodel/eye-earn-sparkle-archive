import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import { checkRewardRateLimit } from "../_shared/rateLimit.ts";
import { getIdempotencyKey, getCachedResponse, setCachedResponse } from "../_shared/idempotency.ts";

const AttentionSourceSchema = z.enum(['vision', 'fallback', 'none']);

// One sample: t = timestamp ms, r = raw attention 0–1. Server recomputes score from these; client-supplied score is never authoritative.
const AttentionSampleSchema = z.object({ t: z.number(), r: z.number().min(0).max(1) });
const SamplesHashSchema = z.string().max(128).optional();

// Identity comes from Authorization only; never from request body.
const FORBIDDEN_KEYS = ['userId', 'user_id'];
function rejectForbiddenKeys(raw: unknown): void {
  if (raw == null || typeof raw !== 'object') return;
  const obj = raw as Record<string, unknown>;
  for (const key of FORBIDDEN_KEYS) {
    if (key in obj && obj[key] !== undefined) {
      throw new Error(`Forbidden: do not send '${key}'; identity is from Authorization only.`);
    }
  }
}

const AttentionValidationSchema = z.object({
  contentId: z.string().uuid('Invalid content ID'),
  promoId: z.string().uuid('Invalid promo ID').optional(),
  // Client may send for logging/display only; NEVER used for validation or multiplier — server recomputes from samples.
  attentionScore: z.number().min(0).max(100).optional(),
  attentiveMs: z.number().min(0).max(86400000).optional(),
  totalMs: z.number().min(0).max(86400000).optional(),
  source: AttentionSourceSchema.optional(),
  sourceConfidence: z.number().min(0).max(1).optional(),
  watchDuration: z.number().min(0).max(86400), // max 24h
  totalDuration: z.number().min(0.01).max(86400), // must be > 0 to avoid division by zero
  framesDetected: z.number().int().min(0).max(100000).optional(),
  totalFrames: z.number().int().min(0).max(100000).optional(),
  deviceFingerprint: z.string().max(255).optional(),
  // Authoritative for validation: server recomputes score from samples; optional hash for attestation/audit.
  samples: z.array(AttentionSampleSchema).min(1).max(10000).optional(),
  samplesHash: SamplesHashSchema,
}).strict();

interface ValidationCheck {
  name: string;
  passed: boolean;
  value: number;
  threshold: number;
  weight: number;
}

/** Server-side attention from samples only. dt clamped to 500ms; raw >= threshold counts as attentive. */
const ATTENTIVE_THRESHOLD = 0.6;
const DT_CLAMP_MS = 500;
const ATTENTION_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function computeAttentionFromSamples(
  samples: Array<{ t: number; r: number }>
): { attentiveMs: number; totalMs: number; score100: number } {
  if (samples.length === 0) return { attentiveMs: 0, totalMs: 0, score100: 0 };
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  let totalMs = 0;
  let attentiveMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dt = Math.min(sorted[i].t - sorted[i - 1].t, DT_CLAMP_MS);
    if (dt > 0) {
      totalMs += dt;
      if (sorted[i].r >= ATTENTIVE_THRESHOLD) attentiveMs += dt;
    }
  }
  const score100 = totalMs > 0 ? Math.min(100, Math.max(0, Math.round(100 * (attentiveMs / totalMs)))) : 0;
  return { attentiveMs, totalMs, score100 };
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const cached = await getCachedResponse(supabase, idempotencyKey, user.id, 'validate_attention');
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

    const rawBody = await req.json();
    try {
      rejectForbiddenKeys(rawBody);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid input';
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = AttentionValidationSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.warn('[ValidateAttention] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('[ValidateAttention] Request:', { contentId: body.contentId });

    // Hard rule: no Icoin payout when source is fallback or none
    const source = body.source ?? 'none';
    if (source === 'fallback' || source === 'none') {
      return new Response(
        JSON.stringify({
          success: true,
          validated: false,
          validationScore: 0,
          rewardMultiplier: 0,
          reason: 'fallback_or_no_source',
          reasonCodes: ['fallback_or_no_source'],
          message: 'Attention source not eligible for reward.',
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Do not trust client-supplied attention metrics. Validation uses only server-computed score from samples.
    const hasSamples = body.samples != null && body.samples.length > 0;
    if (!hasSamples) {
      return new Response(
        JSON.stringify({
          success: true,
          validated: false,
          validationScore: 0,
          rewardMultiplier: 0,
          reason: 'samples_required',
          reasonCodes: ['samples_required'],
          message: 'Attention samples required for validation; client score is not accepted.',
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const serverAttention = computeAttentionFromSamples(body.samples);
    let samplesHashForDb: string | null = null;
    if (body.samplesHash != null && body.samplesHash !== '') {
      const canonical = JSON.stringify(
        body.samples.slice().sort((a, b) => a.t - b.t)
      );
      const computed = await sha256Hex(canonical);
      if (computed !== body.samplesHash) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'samples_hash_mismatch',
            reasonCodes: ['samples_hash_mismatch'],
            message: 'Samples hash does not match payload.',
          }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      samplesHashForDb = computed;
    } else {
      samplesHashForDb = await sha256Hex(
        JSON.stringify(body.samples.slice().sort((a, b) => a.t - b.t))
      );
    }

    // Optional legacy frame validation
    const framesDetected = body.framesDetected ?? 0;
    const totalFrames = body.totalFrames ?? 1;
    if (framesDetected > totalFrames) {
      return new Response(
        JSON.stringify({ error: 'framesDetected cannot exceed totalFrames' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    if (body.watchDuration > body.totalDuration * 1.5) {
      return new Response(
        JSON.stringify({ error: 'watchDuration exceeds reasonable bounds relative to totalDuration' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Product rule: All-or-nothing per docs/REWARD_WATCH_POLICY.md
    // NO CREDIT IF STOPPED EARLY. Full watch required; 0.99 tolerance for timing drift only.
    const FULL_WATCH_RATIO = 0.99;
    const requiredWatchPercent = FULL_WATCH_RATIO * 100; // 99
    const watchRatio = body.watchDuration / body.totalDuration;
    const watchPercent = watchRatio * 100;

    // Hard gate: stopped early → no validation, no reward
    if (watchRatio < FULL_WATCH_RATIO) {
      return new Response(
        JSON.stringify({
          success: true,
          validated: false,
          validationScore: 0,
          rewardMultiplier: 0,
          reason: 'watch_incomplete',
          reasonCodes: ['watch_incomplete'],
          message: 'Full watch required. No credit for partial views.',
          watchPercentage: Math.round(watchPercent),
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Use only server-computed attention (from samples); never body.attentionScore / body.attentiveMs / body.totalMs for validation.
    const serverScore100 = serverAttention.score100;
    const serverAttentiveMs = serverAttention.attentiveMs;
    const serverTotalMs = serverAttention.totalMs;

    const checks: ValidationCheck[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // 1. Attention Score Check (weight: 30) — server-computed only; high bar for reward
    const attentionWeight = 30;
    const attentionThreshold = 85;
    const attentionPassed = serverScore100 >= attentionThreshold;
    checks.push({
      name: 'attention_score',
      passed: attentionPassed,
      value: serverScore100,
      threshold: attentionThreshold,
      weight: attentionWeight,
    });
    if (attentionPassed) totalScore += attentionWeight;
    totalWeight += attentionWeight;

    // 2. Watch Duration Check (weight: 25) — full watch required (99%); hard gate above ensures we only reach here when passed
    const durationWeight = 25;
    const durationPassed = watchPercent >= requiredWatchPercent;
    checks.push({
      name: 'watch_duration',
      passed: durationPassed,
      value: watchPercent,
      threshold: requiredWatchPercent,
      weight: durationWeight,
    });
    if (durationPassed) totalScore += durationWeight;
    totalWeight += durationWeight;

    // 3. Face/Time consistency: use server-computed attentiveMs/totalMs from samples; fallback to legacy frames only for display
    const faceWeight = 25;
    const minFacePercent = 50;
    const facePercent =
      serverTotalMs > 0
        ? (serverAttentiveMs / serverTotalMs) * 100
        : totalFrames > 0
          ? (framesDetected / totalFrames) * 100
          : 0;
    const facePassed = facePercent >= minFacePercent;
    checks.push({
      name: 'face_detection',
      passed: facePassed,
      value: facePercent,
      threshold: minFacePercent,
      weight: faceWeight,
    });
    if (facePassed) totalScore += faceWeight;
    totalWeight += faceWeight;

    // 4. Minimum time/frames: server totalMs from samples or legacy frames
    const framesWeight = 10;
    const minMs = 2000;
    const minFrames = 30;
    const minTimeOrFramesPassed = serverTotalMs >= minMs || totalFrames >= minFrames;
    checks.push({
      name: 'minimum_frames',
      passed: minTimeOrFramesPassed,
      value: serverTotalMs > 0 ? serverTotalMs : totalFrames,
      threshold: serverTotalMs > 0 ? minMs : minFrames,
      weight: framesWeight,
    });
    if (minTimeOrFramesPassed) totalScore += framesWeight;
    totalWeight += framesWeight;

    // 5. Timing Consistency (weight: 10)
    const timingWeight = 10;
    const maxWatchRatio = 1.5;
    const timingPassed = watchRatio <= maxWatchRatio && watchRatio >= FULL_WATCH_RATIO;
    checks.push({
      name: 'timing_consistency',
      passed: timingPassed,
      value: watchRatio,
      threshold: FULL_WATCH_RATIO,
      weight: timingWeight,
    });
    if (timingPassed) totalScore += timingWeight;
    totalWeight += timingWeight;

    // Calculate final validation score
    const validationScore = (totalScore / totalWeight) * 100;
    // Full reward only when all checks pass; no partial payouts for marginal attention
    const isValid = validationScore >= 90;

    // Check for suspicious patterns (use server-computed score only)
    const suspiciousPatterns: string[] = [];
    if (serverScore100 > 95 && watchPercent < requiredWatchPercent) {
      suspiciousPatterns.push('high_attention_low_watch');
    }
    if (facePercent === 100 && (totalFrames > 100 || serverTotalMs > 10000)) {
      suspiciousPatterns.push('perfect_face_detection');
    }

    // Log abuse if suspicious
    if (suspiciousPatterns.length > 0 || !isValid) {
      console.warn('[ValidateAttention] Suspicious activity:', {
        userId: user.id,
        patterns: suspiciousPatterns,
        validationScore,
      });

      if (!isValid || suspiciousPatterns.length >= 2) {
        await supabase.from('abuse_logs').insert({
          user_id: user.id,
          abuse_type: 'attention_fraud',
          severity: validationScore < 50 ? 'high' : 'medium',
          details: {
            validationScore,
            suspiciousPatterns,
            contentId: body.contentId,
          },
          device_fingerprint: body.deviceFingerprint || null,
          user_agent: req.headers.get('user-agent') || null,
        });
      }
    }

    // Reward multiplier: 1.0 only when fully validated; no partial multipliers for low attention
    let rewardMultiplier: number;
    const reasonCodes: string[] = [];
    if (isValid) {
      rewardMultiplier = 1.0;
    } else {
      rewardMultiplier = 0;
      // Explicit reason codes for failed validation (machine-readable)
      for (const c of checks) {
        if (!c.passed) reasonCodes.push(`${c.name}_below_threshold`);
      }
      if (suspiciousPatterns.length > 0) {
        reasonCodes.push(...suspiciousPatterns);
      }
      if (reasonCodes.length === 0) {
        reasonCodes.push('validation_failed');
      }
    }

    // Always write attention_sessions server-side (audit + single-use id). No multiplier when not validated.
    const finalRewardMultiplier = isValid ? rewardMultiplier : 0;
    const sessionStartedAt = new Date().toISOString();
    const sessionEndedAt = new Date().toISOString();
    const sessionExpiresAt = new Date(Date.now() + ATTENTION_SESSION_TTL_MS).toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('attention_sessions')
      .insert({
        user_id: user.id,
        content_id: body.contentId,
        campaign_id: body.promoId ?? body.contentId,
        media_id: body.contentId,
        validated: isValid,
        validation_score: validationScore,
        reward_multiplier: finalRewardMultiplier,
        samples_hash: samplesHashForDb,
        started_at: sessionStartedAt,
        ended_at: sessionEndedAt,
        expires_at: sessionExpiresAt,
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('[ValidateAttention] Failed to create attention session:', sessionError);
    }

    // Return session id only when validated so issue-reward can redeem; never return non-zero multiplier when not validated.
    const attentionSessionId = isValid && session?.id ? session.id : null;

    console.log('[ValidateAttention] Result:', {
      isValid,
      validationScore,
      rewardMultiplier: finalRewardMultiplier,
      attentionSessionId: attentionSessionId ?? undefined,
    });

    const responsePayload: Record<string, unknown> = {
      success: true,
      validated: isValid,
      validationScore,
      rewardMultiplier: finalRewardMultiplier,
      attentionSessionId: attentionSessionId ?? undefined,
      attentionScore: serverScore100,
      watchPercentage: Math.round(watchPercent),
      checks: checks.map(c => ({
        name: c.name,
        passed: c.passed,
      })),
      message: isValid 
        ? 'Attention validated! Reward eligible.' 
        : 'Validation failed - no reward.',
      reasons: !isValid ? checks
        .filter(c => !c.passed)
        .map(c => `${c.name.replace('_', ' ')} below threshold`) : [],
    };
    if (isValid) {
      responsePayload.reasonCodes = reasonCodes.length ? reasonCodes : undefined;
    } else {
      responsePayload.reason = reasonCodes[0] ?? 'validation_failed';
      responsePayload.reasonCodes = reasonCodes;
    }

    if (idempotencyKey) await setCachedResponse(supabase, idempotencyKey, user.id, 'validate_attention', 200, responsePayload);
    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[ValidateAttention] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({
        error: message,
        success: false,
        validated: false,
        rewardMultiplier: 0,
        reasonCodes: ['internal_error'],
      }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
