import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verification thresholds
const VERIFICATION_THRESHOLDS = {
  followers: 10000,       // Minimum followers
  posts: 10,              // Minimum published posts
  engagement_rate: 2,     // Minimum engagement rate (%)
  account_age_days: 30,   // Minimum account age
  kyc_required: true,     // KYC must be approved
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, checkOnly } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Verification] Checking eligibility for user: ${userId}`);

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    // Already verified
    if (profile.is_verified) {
      return new Response(
        JSON.stringify({
          success: true,
          eligible: true,
          already_verified: true,
          message: "User is already verified"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check criteria
    const criteria: { name: string; met: boolean; current: any; required: any }[] = [];

    // 1. Follower count
    const followers = profile.followers_count || 0;
    criteria.push({
      name: 'followers',
      met: followers >= VERIFICATION_THRESHOLDS.followers,
      current: followers,
      required: VERIFICATION_THRESHOLDS.followers
    });

    // 2. Published posts count
    const { count: postsCount } = await supabase
      .from('user_content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'published');

    criteria.push({
      name: 'posts',
      met: (postsCount || 0) >= VERIFICATION_THRESHOLDS.posts,
      current: postsCount || 0,
      required: VERIFICATION_THRESHOLDS.posts
    });

    // 3. Calculate engagement rate
    const { data: contentStats } = await supabase
      .from('user_content')
      .select('views_count, likes_count, comments_count, shares_count')
      .eq('user_id', userId)
      .eq('status', 'published');

    let totalViews = 0;
    let totalEngagements = 0;
    (contentStats || []).forEach(c => {
      totalViews += c.views_count || 0;
      totalEngagements += (c.likes_count || 0) + (c.comments_count || 0) + (c.shares_count || 0);
    });

    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;
    criteria.push({
      name: 'engagement_rate',
      met: engagementRate >= VERIFICATION_THRESHOLDS.engagement_rate,
      current: Math.round(engagementRate * 100) / 100,
      required: VERIFICATION_THRESHOLDS.engagement_rate
    });

    // 4. Account age
    const accountCreated = new Date(profile.created_at);
    const accountAgeDays = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
    criteria.push({
      name: 'account_age',
      met: accountAgeDays >= VERIFICATION_THRESHOLDS.account_age_days,
      current: accountAgeDays,
      required: VERIFICATION_THRESHOLDS.account_age_days
    });

    // 5. KYC status
    const kycApproved = profile.kyc_status === 'approved';
    if (VERIFICATION_THRESHOLDS.kyc_required) {
      criteria.push({
        name: 'kyc_verified',
        met: kycApproved,
        current: profile.kyc_status || 'none',
        required: 'approved'
      });
    }

    // Check if all criteria are met
    const allMet = criteria.every(c => c.met);

    // Auto-verify if eligible and not just checking
    if (allMet && !checkOnly) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[Verification] Error updating profile:', updateError);
        throw updateError;
      }

      // Send notification
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'system',
          title: 'Congratulations! You\'re Verified! ✓',
          body: 'You\'ve met all the requirements for creator verification. Your profile now shows a verified badge.',
          data: { action: 'verification_granted' }
        });

      console.log(`[Verification] User ${userId} has been verified automatically`);
    }

    const progressPercent = Math.round((criteria.filter(c => c.met).length / criteria.length) * 100);

    return new Response(
      JSON.stringify({
        success: true,
        eligible: allMet,
        verified: allMet && !checkOnly,
        progress: progressPercent,
        criteria,
        thresholds: VERIFICATION_THRESHOLDS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Verification] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
