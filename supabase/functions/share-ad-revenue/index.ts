import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Revenue share configuration
const CREATOR_REVENUE_SHARE = 0.55; // 55% to creator
const PLATFORM_REVENUE_SHARE = 0.45; // 45% to platform
const MIN_VIEWS_FOR_PAYOUT = 100;
const COINS_PER_PROMO_VIEW = 2; // Base coins per promo view

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contentId, creatorId, promoViewCount, attentionScore } = await req.json();
    console.log('[AdRevenueShare] Processing:', { contentId, creatorId, promoViewCount, attentionScore });

    if (!contentId || !creatorId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if content has minimum views
    if (promoViewCount < MIN_VIEWS_FOR_PAYOUT) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `Minimum ${MIN_VIEWS_FOR_PAYOUT} promo views required`,
          current_views: promoViewCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate revenue based on views and attention
    const attentionMultiplier = 1 + ((attentionScore || 70) / 100);
    const totalRevenue = promoViewCount * COINS_PER_PROMO_VIEW * attentionMultiplier;
    const creatorShare = Math.floor(totalRevenue * CREATOR_REVENUE_SHARE);
    const platformShare = Math.floor(totalRevenue * PLATFORM_REVENUE_SHARE);

    console.log('[AdRevenueShare] Revenue calculation:', {
      totalRevenue,
      creatorShare,
      platformShare,
      attentionMultiplier,
    });

    // Check if already paid for this content
    const { data: existingPayout } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference_id', `ad_revenue_${contentId}`)
      .eq('user_id', creatorId)
      .single();

    if (existingPayout) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Revenue already shared for this content',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Credit creator's balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('vicoin_balance')
      .eq('user_id', creatorId)
      .single();

    if (profileError) {
      console.error('[AdRevenueShare] Profile error:', profileError);
      throw profileError;
    }

    const newBalance = (profile.vicoin_balance || 0) + creatorShare;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ vicoin_balance: newBalance })
      .eq('user_id', creatorId);

    if (updateError) {
      console.error('[AdRevenueShare] Balance update error:', updateError);
      throw updateError;
    }

    // Create transaction record
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: creatorId,
        type: 'earning',
        coin_type: 'vicoin',
        amount: creatorShare,
        description: `Ad revenue share for ${promoViewCount} promo views`,
        reference_id: `ad_revenue_${contentId}`,
      });

    if (txError) {
      console.error('[AdRevenueShare] Transaction error:', txError);
      throw txError;
    }

    // Create reward log
    await supabase
      .from('reward_logs')
      .insert({
        user_id: creatorId,
        reward_type: 'ad_revenue',
        content_id: contentId,
        amount: creatorShare,
        coin_type: 'vicoin',
        attention_score: attentionScore,
      });

    // Send notification
    await supabase
      .from('notifications')
      .insert({
        user_id: creatorId,
        type: 'earning',
        title: 'Ad Revenue Earned! 💰',
        body: `You earned ${creatorShare} Vicoins from ${promoViewCount} promo views!`,
        data: {
          content_id: contentId,
          amount: creatorShare,
          views: promoViewCount,
        },
      });

    console.log('[AdRevenueShare] Success:', { creatorId, creatorShare, newBalance });

    return new Response(
      JSON.stringify({
        success: true,
        creator_share: creatorShare,
        platform_share: platformShare,
        total_revenue: totalRevenue,
        promo_views: promoViewCount,
        new_balance: newBalance,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[AdRevenueShare] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
