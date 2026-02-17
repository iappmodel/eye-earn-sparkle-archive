import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXCHANGE_RATE = 10; // 10 Icoins = 1 Vicoin (and 1 Vicoin = 10 Icoins)

// Icoin → Vicoin: amount in Icoins, must be multiple of 10
const MIN_ICOIN_CONVERT = 100;
const MAX_ICOIN_CONVERT = 100000;

// Vicoin → Icoin: amount in Vicoins
const MIN_VICOIN_CONVERT = 1;
const MAX_VICOIN_CONVERT = 10000;

const DirectionEnum = z.enum(['icoin_to_vicoin', 'vicoin_to_icoin']);

const TransferCoinsSchema = z.object({
  direction: DirectionEnum.optional(),
  amount: z.number().int().optional(),
  // Legacy: icoinAmount implies direction icoin_to_vicoin
  icoinAmount: z.number().int().optional(),
}).transform((raw) => {
  if (raw.icoinAmount != null) {
    return { direction: 'icoin_to_vicoin' as const, amount: raw.icoinAmount };
  }
  return { direction: raw.direction ?? 'icoin_to_vicoin', amount: raw.amount ?? 0 };
}).pipe(z.object({
  direction: DirectionEnum,
  amount: z.number().int('Amount must be a whole number'),
}).refine(
  (data) => {
    if (data.direction === 'icoin_to_vicoin') {
      return data.amount >= MIN_ICOIN_CONVERT && data.amount <= MAX_ICOIN_CONVERT && data.amount % EXCHANGE_RATE === 0;
    }
    return data.amount >= MIN_VICOIN_CONVERT && data.amount <= MAX_VICOIN_CONVERT;
  },
  (data) => ({
    message: data.direction === 'icoin_to_vicoin'
      ? `Icoins must be between ${MIN_ICOIN_CONVERT} and ${MAX_ICOIN_CONVERT}, divisible by ${EXCHANGE_RATE}`
      : `Vicoins must be between ${MIN_VICOIN_CONVERT} and ${MAX_VICOIN_CONVERT}`,
    path: ['amount'],
  })
);

type TransferDirection = z.infer<typeof DirectionEnum>;

function getLimits(direction: TransferDirection) {
  if (direction === 'icoin_to_vicoin') {
    return { min: MIN_ICOIN_CONVERT, max: MAX_ICOIN_CONVERT, sourceCurrency: 'icoin', targetCurrency: 'vicoin' };
  }
  return { min: MIN_VICOIN_CONVERT, max: MAX_VICOIN_CONVERT, sourceCurrency: 'vicoin', targetCurrency: 'icoin' };
}

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

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = TransferCoinsSchema.safeParse(body);
    if (!parseResult.success) {
      const flattened = parseResult.error.flatten();
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          success: false,
          details: flattened.fieldErrors,
          limits: getLimits((body as { direction?: TransferDirection })?.direction ?? 'icoin_to_vicoin'),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { direction, amount } = parseResult.data;
    console.log('[TransferCoins] Request:', { userId: user.id, direction, amount });

    if (direction === 'icoin_to_vicoin') {
      const { data, error: rpcError } = await supabase.rpc('atomic_convert_coins', {
        p_user_id: user.id,
        p_icoin_amount: amount,
        p_exchange_rate: EXCHANGE_RATE,
      });

      if (rpcError) {
        console.error('[TransferCoins] RPC error:', rpcError);
        const msg = rpcError.message || '';
        if (msg.includes('INSUFFICIENT_BALANCE')) {
          return new Response(
            JSON.stringify({
              error: 'Insufficient Icoin balance',
              code: 'INSUFFICIENT_BALANCE',
              success: false,
              limits: getLimits('icoin_to_vicoin'),
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (msg.includes('PROFILE_NOT_FOUND')) {
          return new Response(
            JSON.stringify({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND', success: false }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: 'Conversion failed', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          direction: 'icoin_to_vicoin',
          source_spent: data.icoin_spent,
          target_received: data.vicoin_received,
          new_icoin_balance: data.new_icoin_balance,
          new_vicoin_balance: data.new_vicoin_balance,
          exchange_rate: EXCHANGE_RATE,
          transfer_id: data.transfer_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // vicoin_to_icoin
    const { data, error: rpcError } = await supabase.rpc('atomic_convert_vicoin_to_icoin', {
      p_user_id: user.id,
      p_vicoin_amount: amount,
      p_exchange_rate: EXCHANGE_RATE,
    });

    if (rpcError) {
      console.error('[TransferCoins] RPC error:', rpcError);
      const msg = rpcError.message || '';
      if (msg.includes('INSUFFICIENT_BALANCE')) {
        return new Response(
          JSON.stringify({
            error: 'Insufficient Vicoin balance',
            code: 'INSUFFICIENT_BALANCE',
            success: false,
            limits: getLimits('vicoin_to_icoin'),
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('PROFILE_NOT_FOUND')) {
        return new Response(
          JSON.stringify({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND', success: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Conversion failed', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        direction: 'vicoin_to_icoin',
        source_spent: data.vicoin_spent,
        target_received: data.icoin_received,
        new_vicoin_balance: data.new_vicoin_balance,
        new_icoin_balance: data.new_icoin_balance,
        exchange_rate: EXCHANGE_RATE,
        transfer_id: data.transfer_id,
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
