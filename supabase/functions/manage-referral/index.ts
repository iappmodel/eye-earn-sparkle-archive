import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REFERRAL-CODE] ${step}${detailsStr}`);
};

// Generate a unique 8-character referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { action, referral_code } = await req.json();

    if (action === "get_or_create") {
      // Check if user already has a referral code
      const { data: existingCode, error: fetchError } = await supabaseClient
        .from('referral_codes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw new Error(`Failed to fetch referral code: ${fetchError.message}`);

      if (existingCode) {
        logStep("Existing referral code found", { code: existingCode.code });
        return new Response(JSON.stringify({
          code: existingCode.code,
          uses_count: existingCode.uses_count,
          total_earnings: existingCode.total_earnings,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Generate a new unique code
      let newCode = generateReferralCode();
      let attempts = 0;
      while (attempts < 5) {
        const { data: existsCheck } = await supabaseClient
          .from('referral_codes')
          .select('id')
          .eq('code', newCode)
          .maybeSingle();
        
        if (!existsCheck) break;
        newCode = generateReferralCode();
        attempts++;
      }

      const { data: newCodeData, error: insertError } = await supabaseClient
        .from('referral_codes')
        .insert({
          user_id: user.id,
          code: newCode,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to create referral code: ${insertError.message}`);

      logStep("New referral code created", { code: newCode });
      return new Response(JSON.stringify({
        code: newCodeData.code,
        uses_count: 0,
        total_earnings: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "apply") {
      if (!referral_code) throw new Error("Referral code is required");

      // Check if user was already referred
      const { data: existingReferral } = await supabaseClient
        .from('referrals')
        .select('id')
        .eq('referred_id', user.id)
        .maybeSingle();

      if (existingReferral) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "You have already used a referral code" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Find the referral code
      const { data: codeData, error: codeError } = await supabaseClient
        .from('referral_codes')
        .select('*')
        .eq('code', referral_code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (codeError || !codeData) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "Invalid or expired referral code" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Can't use your own code
      if (codeData.user_id === user.id) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "You cannot use your own referral code" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Create the referral relationship
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90); // 90-day commission period

      const { error: referralError } = await supabaseClient
        .from('referrals')
        .insert({
          referrer_id: codeData.user_id,
          referred_id: user.id,
          referral_code: referral_code.toUpperCase(),
          status: 'active',
          commission_rate: 0.10, // 10% of referred user's earnings
          expires_at: expiresAt.toISOString(),
        });

      if (referralError) throw new Error(`Failed to apply referral: ${referralError.message}`);

      // Increment uses count
      await supabaseClient
        .from('referral_codes')
        .update({ uses_count: codeData.uses_count + 1 })
        .eq('id', codeData.id);

      // Update profile with referred_by
      await supabaseClient
        .from('profiles')
        .update({ referred_by: referral_code.toUpperCase() })
        .eq('user_id', user.id);

      logStep("Referral applied successfully", { 
        referrer: codeData.user_id, 
        referred: user.id 
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Referral code applied! You and your referrer will earn bonus rewards." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "get_referrals") {
      const { data: referrals, error: refError } = await supabaseClient
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (refError) throw new Error(`Failed to fetch referrals: ${refError.message}`);

      const totalEarnings = referrals?.reduce((sum, r) => sum + Number(r.earnings_shared), 0) || 0;

      return new Response(JSON.stringify({
        referrals: referrals || [],
        total_referrals: referrals?.length || 0,
        total_earnings: totalEarnings,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
