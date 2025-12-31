import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ModerationRequest {
  contentId: string;
  mediaUrl?: string;
  caption?: string;
}

interface ModerationResult {
  safe: boolean;
  categories: {
    nsfw: boolean;
    violence: boolean;
    hate: boolean;
    spam: boolean;
    copyright: boolean;
  };
  confidence: number;
  reasons: string[];
  action: "approved" | "flagged" | "rejected";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { contentId, mediaUrl, caption }: ModerationRequest = await req.json();

    console.log("[AI-MODERATION] Processing content:", contentId);

    // Build the prompt for moderation
    const messages: any[] = [
      {
        role: "system",
        content: `You are a content moderation AI. Analyze the provided content and determine if it violates any community guidelines.

Categories to check:
- NSFW: Adult, sexual, or explicit content
- Violence: Graphic violence, gore, or threats
- Hate: Hate speech, discrimination, or harassment
- Spam: Spam, scams, or misleading content
- Copyright: Potential copyright infringement

Respond with a JSON object containing:
{
  "safe": boolean,
  "categories": { "nsfw": boolean, "violence": boolean, "hate": boolean, "spam": boolean, "copyright": boolean },
  "confidence": number (0-1),
  "reasons": string[] (list of concerns if any),
  "action": "approved" | "flagged" | "rejected"
}

Be strict about safety but avoid false positives. Only reject clearly violating content.`,
      },
    ];

    // Add image/video analysis if URL provided
    if (mediaUrl) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: mediaUrl },
          },
          {
            type: "text",
            text: caption
              ? `Analyze this image and caption for content moderation. Caption: "${caption}"`
              : "Analyze this image for content moderation.",
          },
        ],
      });
    } else if (caption) {
      messages.push({
        role: "user",
        content: `Analyze this text for content moderation: "${caption}"`,
      });
    } else {
      throw new Error("Either mediaUrl or caption must be provided");
    }

    // Call Lovable AI for moderation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI-MODERATION] API error:", errorText);
      throw new Error("AI moderation failed");
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || "{}";

    let result: ModerationResult;
    try {
      result = JSON.parse(resultText);
    } catch {
      console.error("[AI-MODERATION] Failed to parse result:", resultText);
      result = {
        safe: true,
        categories: { nsfw: false, violence: false, hate: false, spam: false, copyright: false },
        confidence: 0.5,
        reasons: [],
        action: "approved",
      };
    }

    console.log("[AI-MODERATION] Result:", result);

    // Update content status if contentId provided
    if (contentId && contentId !== "preview") {
      const newStatus = result.action === "rejected" ? "rejected" : result.action === "flagged" ? "flagged" : "published";

      await supabaseClient
        .from("user_content")
        .update({ status: newStatus })
        .eq("id", contentId);

      // Log the moderation if flagged or rejected
      if (result.action !== "approved") {
        await supabaseClient.from("content_flags").insert({
          content_id: contentId,
          content_type: "user_content",
          flagged_by: "00000000-0000-0000-0000-000000000000", // System user
          reason: result.reasons.join(", ") || "AI moderation",
          status: result.action === "rejected" ? "action_taken" : "pending",
          action_taken: result.action,
        });
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[AI-MODERATION] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
