import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  ar: 'Arabic',
  hi: 'Hindi',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ru: 'Russian',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage, sourceLanguage } = await req.json();

    if (!text || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: "Text and target language are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    const sourceLangName = sourceLanguage ? (LANGUAGE_NAMES[sourceLanguage] || sourceLanguage) : 'auto-detect';

    console.log(`[Translate] Translating to ${targetLangName} from ${sourceLangName}`);

    const prompt = `Translate the following text to ${targetLangName}. 
${sourceLanguage ? `The source language is ${sourceLangName}.` : 'Auto-detect the source language.'}

Important:
- Keep the same tone and style
- Preserve any hashtags (#tag) and mentions (@user) as-is
- Preserve emojis
- Keep formatting (line breaks, etc.)
- Only output the translation, nothing else

Text to translate:
"${text}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Translation credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const translatedText = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Remove surrounding quotes if present
    const cleanedText = translatedText.replace(/^["']|["']$/g, '');

    console.log(`[Translate] Success: ${cleanedText.substring(0, 50)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        originalText: text,
        translatedText: cleanedText,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Translate] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
