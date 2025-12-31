import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyticsEvent {
  eventType: string;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Try to get user from auth header, but allow anonymous events
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      userId = user?.id || null;
    }

    const { eventType, properties, sessionId, timestamp }: AnalyticsEvent = await req.json();

    if (!eventType) throw new Error("eventType is required");

    console.log("[ANALYTICS] Tracking event:", eventType, "user:", userId);

    // Get device/browser info from headers
    const userAgent = req.headers.get("User-Agent") || "";
    const referer = req.headers.get("Referer") || "";

    // Store in content_interactions for engagement events
    if (eventType.startsWith("content_") && properties?.contentId) {
      await supabaseClient.from("content_interactions").upsert(
        {
          user_id: userId || "00000000-0000-0000-0000-000000000000",
          content_id: properties.contentId,
          content_type: properties.contentType || "video",
          watch_duration: properties.watchDuration || 0,
          watch_completion_rate: properties.completionRate || 0,
          attention_score: properties.attentionScore || 0,
          liked: properties.liked || false,
          shared: properties.shared || false,
          skipped: properties.skipped || false,
        },
        { onConflict: "user_id,content_id" }
      );
    }

    // Store in user_preferences for preference updates
    if (eventType === "preference_update" && userId) {
      const { data: existingPrefs } = await supabaseClient
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      const updates: any = { user_id: userId };

      if (properties?.likedTags) {
        const currentLiked = existingPrefs?.liked_tags || [];
        updates.liked_tags = [...new Set([...currentLiked, ...properties.likedTags])];
      }

      if (properties?.dislikedTags) {
        const currentDisliked = existingPrefs?.disliked_tags || [];
        updates.disliked_tags = [...new Set([...currentDisliked, ...properties.dislikedTags])];
      }

      if (properties?.category) {
        const currentCategories = existingPrefs?.preferred_categories || [];
        updates.preferred_categories = [...new Set([...currentCategories, properties.category])];
      }

      await supabaseClient.from("user_preferences").upsert(updates, { onConflict: "user_id" });
    }

    // Track session activity
    if (userId && eventType === "session_start") {
      await supabaseClient.from("account_activity_logs").insert({
        user_id: userId,
        activity_type: "session_start",
        status: "success",
        user_agent: userAgent,
        details: { sessionId, referer, properties },
      });
    }

    // Generic event logging for audit trail
    if (userId && ["purchase", "payout", "report", "block"].includes(eventType)) {
      await supabaseClient.from("account_activity_logs").insert({
        user_id: userId,
        activity_type: eventType,
        status: "success",
        details: properties,
        user_agent: userAgent,
      });
    }

    // Update engagement scores for users
    if (userId && eventType.startsWith("content_")) {
      const { data: prefs } = await supabaseClient
        .from("user_preferences")
        .select("engagement_score, total_content_views")
        .eq("user_id", userId)
        .single();

      const currentScore = prefs?.engagement_score || 0;
      const currentViews = prefs?.total_content_views || 0;

      // Calculate engagement boost based on action
      let scoreBoost = 0;
      if (eventType === "content_view") scoreBoost = 1;
      if (eventType === "content_like") scoreBoost = 5;
      if (eventType === "content_share") scoreBoost = 10;
      if (eventType === "content_comment") scoreBoost = 8;

      await supabaseClient
        .from("user_preferences")
        .upsert(
          {
            user_id: userId,
            engagement_score: currentScore + scoreBoost,
            total_content_views: currentViews + (eventType === "content_view" ? 1 : 0),
          },
          { onConflict: "user_id" }
        );
    }

    console.log("[ANALYTICS] Event tracked successfully");

    return new Response(
      JSON.stringify({ success: true, eventType, timestamp: timestamp || new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[ANALYTICS] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
