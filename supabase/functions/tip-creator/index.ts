import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TipCreatorSchema = z.object({
  contentId: z.string().uuid('Invalid content ID'),
  creatorId: z.string().uuid('Invalid creator ID'),
  amount: z.number().int().min(1).max(10000),
  coinType: z.enum(['vicoin', 'icoin']),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input with zod
    const parseResult = TipCreatorSchema.safeParse(await req.json());
    if (!parseResult.success) {
      console.warn('[TipCreator] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors, success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contentId, creatorId, amount, coinType } = parseResult.data;
    console.log('[TipCreator] Request:', { userId: user.id, contentId, creatorId, amount, coinType });

    if (user.id === creatorId) {
      return new Response(
        JSON.stringify({ error: 'Cannot tip yourself', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tipper's balance
    const { data: tipperProfile, error: tipperError } = await supabase
      .from('profiles')
      .select('vicoin_balance, icoin_balance')
      .eq('user_id', user.id)
      .single();

    if (tipperError) {
      console.error('[TipCreator] Tipper profile error:', tipperError);
      return new Response(
        JSON.stringify({ error: 'Failed to get your balance', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tipperBalance = coinType === 'vicoin' 
      ? (tipperProfile.vicoin_balance ?? 0)
      : (tipperProfile.icoin_balance ?? 0);

    if (tipperBalance < amount) {
      return new Response(
        JSON.stringify({ 
          error: `Insufficient ${coinType} balance`,
          current_balance: tipperBalance,
          requested: amount,
          success: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get creator's profile to verify they exist
    const { data: creatorProfile, error: creatorError } = await supabase
      .from('profiles')
      .select('vicoin_balance, icoin_balance')
      .eq('user_id', creatorId)
      .single();

    if (creatorError || !creatorProfile) {
      console.error('[TipCreator] Creator profile error:', creatorError);
      return new Response(
        JSON.stringify({ error: 'Creator not found', success: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creatorBalance = coinType === 'vicoin'
      ? (creatorProfile.vicoin_balance ?? 0)
      : (creatorProfile.icoin_balance ?? 0);

    const balanceColumn = coinType === 'vicoin' ? 'vicoin_balance' : 'icoin_balance';

    // Deduct from tipper
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ [balanceColumn]: tipperBalance - amount })
      .eq('user_id', user.id);

    if (deductError) {
      console.error('[TipCreator] Deduct error:', deductError);
      return new Response(
        JSON.stringify({ error: 'Failed to process tip', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to creator
    const { error: addError } = await supabase
      .from('profiles')
      .update({ [balanceColumn]: creatorBalance + amount })
      .eq('user_id', creatorId);

    if (addError) {
      console.error('[TipCreator] Add error:', addError);
      // Rollback tipper's deduction
      await supabase
        .from('profiles')
        .update({ [balanceColumn]: tipperBalance })
        .eq('user_id', user.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to complete tip', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create transaction records
    const tipId = `tip_${Date.now()}`;
    
    await supabase.from('transactions').insert([
      {
        user_id: user.id,
        type: 'spent',
        coin_type: coinType,
        amount: amount,
        description: `Tip to creator for content`,
        reference_id: tipId,
      },
      {
        user_id: creatorId,
        type: 'earned',
        coin_type: coinType,
        amount: amount,
        description: `Tip received from viewer`,
        reference_id: tipId,
      },
    ]);

    // Create notification for creator
    await supabase.from('notifications').insert({
      user_id: creatorId,
      type: 'earnings',
      title: 'You received a tip!',
      body: `Someone tipped you ${amount} ${coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}`,
      data: { tipId, amount, coinType, contentId },
    });

    console.log('[TipCreator] Success:', { tipId, amount, coinType });

    return new Response(
      JSON.stringify({
        success: true,
        tip_id: tipId,
        amount,
        coin_type: coinType,
        new_balance: tipperBalance - amount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[TipCreator] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
