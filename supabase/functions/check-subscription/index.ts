import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product ID to tier mapping (tier name and reward multiplier)
const PRODUCT_TIERS: Record<string, { tier: string; tier_name: string; reward_multiplier: number }> = {
  "prod_TgTDyU5HXIH8hh": { tier: "pro", tier_name: "Pro", reward_multiplier: 2 },
  "prod_TgTDRhBdlgafaX": { tier: "creator", tier_name: "Creator", reward_multiplier: 3 },
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    const freePayload = () => ({
      subscribed: false,
      tier: "free",
      tier_name: "Free",
      reward_multiplier: 1,
      subscription_end: null,
      trial_end: null,
      cancel_at_period_end: false,
      current_period_start: null,
    });

    if (!authHeader) {
      return new Response(JSON.stringify(freePayload()), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      logStep("Auth failed, returning free tier");
      return new Response(JSON.stringify(freePayload()), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify(freePayload()), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Include both active and trialing subscriptions
    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
    ]);
    const subscription = activeSubs.data[0] ?? trialingSubs.data[0];
    const hasActiveSub = !!subscription;

    let tier = "free";
    let tierName = "Free";
    let subscriptionEnd: string | null = null;
    let trialEnd: string | null = null;
    let currentPeriodStart: string | null = null;
    let cancelAtPeriodEnd = false;
    let rewardMultiplier = 1;
    let productId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (hasActiveSub && subscription.items?.data?.length) {
      const productIdRaw = subscription.items.data[0].price.product as string;
      productId = productIdRaw;
      const t = PRODUCT_TIERS[productIdRaw] ?? { tier: "pro", tier_name: "Pro", reward_multiplier: 2 };
      tier = t.tier;
      tierName = t.tier_name;
      rewardMultiplier = t.reward_multiplier;
      subscriptionEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
      trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
      currentPeriodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null;
      cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
      stripeSubscriptionId = subscription.id;

      logStep("Active subscription found", { subscriptionId: subscription.id, tier, endDate: subscriptionEnd });

      // Upsert subscription_status for fast reads and webhook consistency
      const { error: upsertError } = await supabaseClient.from("subscription_status").upsert(
        {
          user_id: user.id,
          is_subscribed: true,
          product_id: productId,
          tier,
          subscription_end: subscriptionEnd,
          stripe_customer_id: customerId,
          reward_multiplier: rewardMultiplier,
          trial_end: trialEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          current_period_start: currentPeriodStart,
          stripe_subscription_id: stripeSubscriptionId,
        },
        { onConflict: "user_id" }
      );
      if (upsertError) logStep("Upsert subscription_status failed", { error: upsertError.message });
    } else {
      logStep("No active subscription");
      // Ensure DB reflects no subscription
      await supabaseClient.from("subscription_status").upsert(
        {
          user_id: user.id,
          is_subscribed: false,
          product_id: null,
          tier: "free",
          subscription_end: null,
          stripe_customer_id: customers.data[0].id,
          reward_multiplier: 1,
          trial_end: null,
          cancel_at_period_end: false,
          current_period_start: null,
          stripe_subscription_id: null,
        },
        { onConflict: "user_id" }
      );
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        tier,
        tier_name: tierName,
        subscription_end: subscriptionEnd,
        reward_multiplier: rewardMultiplier,
        trial_end: trialEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_start: currentPeriodStart,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
