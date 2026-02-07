import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Daily limits
const DAILY_LIMITS = {
  icoin: 100,
  vicoin: 50,
  promo_views: 20,
};

// Reward amounts by type
const REWARD_AMOUNTS = {
  promo_view: { min: 1, max: 10, coinType: 'icoin' },
  task_complete: { min: 3, max: 20, coinType: 'icoin' },
  referral: { amount: 10, coinType: 'vicoin' },
  milestone: { amount: 20, coinType: 'vicoin' },
  daily_bonus: { min: 1, max: 5, coinType: 'icoin' },
};

const VALID_REWARD_TYPES = Object.keys(REWARD_AMOUNTS) as [string, ...string[]];

const IssueRewardSchema = z.object({
  rewardType: z.enum(VALID_REWARD_TYPES as [string, ...string[]]),
  contentId: z.string().uuid('Invalid content ID'),
  amount: z.number().int().min(1).max(1000).optional(),
  attentionScore: z.number().min(0).max(100).optional(),
  coinType: z.enum(['vicoin', 'icoin']).optional(),
});

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
      console.error('[IssueReward] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input with zod
    const parseResult = IssueRewardSchema.safeParse(await req.json());
    if (!parseResult.success) {
      console.warn('[IssueReward] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { rewardType, contentId, amount, attentionScore, coinType } = parseResult.data;
    console.log('[IssueReward] Request:', { userId: user.id, rewardType, contentId, amount, attentionScore, coinType });

    // Check for replay attack - has this content already been rewarded?
    const { data: existingReward, error: checkError } = await supabase
      .from('reward_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('reward_type', rewardType)
      .maybeSingle();

    if (checkError) {
      console.error('[IssueReward] Check error:', checkError);
      throw checkError;
    }

    if (existingReward) {
      console.log('[IssueReward] Duplicate reward attempt blocked');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Reward already claimed for this content',
          code: 'reward_already_claimed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create today's daily cap record
    const today = new Date().toISOString().split('T')[0];
    let { data: dailyCap, error: capError } = await supabase
      .from('daily_reward_caps')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    if (capError && capError.code !== 'PGRST116') {
      console.error('[IssueReward] Daily cap error:', capError);
      throw capError;
    }

    if (!dailyCap) {
      const { data: newCap, error: insertError } = await supabase
        .from('daily_reward_caps')
        .insert({ user_id: user.id, date: today })
        .select()
        .single();

      if (insertError) {
        console.error('[IssueReward] Insert cap error:', insertError);
        throw insertError;
      }
      dailyCap = newCap;
    }

    // Determine coin type and amount
    const rewardConfig = REWARD_AMOUNTS[rewardType as keyof typeof REWARD_AMOUNTS];
    const finalCoinType = coinType || rewardConfig.coinType;
    let finalAmount = amount;

    if (!finalAmount) {
      if ('amount' in rewardConfig) {
        finalAmount = rewardConfig.amount;
      } else {
        finalAmount = Math.floor(Math.random() * (rewardConfig.max - rewardConfig.min + 1)) + rewardConfig.min;
      }
    }

    // Apply attention score modifier (85-100% = full, below reduces proportionally)
    if (attentionScore !== undefined && attentionScore < 100) {
      const modifier = Math.max(0.5, attentionScore / 100);
      finalAmount = Math.max(1, Math.floor(finalAmount * modifier));
    }

    // Check daily limits
    const earnedToday = finalCoinType === 'icoin' ? dailyCap.icoin_earned : dailyCap.vicoin_earned;
    const limit = DAILY_LIMITS[finalCoinType as keyof typeof DAILY_LIMITS];

    if (earnedToday >= limit) {
      console.log('[IssueReward] Daily limit reached');
      return new Response(
        JSON.stringify({ 
          error: 'Daily limit reached', 
          success: false,
          dailyLimit: limit,
          earnedToday: earnedToday
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check promo view limit
    if (rewardType === 'promo_view' && dailyCap.promo_views >= DAILY_LIMITS.promo_views) {
      console.log('[IssueReward] Promo view limit reached');
      return new Response(
        JSON.stringify({ 
          error: 'Daily promo view limit reached', 
          success: false,
          limit: DAILY_LIMITS.promo_views
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adjust amount if it would exceed daily limit
    const remainingLimit = limit - earnedToday;
    finalAmount = Math.min(finalAmount, remainingLimit);

    // Log the reward
    const { error: logError } = await supabase
      .from('reward_logs')
      .insert({
        user_id: user.id,
        content_id: contentId,
        reward_type: rewardType,
        coin_type: finalCoinType,
        amount: finalAmount,
        attention_score: attentionScore ?? null,
      });

    if (logError) {
      console.error('[IssueReward] Log error:', logError);
      throw logError;
    }

    // Create transaction record
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'earned',
        coin_type: finalCoinType,
        amount: finalAmount,
        description: `Earned from ${rewardType.replace('_', ' ')}`,
        reference_id: contentId,
      });

    if (txError) {
      console.error('[IssueReward] Transaction error:', txError);
      throw txError;
    }

    // Update user's balance atomically — prevents race conditions with advisory lock
    const { data: balanceResult, error: balanceError } = await supabase.rpc('atomic_update_balance', {
      p_user_id: user.id,
      p_amount: finalAmount,
      p_coin_type: finalCoinType,
      p_description: `Earned from ${rewardType.replace('_', ' ')}`,
      p_reference_id: contentId,
    });

    if (balanceError) {
      console.error('[IssueReward] Atomic balance update error:', balanceError);
      throw balanceError;
    }

    const newBalance = balanceResult?.new_balance ?? 0;

    // Update daily caps
    const capUpdates: Record<string, number> = {
      [finalCoinType === 'icoin' ? 'icoin_earned' : 'vicoin_earned']: 
        (finalCoinType === 'icoin' ? dailyCap.icoin_earned : dailyCap.vicoin_earned) + finalAmount,
    };
    
    if (rewardType === 'promo_view') {
      capUpdates.promo_views = dailyCap.promo_views + 1;
    }

    const { error: capUpdateError } = await supabase
      .from('daily_reward_caps')
      .update(capUpdates)
      .eq('id', dailyCap.id);

    if (capUpdateError) {
      console.error('[IssueReward] Cap update error:', capUpdateError);
      throw capUpdateError;
    }

    console.log('[IssueReward] Success:', { 
      userId: user.id, 
      amount: finalAmount, 
      coinType: finalCoinType,
      newBalance
    });

    return new Response(
      JSON.stringify({
        success: true,
        amount: finalAmount,
        coinType: finalCoinType,
        newBalance,
        dailyRemaining: {
          icoin: DAILY_LIMITS.icoin - (finalCoinType === 'icoin' ? dailyCap.icoin_earned + finalAmount : dailyCap.icoin_earned),
          vicoin: DAILY_LIMITS.vicoin - (finalCoinType === 'vicoin' ? dailyCap.vicoin_earned + finalAmount : dailyCap.vicoin_earned),
          promo_views: DAILY_LIMITS.promo_views - (rewardType === 'promo_view' ? dailyCap.promo_views + 1 : dailyCap.promo_views),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[IssueReward] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
