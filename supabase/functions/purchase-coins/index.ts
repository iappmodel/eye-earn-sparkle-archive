import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coin packages configuration
const COIN_PACKAGES = {
  small: {
    id: 'small',
    coins: 100,
    priceInCents: 99,
    bonus: 0,
    name: '100 iCoins',
  },
  medium: {
    id: 'medium',
    coins: 500,
    priceInCents: 449,
    bonus: 50,
    name: '500 + 50 Bonus iCoins',
  },
  large: {
    id: 'large',
    coins: 1000,
    priceInCents: 799,
    bonus: 200,
    name: '1000 + 200 Bonus iCoins',
  },
  xl: {
    id: 'xl',
    coins: 5000,
    priceInCents: 3499,
    bonus: 1500,
    name: '5000 + 1500 Bonus iCoins',
  },
  mega: {
    id: 'mega',
    coins: 10000,
    priceInCents: 5999,
    bonus: 5000,
    name: '10000 + 5000 Bonus iCoins',
  },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-COINS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { packageId } = await req.json();
    logStep("Package requested", { packageId });

    const pkg = COIN_PACKAGES[packageId as keyof typeof COIN_PACKAGES];
    if (!pkg) {
      return new Response(
        JSON.stringify({ error: "Invalid package ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }
    logStep("Customer check", { customerId: customerId || "new customer" });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: pkg.name,
              description: `Get ${pkg.coins} iCoins${pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ''} for use in the app`,
              images: [],
            },
            unit_amount: pkg.priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/wallet?purchase=success&coins=${pkg.coins + pkg.bonus}`,
      cancel_url: `${req.headers.get("origin")}/wallet?purchase=cancelled`,
      metadata: {
        user_id: user.id,
        package_id: pkg.id,
        coins: pkg.coins.toString(),
        bonus: pkg.bonus.toString(),
        total_coins: (pkg.coins + pkg.bonus).toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ url: session.url, package: pkg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    // Log full error for debugging only
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Return safe generic message to client
    return new Response(
      JSON.stringify({ error: "Unable to process purchase. Please try again." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
