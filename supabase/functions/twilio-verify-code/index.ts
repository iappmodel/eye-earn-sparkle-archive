import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("User not authenticated");

    const { code } = await req.json();
    if (!code) throw new Error("Verification code is required");

    console.log("[TWILIO-VERIFY] Verifying code for user:", user.id);

    // Get the pending verification
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("phone_number, social_links")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");

    const pendingVerification = profile.social_links?.pending_verification;
    if (!pendingVerification) {
      throw new Error("No pending verification found. Please request a new code.");
    }

    // Check if code is expired
    if (new Date(pendingVerification.expires_at) < new Date()) {
      throw new Error("Verification code has expired. Please request a new one.");
    }

    // Verify the code
    if (pendingVerification.code !== code) {
      throw new Error("Invalid verification code");
    }

    // Mark phone as verified and clear pending verification
    const { pending_verification, ...restLinks } = profile.social_links || {};
    await supabaseClient
      .from("profiles")
      .update({
        phone_verified: true,
        social_links: restLinks,
      })
      .eq("user_id", user.id);

    console.log("[TWILIO-VERIFY] Phone verified successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Phone number verified successfully",
        phoneNumber: profile.phone_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[TWILIO-VERIFY] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
