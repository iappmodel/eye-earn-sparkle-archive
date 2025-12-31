import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// iCoin to USD conversion rate (1000 iCoins = $1 USD)
const ICOIN_TO_USD_RATE = 0.001;
const MINIMUM_PAYOUT_ICOINS = 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("User not authenticated");

    console.log("[STRIPE-PAYOUT] Processing payout request for user:", user.id, "amount:", amount);

    if (!amount || amount < MINIMUM_PAYOUT_ICOINS) {
      throw new Error(`Minimum payout is ${MINIMUM_PAYOUT_ICOINS} iCoins`);
    }

    // Get user profile and verify balance
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("icoin_balance, social_links")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");
    if ((profile.icoin_balance || 0) < amount) throw new Error("Insufficient balance");

    const stripeConnectId = profile.social_links?.stripe_connect_id;
    if (!stripeConnectId) throw new Error("Please complete Stripe Connect onboarding first");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Verify the connected account is ready for payouts
    const account = await stripe.accounts.retrieve(stripeConnectId);
    if (!account.payouts_enabled) {
      throw new Error("Your Stripe account is not yet ready for payouts. Please complete onboarding.");
    }

    // Calculate USD amount (in cents)
    const usdAmount = Math.floor(amount * ICOIN_TO_USD_RATE * 100);

    // Create a transfer to the connected account
    const transfer = await stripe.transfers.create({
      amount: usdAmount,
      currency: "usd",
      destination: stripeConnectId,
      metadata: {
        user_id: user.id,
        icoin_amount: amount.toString(),
      },
    });

    console.log("[STRIPE-PAYOUT] Transfer created:", transfer.id);

    // Deduct iCoins from user's balance
    await supabaseClient
      .from("profiles")
      .update({
        icoin_balance: (profile.icoin_balance || 0) - amount,
      })
      .eq("user_id", user.id);

    // Record the payout request
    await supabaseClient.from("payout_requests").insert({
      user_id: user.id,
      amount,
      coin_type: "icoin",
      status: "completed",
      reference_id: transfer.id,
      net_amount: usdAmount / 100,
      processed_at: new Date().toISOString(),
    });

    // Record transaction
    await supabaseClient.from("transactions").insert({
      user_id: user.id,
      amount: -amount,
      coin_type: "icoin",
      type: "payout",
      description: `Payout of ${amount} iCoins ($${(usdAmount / 100).toFixed(2)})`,
      reference_id: transfer.id,
    });

    console.log("[STRIPE-PAYOUT] Payout completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        transferId: transfer.id,
        icoinsDeducted: amount,
        usdAmount: usdAmount / 100,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[STRIPE-PAYOUT] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
