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

    // Call atomic stored procedure — handles locking, balance check, update, and transaction logging
    const { data, error: rpcError } = await supabase.rpc('atomic_convert_coins', {
      p_user_id: user.id,
      p_icoin_amount: icoinAmount,
      p_exchange_rate: EXCHANGE_RATE,
    });

    if (rpcError) {
      console.error('[TransferCoins] RPC error:', rpcError);
      const msg = rpcError.message || '';

      if (msg.includes('INSUFFICIENT_BALANCE')) {
        return new Response(
          JSON.stringify({ error: 'Insufficient Icoin balance', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('PROFILE_NOT_FOUND')) {
        return new Response(
          JSON.stringify({ error: 'User profile not found', success: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to process conversion');
    }

    console.log('[TransferCoins] Success:', data);

    return new Response(
      JSON.stringify({
        success: true,
        icoin_spent: data.icoin_spent,
        vicoin_received: data.vicoin_received,
        new_icoin_balance: data.new_icoin_balance,
        new_vicoin_balance: data.new_vicoin_balance,
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
