import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Payout configuration
const MIN_PAYOUT_AMOUNTS = {
  vicoin: 500,
  icoin: 1000,
};

const PAYOUT_METHODS = ['paypal', 'bank', 'crypto'] as const;

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

    const { amount, coinType, method, payoutDetails } = await req.json();
    console.log('[RequestPayout] Request:', { userId: user.id, amount, coinType, method });

    // Validate inputs
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['vicoin', 'icoin'].includes(coinType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid coin type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!PAYOUT_METHODS.includes(method)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payout method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check minimum payout
    const minAmount = MIN_PAYOUT_AMOUNTS[coinType as keyof typeof MIN_PAYOUT_AMOUNTS];
    if (amount < minAmount) {
      return new Response(
        JSON.stringify({ 
          error: `Minimum payout is ${minAmount} ${coinType}s`,
          minimum: minAmount 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check KYC status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('kyc_status, vicoin_balance, icoin_balance')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('[RequestPayout] Profile error:', profileError);
      throw profileError;
    }

    if (profile.kyc_status !== 'verified') {
      return new Response(
        JSON.stringify({ 
          error: 'KYC verification required before payout',
          kyc_status: profile.kyc_status 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check sufficient balance
    const currentBalance = coinType === 'vicoin' ? profile.vicoin_balance : profile.icoin_balance;
    if (currentBalance < amount) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          current_balance: currentBalance,
          requested: amount 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct from balance
    const balanceColumn = coinType === 'vicoin' ? 'vicoin_balance' : 'icoin_balance';
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [balanceColumn]: currentBalance - amount })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[RequestPayout] Balance update error:', updateError);
      throw updateError;
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'withdrawn',
        coin_type: coinType,
        amount: amount,
        description: `Payout via ${method}`,
        reference_id: `payout_${Date.now()}`,
      })
      .select()
      .single();

    if (txError) {
      console.error('[RequestPayout] Transaction error:', txError);
      // Rollback balance
      await supabase
        .from('profiles')
        .update({ [balanceColumn]: currentBalance })
        .eq('user_id', user.id);
      throw txError;
    }

    // In a real implementation, you would integrate with PayPal/Bank APIs here
    console.log('[RequestPayout] Payout initiated:', { 
      transactionId: transaction.id, 
      method,
      amount,
      coinType 
    });

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        amount,
        coin_type: coinType,
        method,
        status: 'processing',
        estimated_arrival: '3-5 business days',
        new_balance: currentBalance - amount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[RequestPayout] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
