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

    // Call atomic stored procedure — handles locking, KYC check, balance deduction, and transaction logging
    const { data, error: rpcError } = await supabase.rpc('atomic_request_payout', {
      p_user_id: user.id,
      p_amount: amount,
      p_coin_type: coinType,
      p_method: method,
    });

    if (rpcError) {
      console.error('[RequestPayout] RPC error:', rpcError);
      const msg = rpcError.message || '';

      if (msg.includes('KYC_REQUIRED')) {
        return new Response(
          JSON.stringify({ error: 'KYC verification required before payout' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('INSUFFICIENT_BALANCE')) {
        return new Response(
          JSON.stringify({ error: 'Insufficient balance' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('PROFILE_NOT_FOUND')) {
        return new Response(
          JSON.stringify({ error: 'User profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to process payout');
    }

    console.log('[RequestPayout] Payout initiated:', data);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: data.transaction_id,
        amount: data.amount,
        coin_type: data.coin_type,
        method: data.method,
        status: 'processing',
        estimated_arrival: '3-5 business days',
        new_balance: data.new_balance,
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
