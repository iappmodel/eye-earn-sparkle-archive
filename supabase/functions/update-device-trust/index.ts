import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Trust score factors
const TRUST_FACTORS = {
  // Positive factors
  successful_login: 2,
  completed_purchase: 5,
  verified_email: 10,
  completed_kyc: 20,
  long_session: 1, // > 30 min active session
  consistent_location: 3,
  
  // Negative factors
  failed_login: -5,
  suspicious_activity: -15,
  spam_detected: -10,
  rate_limit_exceeded: -5,
  unusual_location: -10,
  rapid_account_changes: -8,
  multiple_devices_short_time: -12,
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[UPDATE-DEVICE-TRUST] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { 
      deviceFingerprint, 
      event, 
      deviceInfo,
      ipAddress,
      userAgent 
    } = await req.json();

    logStep('Processing trust update', { userId: user.id, event });

    // Get or create device fingerprint record
    let { data: device } = await supabase
      .from('device_fingerprints')
      .select('*')
      .eq('user_id', user.id)
      .eq('fingerprint_hash', deviceFingerprint)
      .single();

    if (!device) {
      // Create new device record
      const { data: newDevice, error: createError } = await supabase
        .from('device_fingerprints')
        .insert({
          user_id: user.id,
          fingerprint_hash: deviceFingerprint,
          device_info: deviceInfo || {},
          trust_score: 50, // Start with neutral score
          is_trusted: true,
        })
        .select()
        .single();

      if (createError) {
        logStep('Error creating device', { error: createError.message });
        throw createError;
      }
      
      device = newDevice;
      logStep('New device registered', { deviceId: device.id });
    }

    // Calculate score adjustment
    const adjustment = TRUST_FACTORS[event as keyof typeof TRUST_FACTORS] || 0;
    let newScore = Math.max(0, Math.min(100, (device.trust_score || 50) + adjustment));

    // Additional scoring factors
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check for abuse patterns
    const { count: abuseCount } = await supabase
      .from('abuse_logs')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', oneDayAgo);

    if ((abuseCount || 0) > 3) {
      newScore = Math.max(0, newScore - 10);
      logStep('Abuse pattern detected', { abuseCount });
    }

    // Check for multiple devices in short time
    const { count: deviceCount } = await supabase
      .from('device_fingerprints')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('first_seen_at', oneDayAgo);

    if ((deviceCount || 0) > 3) {
      newScore = Math.max(0, newScore - 15);
      logStep('Multiple devices detected', { deviceCount });
    }

    // Determine trust status
    const isTrusted = newScore >= 30;
    const isFlagged = newScore < 20;
    let flagReason = null;

    if (isFlagged) {
      flagReason = newScore < 10 ? 'Very low trust score' : 'Low trust score';
    }

    // Update device record
    const { error: updateError } = await supabase
      .from('device_fingerprints')
      .update({
        trust_score: newScore,
        is_trusted: isTrusted,
        flagged: isFlagged,
        flag_reason: flagReason,
        last_seen_at: new Date().toISOString(),
        device_info: deviceInfo || device.device_info,
      })
      .eq('id', device.id);

    if (updateError) {
      logStep('Error updating device', { error: updateError.message });
      throw updateError;
    }

    // Log activity
    await supabase
      .from('account_activity_logs')
      .insert({
        user_id: user.id,
        activity_type: 'device_trust_update',
        status: 'success',
        ip_address: ipAddress,
        user_agent: userAgent,
        details: {
          event,
          previous_score: device.trust_score,
          new_score: newScore,
          adjustment,
          device_id: device.id,
        },
      });

    logStep('Trust score updated', { 
      previousScore: device.trust_score, 
      newScore, 
      isTrusted, 
      isFlagged 
    });

    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.id,
        trust_score: newScore,
        is_trusted: isTrusted,
        is_flagged: isFlagged,
        flag_reason: flagReason,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logStep('ERROR', { message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
