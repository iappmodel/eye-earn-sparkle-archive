import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getTierFromProduct, PRODUCT_TIERS } from "./tier.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsHeaders = cors.ok ? cors.headers : { "Content-Type": "application/json" };
  if (!cors.ok) return cors.response;
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors.headers });
  }

  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET");
  if (!signature || !webhookSecret) {
    logStep("Missing signature or webhook secret");
    return new Response("Bad configuration", { status: 500, headers: corsHeaders });
  }

  const body = await req.text();
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Webhook signature verification failed", { error: msg });
    return new Response(`Webhook Error: ${msg}`, { status: 400, headers: corsHeaders });
  }

  logStep("Event received", { id: event.id, type: event.type });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = (sub.metadata?.user_id as string) || null;

    // user_id is set on subscription via subscription_data.metadata in create-checkout
    if (!userId) {
      logStep("No user_id for subscription, skipping upsert", { subscriptionId: sub.id });
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isDeleted = event.type === "customer.subscription.deleted" || sub.status === "canceled" || sub.status === "unpaid";
    let isActive = !isDeleted && (sub.status === "active" || sub.status === "trialing");

    let tier = "free";
    let tierName = "Free";
    let productId: string | null = null;
    let rewardMultiplier = 1;
    let subscriptionEnd: string | null = null;
    let trialEnd: string | null = null;
    let currentPeriodStart: string | null = null;
    let cancelAtPeriodEnd = false;
    let stripeCustomerId: string | null = null;

    const knownProductIds = Object.keys(PRODUCT_TIERS);
    if (isActive && sub.items?.data?.length) {
      const item = sub.items.data[0];
      const pid = (item.price?.product as string) ?? "";
      productId = pid;
      const t = getTierFromProduct(pid);
      tier = t.tier;
      tierName = t.tier_name;
      rewardMultiplier = t.reward_multiplier;
      subscriptionEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
      currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
      cancelAtPeriodEnd = !!sub.cancel_at_period_end;
      stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      // Unknown product id → reject paid benefit: do not mark as subscribed
      if (!knownProductIds.includes(pid)) {
        logStep("Unknown product id: rejecting active subscription (free only)", { productId: pid });
        isActive = false;
      }
    }

    const row = {
      user_id: userId,
      is_subscribed: isActive,
      product_id: productId,
      tier,
      subscription_end: subscriptionEnd,
      stripe_customer_id: stripeCustomerId,
      reward_multiplier: rewardMultiplier,
      trial_end: trialEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_start: currentPeriodStart,
      stripe_subscription_id: isActive ? sub.id : null,
    };

    const { error } = await supabase.from("subscription_status").upsert(row, {
      onConflict: "user_id",
      ignoreDuplicates: false,
    });

    if (error) {
      logStep("Upsert subscription_status failed", { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    logStep("Subscription status synced", { userId, tier, isActive });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
