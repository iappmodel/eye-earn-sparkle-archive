import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadRequest {
  contentId?: string;
  maxDurationSeconds?: number;
  requireSignedURLs?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

    if (!accountId || !apiToken) {
      throw new Error("Cloudflare credentials not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("User not authenticated");

    const { contentId, maxDurationSeconds = 300, requireSignedURLs = false }: UploadRequest = await req.json();

    console.log("[CLOUDFLARE-STREAM] Creating upload URL for user:", user.id);

    // Create a direct creator upload URL
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs,
          meta: {
            user_id: user.id,
            content_id: contentId || "",
            uploaded_at: new Date().toISOString(),
          },
          allowedOrigins: ["*"],
        }),
      }
    );

    const data = await response.json();

    if (!data.success) {
      console.error("[CLOUDFLARE-STREAM] API error:", data.errors);
      throw new Error(data.errors?.[0]?.message || "Failed to create upload URL");
    }

    console.log("[CLOUDFLARE-STREAM] Upload URL created:", data.result.uid);

    return new Response(
      JSON.stringify({
        uploadUrl: data.result.uploadURL,
        videoId: data.result.uid,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[CLOUDFLARE-STREAM] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
