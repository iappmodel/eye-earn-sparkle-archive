import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ModerationResult {
  is_safe: boolean;
  flags: string[];
  confidence: number;
  categories: {
    violence: boolean;
    adult: boolean;
    hate: boolean;
    harassment: boolean;
    spam: boolean;
    misinformation: boolean;
  };
  action: 'approve' | 'flag' | 'reject';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentId, contentType, textContent, mediaUrl } = await req.json();

    if (!contentId) {
      return new Response(
        JSON.stringify({ error: "Content ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build the moderation prompt
    const moderationPrompt = `You are a content moderation AI. Analyze the following content and determine if it violates community guidelines.

Content to analyze:
${textContent ? `Text: "${textContent}"` : ''}
${mediaUrl ? `Media URL: ${mediaUrl}` : ''}
Content Type: ${contentType || 'unknown'}

Evaluate for these categories:
1. Violence or gore
2. Adult/sexual content
3. Hate speech or discrimination
4. Harassment or bullying
5. Spam or scam content
6. Misinformation

Respond with a JSON object containing:
{
  "is_safe": boolean (true if content is safe),
  "flags": array of string flags describing issues found,
  "confidence": number between 0-1,
  "categories": {
    "violence": boolean,
    "adult": boolean,
    "hate": boolean,
    "harassment": boolean,
    "spam": boolean,
    "misinformation": boolean
  },
  "action": "approve" | "flag" | "reject"
}

Only respond with the JSON, no other text.`;

    console.log(`[Moderate] Analyzing content ${contentId}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: moderationPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the AI response
    let moderation: ModerationResult;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        moderation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // Default to safe if parsing fails
      moderation = {
        is_safe: true,
        flags: [],
        confidence: 0.5,
        categories: {
          violence: false,
          adult: false,
          hate: false,
          harassment: false,
          spam: false,
          misinformation: false,
        },
        action: 'approve'
      };
    }

    console.log(`[Moderate] Content ${contentId} result:`, moderation);

    // Auto-flag if content is not safe
    if (!moderation.is_safe && moderation.action !== 'approve') {
      const { error: flagError } = await supabase
        .from('content_flags')
        .insert({
          content_id: contentId,
          content_type: contentType || 'video',
          flagged_by: '00000000-0000-0000-0000-000000000000', // System user
          reason: 'ai_moderation',
          description: `AI detected: ${moderation.flags.join(', ')}`,
          status: moderation.action === 'reject' ? 'pending' : 'review'
        });

      if (flagError) {
        console.error('[Moderate] Error creating flag:', flagError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        moderation,
        auto_flagged: !moderation.is_safe && moderation.action !== 'approve'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Moderate] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
