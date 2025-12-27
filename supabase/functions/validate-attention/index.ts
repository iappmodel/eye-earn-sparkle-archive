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
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AttentionValidationRequest = await req.json();
    const { 
      userId, 
      contentId, 
      promoId,
      attentionScore, 
      watchDuration, 
      totalDuration,
      framesDetected,
      totalFrames 
    } = body;

    console.log(`[validate-attention] User: ${userId}, Content: ${contentId}`);
    console.log(`[validate-attention] Score: ${attentionScore}%, Duration: ${watchDuration}/${totalDuration}s`);
    console.log(`[validate-attention] Frames: ${framesDetected}/${totalFrames}`);

    // Validation rules
    const REQUIRED_ATTENTION_SCORE = 85; // Must maintain 85%+ attention
    const REQUIRED_WATCH_PERCENTAGE = 95; // Must watch 95%+ of content
    const MIN_FRAMES_REQUIRED = 10; // Minimum frames for valid detection

    const watchPercentage = (watchDuration / totalDuration) * 100;
    
    // Validation checks
    const checks = {
      attentionPassed: attentionScore >= REQUIRED_ATTENTION_SCORE,
      watchDurationPassed: watchPercentage >= REQUIRED_WATCH_PERCENTAGE,
      framesValid: totalFrames >= MIN_FRAMES_REQUIRED,
    };

    const allChecksPassed = checks.attentionPassed && checks.watchDurationPassed && checks.framesValid;

    console.log(`[validate-attention] Checks:`, checks);
    console.log(`[validate-attention] All passed: ${allChecksPassed}`);

    // Log the attention event
    const logEntry = {
      user_id: userId,
      content_id: contentId,
      promo_id: promoId,
      attention_score: attentionScore,
      watch_duration: watchDuration,
      total_duration: totalDuration,
      frames_detected: framesDetected,
      total_frames: totalFrames,
      watch_percentage: watchPercentage,
      validation_passed: allChecksPassed,
      checks: checks,
      validated_at: new Date().toISOString(),
    };

    // For now, just log - in production you'd store this
    console.log(`[validate-attention] Log entry:`, JSON.stringify(logEntry));

    // Response
    const response = {
      success: true,
      validated: allChecksPassed,
      attentionScore,
      watchPercentage: Math.round(watchPercentage),
      checks,
      message: allChecksPassed 
        ? 'Attention validated! Reward eligible.' 
        : 'Attention requirements not met.',
      reasons: !allChecksPassed ? [
        !checks.attentionPassed && `Attention score (${attentionScore}%) below ${REQUIRED_ATTENTION_SCORE}%`,
        !checks.watchDurationPassed && `Watch time (${Math.round(watchPercentage)}%) below ${REQUIRED_WATCH_PERCENTAGE}%`,
        !checks.framesValid && 'Insufficient tracking data',
      ].filter(Boolean) : [],
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[validate-attention] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
