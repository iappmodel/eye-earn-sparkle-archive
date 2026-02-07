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

    // Call atomic stored procedure — handles locking both users, balance transfer, transactions, and notification
    const { data, error: rpcError } = await supabase.rpc('atomic_tip_creator', {
      p_tipper_id: user.id,
      p_creator_id: creatorId,
      p_amount: amount,
      p_coin_type: coinType,
      p_content_id: contentId,
    });

    if (rpcError) {
      console.error('[TipCreator] RPC error:', rpcError);
      const msg = rpcError.message || '';

      if (msg.includes('INSUFFICIENT_BALANCE')) {
        return new Response(
          JSON.stringify({ error: `Insufficient ${coinType} balance`, success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('CREATOR_NOT_FOUND')) {
        return new Response(
          JSON.stringify({ error: 'Creator not found', success: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (msg.includes('TIPPER_NOT_FOUND')) {
        return new Response(
          JSON.stringify({ error: 'User profile not found', success: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to process tip');
    }

    console.log('[TipCreator] Success:', data);

    return new Response(
      JSON.stringify({
        success: true,
        tip_id: data.tip_id,
        amount: data.amount,
        coin_type: data.coin_type,
        new_balance: data.new_balance,
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
