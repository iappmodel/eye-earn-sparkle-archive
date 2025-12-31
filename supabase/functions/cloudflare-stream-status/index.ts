import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { videoId } = await req.json();
    if (!videoId) throw new Error("videoId is required");

    console.log("[CLOUDFLARE-STATUS] Checking status for video:", videoId);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    const data = await response.json();

    if (!data.success) {
      console.error("[CLOUDFLARE-STATUS] API error:", data.errors);
      throw new Error(data.errors?.[0]?.message || "Failed to get video status");
    }

    const video = data.result;

    // Build playback URLs
    const playbackUrl = video.playback?.hls
      ? `https://customer-${accountId}.cloudflarestream.com/${videoId}/manifest/video.m3u8`
      : null;

    const thumbnailUrl = video.thumbnail
      ? `https://customer-${accountId}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`
      : null;

    console.log("[CLOUDFLARE-STATUS] Video status:", video.status?.state);

    return new Response(
      JSON.stringify({
        videoId: video.uid,
        status: video.status?.state || "unknown",
        duration: video.duration,
        size: video.size,
        readyToStream: video.readyToStream,
        playbackUrl,
        thumbnailUrl,
        preview: video.preview,
        created: video.created,
        modified: video.modified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[CLOUDFLARE-STATUS] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
