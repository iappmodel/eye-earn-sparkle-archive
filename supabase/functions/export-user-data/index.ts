import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { requestType } = await req.json();
    console.log('[ExportData] Request:', { userId: user.id, requestType });

    if (requestType === 'export') {
      // Gather all user data for GDPR export
      const userData: Record<string, unknown> = {};

      // Profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      userData.profile = profile;

      // Transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      userData.transactions = transactions;

      // Reward logs
      const { data: rewards } = await supabase
        .from('reward_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      userData.rewards = rewards;

      // Content interactions
      const { data: interactions } = await supabase
        .from('content_interactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      userData.content_interactions = interactions;

      // Privacy consents
      const { data: consents } = await supabase
        .from('privacy_consents')
        .select('*')
        .eq('user_id', user.id);
      userData.privacy_consents = consents;

      // User levels
      const { data: levels } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .single();
      userData.level_data = levels;

      // Achievements
      const { data: achievements } = await supabase
        .from('user_achievements')
        .select('*, achievements(*)')
        .eq('user_id', user.id);
      userData.achievements = achievements;

      // Tasks
      const { data: tasks } = await supabase
        .from('user_tasks')
        .select('*, task_templates(*)')
        .eq('user_id', user.id);
      userData.tasks = tasks;

      // Notification preferences
      const { data: notifPrefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      userData.notification_preferences = notifPrefs;

      // Messages (without content for privacy)
      const { data: messageCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id);
      userData.message_count = messageCount;

      // Devices
      const { data: devices } = await supabase
        .from('device_fingerprints')
        .select('first_seen_at, last_seen_at, is_trusted')
        .eq('user_id', user.id);
      userData.devices = devices;

      // Add metadata
      userData.export_metadata = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        gdpr_article: 'Article 20 - Right to data portability',
      };

      // Update export request status
      await supabase
        .from('data_export_requests')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
        .eq('user_id', user.id)
        .eq('status', 'pending');

      console.log('[ExportData] Export completed for:', user.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: userData,
          message: 'Your data export is ready. This link expires in 7 days.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[ExportData] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
