import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttentionValidationRequest {
  userId: string;
  contentId: string;
  promoId?: string;
  attentionScore: number;
  watchDuration: number;
  totalDuration: number;
  framesDetected: number;
  totalFrames: number;
  deviceFingerprint?: string;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  value: number;
  threshold: number;
  weight: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AttentionValidationRequest = await req.json();
    console.log('[ValidateAttention] Request:', { userId: user.id, contentId: body.contentId });

    const checks: ValidationCheck[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // 1. Attention Score Check (weight: 30)
    const attentionWeight = 30;
    const attentionThreshold = 60;
    const attentionPassed = body.attentionScore >= attentionThreshold;
    checks.push({
      name: 'attention_score',
      passed: attentionPassed,
      value: body.attentionScore,
      threshold: attentionThreshold,
      weight: attentionWeight,
    });
    if (attentionPassed) totalScore += attentionWeight;
    totalWeight += attentionWeight;

    // 2. Watch Duration Check (weight: 25)
    const durationWeight = 25;
    const requiredWatchPercent = 70;
    const watchPercent = (body.watchDuration / body.totalDuration) * 100;
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

    // 3. Face Detection Consistency (weight: 25)
    const faceWeight = 25;
    const minFacePercent = 50;
    const facePercent = body.totalFrames > 0 ? (body.framesDetected / body.totalFrames) * 100 : 0;
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

    // 4. Minimum Frames Check (weight: 10)
    const framesWeight = 10;
    const minFrames = 30;
    const framesPassed = body.totalFrames >= minFrames;
    checks.push({
      name: 'minimum_frames',
      passed: framesPassed,
      value: body.totalFrames,
      threshold: minFrames,
      weight: framesWeight,
    });
    if (framesPassed) totalScore += framesWeight;
    totalWeight += framesWeight;

    // 5. Timing Consistency (weight: 10)
    const timingWeight = 10;
    const maxWatchRatio = 1.5;
    const watchRatio = body.watchDuration / body.totalDuration;
    const timingPassed = watchRatio <= maxWatchRatio && watchRatio >= 0.5;
    checks.push({
      name: 'timing_consistency',
      passed: timingPassed,
      value: watchRatio,
      threshold: maxWatchRatio,
      weight: timingWeight,
    });
    if (timingPassed) totalScore += timingWeight;
    totalWeight += timingWeight;

    // Calculate final validation score
    const validationScore = (totalScore / totalWeight) * 100;
    const isValid = validationScore >= 70;

    // Check for suspicious patterns
    const suspiciousPatterns: string[] = [];
    
    if (body.attentionScore > 95 && watchPercent < 80) {
      suspiciousPatterns.push('high_attention_low_watch');
    }
    
    if (facePercent === 100 && body.totalFrames > 100) {
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

    // Calculate reward multiplier
    let rewardMultiplier = 1.0;
    if (validationScore >= 90) rewardMultiplier = 1.0;
    else if (validationScore >= 80) rewardMultiplier = 0.9;
    else if (validationScore >= 70) rewardMultiplier = 0.75;
    else rewardMultiplier = 0.5;

    console.log('[ValidateAttention] Result:', { 
      userId: user.id,
      isValid, 
      validationScore,
      rewardMultiplier,
    });

    return new Response(
      JSON.stringify({
        success: true,
        validated: isValid,
        validationScore,
        rewardMultiplier,
        attentionScore: body.attentionScore,
        watchPercentage: Math.round(watchPercent),
        checks: checks.map(c => ({
          name: c.name,
          passed: c.passed,
        })),
        message: isValid 
          ? 'Attention validated! Reward eligible.' 
          : 'Validation failed - reward reduced.',
        reasons: !isValid ? checks
          .filter(c => !c.passed)
          .map(c => `${c.name.replace('_', ' ')} below threshold`) : [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[ValidateAttention] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false, validated: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
