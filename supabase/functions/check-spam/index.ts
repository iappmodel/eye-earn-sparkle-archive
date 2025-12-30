import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configurations per action type
const RATE_LIMITS = {
  comment: { maxCount: 5, windowMinutes: 1 },
  like: { maxCount: 50, windowMinutes: 1 },
  message: { maxCount: 30, windowMinutes: 1 },
  follow: { maxCount: 30, windowMinutes: 5 },
  tip: { maxCount: 20, windowMinutes: 5 },
  report: { maxCount: 5, windowMinutes: 10 },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CHECK-SPAM] ${step}`, details ? JSON.stringify(details) : '');
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

    const { actionType, content, contentId } = await req.json();
    logStep('Checking spam', { userId: user.id, actionType });

    const config = RATE_LIMITS[actionType as keyof typeof RATE_LIMITS];
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Invalid action type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000).toISOString();

    // Check rate limit based on action type
    let recentCount = 0;
    let isDuplicate = false;

    switch (actionType) {
      case 'comment': {
        const { count, data: recentComments } = await supabase
          .from('comments')
          .select('id, content', { count: 'exact' })
          .eq('user_id', user.id)
          .gte('created_at', windowStart);
        
        recentCount = count || 0;
        
        // Check for duplicate content
        if (content && recentComments) {
          isDuplicate = recentComments.some(c => c.content === content);
        }
        break;
      }
      
      case 'like': {
        const { count } = await supabase
          .from('content_likes')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .gte('created_at', windowStart);
        
        recentCount = count || 0;
        break;
      }
      
      case 'message': {
        const { count, data: recentMessages } = await supabase
          .from('messages')
          .select('id, content', { count: 'exact' })
          .eq('sender_id', user.id)
          .gte('created_at', windowStart);
        
        recentCount = count || 0;
        
        // Check for duplicate messages
        if (content && recentMessages) {
          isDuplicate = recentMessages.some(m => m.content === content);
        }
        break;
      }
      
      case 'tip': {
        const { count } = await supabase
          .from('coin_gifts')
          .select('id', { count: 'exact' })
          .eq('sender_id', user.id)
          .gte('created_at', windowStart);
        
        recentCount = count || 0;
        break;
      }
      
      case 'report': {
        const { count } = await supabase
          .from('content_flags')
          .select('id', { count: 'exact' })
          .eq('flagged_by', user.id)
          .gte('created_at', windowStart);
        
        recentCount = count || 0;
        break;
      }
    }

    const isRateLimited = recentCount >= config.maxCount;
    const isSpam = isRateLimited || isDuplicate;

    // Log spam attempts
    if (isSpam) {
      await supabase
        .from('abuse_logs')
        .insert({
          user_id: user.id,
          abuse_type: isDuplicate ? 'duplicate_content' : 'rate_limit_exceeded',
          severity: isDuplicate ? 'low' : 'medium',
          details: {
            action_type: actionType,
            recent_count: recentCount,
            max_allowed: config.maxCount,
            window_minutes: config.windowMinutes,
            is_duplicate: isDuplicate,
          },
        });

      // Update device trust score if exists
      const { data: devices } = await supabase
        .from('device_fingerprints')
        .select('id, trust_score')
        .eq('user_id', user.id)
        .eq('is_trusted', true)
        .limit(1);

      if (devices && devices.length > 0) {
        const newScore = Math.max(0, (devices[0].trust_score || 100) - 5);
        await supabase
          .from('device_fingerprints')
          .update({ trust_score: newScore })
          .eq('id', devices[0].id);
      }

      logStep('Spam detected', { isRateLimited, isDuplicate, recentCount });
    }

    return new Response(
      JSON.stringify({
        allowed: !isSpam,
        isRateLimited,
        isDuplicate,
        recentCount,
        maxAllowed: config.maxCount,
        windowMinutes: config.windowMinutes,
        retryAfterSeconds: isRateLimited ? config.windowMinutes * 60 : 0,
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
