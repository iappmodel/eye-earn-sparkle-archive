import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("User not authenticated");

    console.log("[STRIPE-CONNECT] Starting onboarding for user:", user.id);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if user already has a connected account
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("social_links")
      .eq("user_id", user.id)
      .single();

    let accountId = profile?.social_links?.stripe_connect_id;

    if (!accountId) {
      // Create new Connect account
      console.log("[STRIPE-CONNECT] Creating new Connect account");
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        metadata: { user_id: user.id },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      // Store the account ID
      const currentLinks = profile?.social_links || {};
      await supabaseClient
        .from("profiles")
        .update({
          social_links: { ...currentLinks, stripe_connect_id: accountId },
        })
        .eq("user_id", user.id);

      console.log("[STRIPE-CONNECT] Created account:", accountId);
    }

    // Create account link for onboarding
    const origin = req.headers.get("origin") || "https://lovable.dev";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/earnings?refresh=true`,
      return_url: `${origin}/earnings?success=true`,
      type: "account_onboarding",
    });

    console.log("[STRIPE-CONNECT] Generated onboarding link");

    return new Response(JSON.stringify({ url: accountLink.url, accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[STRIPE-CONNECT] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
