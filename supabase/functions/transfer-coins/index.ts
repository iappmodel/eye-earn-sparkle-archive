import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Exchange rates (Icoins to Vicoins)
const EXCHANGE_RATE = 10; // 10 Icoins = 1 Vicoin
const MIN_ICOIN_TRANSFER = 100;
const MAX_ICOIN_TRANSFER = 100000;

const TransferCoinsSchema = z.object({
  icoinAmount: z.number().int('Amount must be a whole number')
    .min(MIN_ICOIN_TRANSFER, `Minimum transfer is ${MIN_ICOIN_TRANSFER} Icoins`)
    .max(MAX_ICOIN_TRANSFER, `Maximum transfer is ${MAX_ICOIN_TRANSFER} Icoins`)
    .refine(val => val % EXCHANGE_RATE === 0, {
      message: `Amount must be divisible by ${EXCHANGE_RATE}`,
    }),
});

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

    // Validate input with zod
    const parseResult = TransferCoinsSchema.safeParse(await req.json());
    if (!parseResult.success) {
      console.warn('[TransferCoins] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { icoinAmount } = parseResult.data;
    console.log('[TransferCoins] Request:', { userId: user.id, icoinAmount });

    // Get current balances
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('icoin_balance, vicoin_balance')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('[TransferCoins] Profile error:', profileError);
      throw profileError;
    }

    // Check sufficient Icoin balance
    if (profile.icoin_balance < icoinAmount) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient Icoin balance',
          current_balance: profile.icoin_balance,
          requested: icoinAmount 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vicoinAmount = Math.floor(icoinAmount / EXCHANGE_RATE);
    const newIcoinBalance = profile.icoin_balance - icoinAmount;
    const newVicoinBalance = profile.vicoin_balance + vicoinAmount;

    // Update balances
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        icoin_balance: newIcoinBalance,
        vicoin_balance: newVicoinBalance,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[TransferCoins] Update error:', updateError);
      throw updateError;
    }

    // Create transaction records
    const transferId = `transfer_${Date.now()}`;
    
    await supabase.from('transactions').insert([
      {
        user_id: user.id,
        type: 'spent',
        coin_type: 'icoin',
        amount: icoinAmount,
        description: `Converted to ${vicoinAmount} Vicoins`,
        reference_id: transferId,
      },
      {
        user_id: user.id,
        type: 'earned',
        coin_type: 'vicoin',
        amount: vicoinAmount,
        description: `Converted from ${icoinAmount} Icoins`,
        reference_id: transferId,
      },
    ]);

    console.log('[TransferCoins] Success:', { 
      icoinSpent: icoinAmount, 
      vicoinReceived: vicoinAmount 
    });

    return new Response(
      JSON.stringify({
        success: true,
        icoin_spent: icoinAmount,
        vicoin_received: vicoinAmount,
        new_icoin_balance: newIcoinBalance,
        new_vicoin_balance: newVicoinBalance,
        exchange_rate: EXCHANGE_RATE,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[TransferCoins] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
