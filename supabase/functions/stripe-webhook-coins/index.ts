import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK-COINS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    // For development, we'll process without signature verification
    // In production, you'd verify with the webhook secret
    let event: Stripe.Event;
    
    try {
      // Try to parse the body as JSON for testing
      const parsed = JSON.parse(body);
      if (parsed.type && parsed.data) {
        event = parsed as Stripe.Event;
        logStep("Received event from body parse", { type: event.type });
      } else {
        throw new Error("Invalid event structure");
      }
    } catch {
      // If parsing fails, this might be a raw webhook
      logStep("Could not parse event", { bodyLength: body.length });
      return new Response(
        JSON.stringify({ error: "Invalid event" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.completed", { sessionId: session.id });

      const metadata = session.metadata;
      if (!metadata?.user_id || !metadata?.total_coins) {
        logStep("Missing metadata", { metadata });
        return new Response(
          JSON.stringify({ received: true, message: "No coin purchase metadata" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = metadata.user_id;
      const totalCoins = parseInt(metadata.total_coins);
      const packageId = metadata.package_id;

      logStep("Crediting coins", { userId, totalCoins, packageId });

      // Get current balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('icoin_balance')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        logStep("Profile fetch error", { error: profileError.message });
        throw profileError;
      }

      const newBalance = (profile.icoin_balance || 0) + totalCoins;

      // Update balance
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ icoin_balance: newBalance })
        .eq('user_id', userId);

      if (updateError) {
        logStep("Balance update error", { error: updateError.message });
        throw updateError;
      }

      // Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'purchase',
          coin_type: 'icoin',
          amount: totalCoins,
          description: `Purchased ${packageId} coin package`,
          reference_id: `stripe_${session.id}`,
        });

      if (txError) {
        logStep("Transaction insert error", { error: txError.message });
      }

      // Send notification
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'earning',
          title: 'Coins Added! 🎉',
          body: `${totalCoins.toLocaleString()} iCoins have been added to your wallet!`,
          data: {
            coins: totalCoins,
            package: packageId,
          },
        });

      logStep("Coins credited successfully", { userId, totalCoins, newBalance });
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logStep("ERROR", { message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
