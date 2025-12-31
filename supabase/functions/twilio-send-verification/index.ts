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
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      throw new Error("Twilio credentials not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("User not authenticated");

    const { phoneNumber } = await req.json();
    if (!phoneNumber) throw new Error("Phone number is required");

    // Normalize phone number
    const normalizedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

    console.log("[TWILIO] Sending verification to:", normalizedPhone);

    // Generate a 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store the code temporarily (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Update profile with pending verification
    await supabaseClient
      .from("profiles")
      .update({
        phone_number: normalizedPhone,
        phone_verified: false,
        social_links: {
          pending_verification: {
            code: verificationCode,
            expires_at: expiresAt,
          },
        },
      })
      .eq("user_id", user.id);

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const smsResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizedPhone,
        From: twilioPhone,
        Body: `Your iApp verification code is: ${verificationCode}. This code expires in 10 minutes.`,
      }),
    });

    const smsResult = await smsResponse.json();

    if (smsResult.error_code) {
      console.error("[TWILIO] SMS error:", smsResult);
      throw new Error(smsResult.error_message || "Failed to send SMS");
    }

    console.log("[TWILIO] SMS sent successfully:", smsResult.sid);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification code sent",
        phoneNumber: normalizedPhone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[TWILIO] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
