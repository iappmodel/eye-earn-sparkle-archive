import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Suspicious activity thresholds
const SUSPICIOUS_THRESHOLDS = {
  failed_logins_per_hour: 5,
  password_changes_per_day: 2,
  email_changes_per_week: 1,
  unusual_activity_score: 70,
  max_active_sessions: 5,
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[SESSION-SECURITY] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, userId, sessionId, deviceFingerprint, ipAddress, userAgent, details } = await req.json();
    logStep('Processing security action', { action, userId });

    switch (action) {
      case 'check_session': {
        // Validate current session security
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(
            JSON.stringify({ valid: false, reason: 'No authorization' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
          return new Response(
            JSON.stringify({ valid: false, reason: 'Invalid session' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check device trust
        const { data: device } = await supabase
          .from('device_fingerprints')
          .select('trust_score, flagged, flag_reason')
          .eq('user_id', user.id)
          .eq('fingerprint_hash', deviceFingerprint)
          .single();

        if (device?.flagged) {
          logStep('Flagged device detected', { userId: user.id, reason: device.flag_reason });
          return new Response(
            JSON.stringify({ 
              valid: false, 
              reason: 'Device flagged',
              details: device.flag_reason,
              requireReauth: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for suspicious recent activity
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { count: failedLogins } = await supabase
          .from('account_activity_logs')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('activity_type', 'login')
          .eq('status', 'failed')
          .gte('created_at', oneHourAgo);

        if ((failedLogins || 0) >= SUSPICIOUS_THRESHOLDS.failed_logins_per_hour) {
          logStep('Too many failed logins', { userId: user.id, count: failedLogins });
          return new Response(
            JSON.stringify({ 
              valid: false, 
              reason: 'Suspicious activity detected',
              requireReauth: true,
              lockoutMinutes: 30,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            valid: true,
            trustScore: device?.trust_score || 50,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'force_logout': {
        // Force logout user from all sessions except current
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Invalidate all device fingerprints
        const { error: deviceError } = await supabase
          .from('device_fingerprints')
          .update({ 
            is_trusted: false,
            flagged: true,
            flag_reason: 'Forced logout due to suspicious activity',
          })
          .eq('user_id', userId)
          .neq('fingerprint_hash', deviceFingerprint || '');

        if (deviceError) {
          logStep('Error invalidating devices', { error: deviceError.message });
        }

        // Log the security action
        await supabase
          .from('account_activity_logs')
          .insert({
            user_id: userId,
            activity_type: 'forced_logout',
            status: 'success',
            ip_address: ipAddress,
            user_agent: userAgent,
            details: { reason: details?.reason || 'Suspicious activity' },
          });

        // Send notification
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'security',
            title: 'Security Alert ⚠️',
            body: 'You have been logged out of all devices due to suspicious activity. Please review your account security.',
            data: {
              action: 'force_logout',
              timestamp: new Date().toISOString(),
            },
          });

        logStep('Forced logout completed', { userId });

        return new Response(
          JSON.stringify({ success: true, message: 'All sessions invalidated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'report_suspicious': {
        // Report suspicious activity and potentially lock account
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log the suspicious activity
        await supabase
          .from('abuse_logs')
          .insert({
            user_id: userId,
            abuse_type: 'suspicious_activity',
            severity: 'high',
            ip_address: ipAddress,
            user_agent: userAgent,
            device_fingerprint: deviceFingerprint,
            details: details || {},
          });

        // Update device trust score
        if (deviceFingerprint) {
          const { data: device } = await supabase
            .from('device_fingerprints')
            .select('id, trust_score')
            .eq('user_id', userId)
            .eq('fingerprint_hash', deviceFingerprint)
            .single();

          if (device) {
            const newScore = Math.max(0, (device.trust_score || 50) - 25);
            await supabase
              .from('device_fingerprints')
              .update({
                trust_score: newScore,
                flagged: newScore < 20,
                flag_reason: newScore < 20 ? 'Suspicious activity reported' : null,
              })
              .eq('id', device.id);
          }
        }

        // Check if account should be locked
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: suspiciousCount } = await supabase
          .from('abuse_logs')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .eq('abuse_type', 'suspicious_activity')
          .gte('created_at', oneDayAgo);

        const shouldLock = (suspiciousCount || 0) >= 3;

        if (shouldLock) {
          // Force logout all sessions
          await supabase
            .from('device_fingerprints')
            .update({ 
              is_trusted: false,
              flagged: true,
              flag_reason: 'Account locked due to repeated suspicious activity',
            })
            .eq('user_id', userId);

          // Send security notification
          await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              type: 'security',
              title: 'Account Security Lock 🔒',
              body: 'Your account has been temporarily locked due to suspicious activity. Please contact support.',
              data: {
                action: 'account_lock',
                timestamp: new Date().toISOString(),
              },
            });

          logStep('Account locked', { userId, suspiciousCount });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            accountLocked: shouldLock,
            suspiciousCount: suspiciousCount || 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logStep('ERROR', { message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
