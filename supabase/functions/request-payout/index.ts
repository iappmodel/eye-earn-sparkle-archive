import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Optional: use Stripe when STRIPE_SECRET_KEY and STRIPE_PAYOUT_ENABLED are set
// import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Payout configuration
const MIN_PAYOUT_AMOUNTS = {
  vicoin: 500,
  icoin: 1000,
} as const;

const MAX_PAYOUT_AMOUNTS = {
  vicoin: 500_000,
  icoin: 1_000_000,
} as const;

const PAYOUT_METHODS = ["paypal", "bank", "crypto"] as const;
type PayoutMethod = (typeof PAYOUT_METHODS)[number];

// Fee: percentage of amount (e.g. 2%) with optional flat minimum; result rounded down
const PAYOUT_FEE_PERCENT = 2;
const PAYOUT_FEE_MIN = 10; // minimum fee in coins
const PAYOUT_FEE_MAX = 500; // cap fee in coins

// Estimated arrival by method (for UI)
const ESTIMATED_ARRIVAL: Record<PayoutMethod, string> = {
  paypal: "1-3 business days",
  bank: "3-5 business days",
  crypto: "24-48 hours",
};

function computeFee(amount: number): { fee: number; netAmount: number } {
  const rawFee = Math.floor((amount * PAYOUT_FEE_PERCENT) / 100);
  const fee = Math.min(PAYOUT_FEE_MAX, Math.max(PAYOUT_FEE_MIN, rawFee));
  const netAmount = Math.max(0, amount - fee);
  return { fee, netAmount };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: {
      amount?: number;
      coinType?: string;
      method?: string;
      paymentMethodId?: string | null;
      payoutDetails?: Record<string, string>;
    };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount, coinType, method, paymentMethodId, payoutDetails } = body;
    console.log("[RequestPayout] Request:", {
      userId: user.id,
      amount,
      coinType,
      method,
      paymentMethodId,
    });

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["vicoin", "icoin"].includes(coinType)) {
      return new Response(
        JSON.stringify({ error: "Invalid coin type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const methodTyped = method as PayoutMethod;
    if (!PAYOUT_METHODS.includes(methodTyped)) {
      return new Response(
        JSON.stringify({ error: "Invalid payout method" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const minAmount = MIN_PAYOUT_AMOUNTS[coinType as keyof typeof MIN_PAYOUT_AMOUNTS];
    const maxAmount = MAX_PAYOUT_AMOUNTS[coinType as keyof typeof MAX_PAYOUT_AMOUNTS];
    if (amount < minAmount) {
      return new Response(
        JSON.stringify({
          error: `Minimum payout is ${minAmount} ${coinType}s`,
          minimum: minAmount,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (amount > maxAmount) {
      return new Response(
        JSON.stringify({
          error: `Maximum payout is ${maxAmount} ${coinType}s`,
          maximum: maxAmount,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If payment method ID provided, verify it belongs to the user
    let resolvedPaymentMethodId: string | null = null;
    if (paymentMethodId) {
      const { data: pm, error: pmError } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("id", paymentMethodId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (pmError || !pm) {
        return new Response(
          JSON.stringify({ error: "Invalid or unauthorized payment method" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedPaymentMethodId = pm.id;
    }

    // Call atomic stored procedure: locking, KYC, balance deduction, transaction
    const { data, error: rpcError } = await supabase.rpc("atomic_request_payout", {
      p_user_id: user.id,
      p_amount: amount,
      p_coin_type: coinType,
      p_method: methodTyped,
    });

    if (rpcError) {
      console.error("[RequestPayout] RPC error:", rpcError);
      const msg = rpcError.message || "";

      if (msg.includes("KYC_REQUIRED")) {
        return new Response(
          JSON.stringify({ error: "KYC verification required before payout" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg.includes("INSUFFICIENT_BALANCE")) {
        return new Response(
          JSON.stringify({ error: "Insufficient balance" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg.includes("PROFILE_NOT_FOUND")) {
        return new Response(
          JSON.stringify({ error: "User profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to process payout");
    }

    const referenceId = data?.reference_id ?? `payout_${Date.now()}`;
    const { fee, netAmount } = computeFee(amount);

    // Insert payout_requests row so it appears in Payout History and can be updated by webhooks/cron
    const { data: payoutRow, error: insertError } = await supabase
      .from("payout_requests")
      .insert({
        user_id: user.id,
        payment_method_id: resolvedPaymentMethodId,
        amount,
        coin_type: coinType,
        status: "processing",
        fee,
        net_amount: netAmount,
        reference_id: referenceId,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error("[RequestPayout] Insert payout_requests error:", insertError);
      // Payout already deducted; we still return success but log the missing row
    }

    // Optional: Stripe payout when configured (e.g. platform balance or Connect)
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripePayoutEnabled = Deno.env.get("STRIPE_PAYOUT_ENABLED") === "true";
    if (stripeKey && stripePayoutEnabled && payoutRow?.id) {
      try {
        // Example: convert coins to cents (e.g. 1 vicoin = 1 cent) and create payout.
        // In production you would use Stripe Connect connected accounts or your platform balance.
        const centsPerCoin = Number(Deno.env.get("STRIPE_CENTS_PER_COIN")) || 1;
        const amountCents = Math.floor(netAmount * centsPerCoin);
        if (amountCents >= 50) {
          // Stripe minimum payout often 50 cents
          // const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
          // const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          // await stripe.payouts.create({ amount: amountCents, currency: "usd" });
          console.log("[RequestPayout] Stripe payout skipped (configure STRIPE_CONNECT_ACCOUNT_ID or use cron). Amount cents:", amountCents);
        }
      } catch (stripeErr) {
        console.error("[RequestPayout] Stripe optional payout error:", stripeErr);
        // Do not fail the request; payout request is recorded
      }
    }

    console.log("[RequestPayout] Payout initiated:", {
      payoutRequestId: payoutRow?.id,
      transactionId: data?.transaction_id,
      referenceId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        payout_request_id: payoutRow?.id ?? null,
        transaction_id: data?.transaction_id,
        amount,
        coin_type: coinType,
        method: methodTyped,
        fee,
        net_amount: netAmount,
        status: "processing",
        reference_id: referenceId,
        estimated_arrival: ESTIMATED_ARRIVAL[methodTyped],
        new_balance: data?.new_balance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[RequestPayout] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
