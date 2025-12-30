import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, text } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating text styles for prompt:', prompt);

    const systemPrompt = `You are a creative text style designer. Generate 3 unique text styles based on the user's description.

For each style, return a JSON object with these properties:
- fontFamily: One of these fonts: "Inter", "Roboto", "Playfair Display", "Montserrat", "Oswald", "Bebas Neue", "Pacifico", "Lobster", "Dancing Script", "Permanent Marker", "Anton", "Righteous", "Bangers", "Fredoka One", "Press Start 2P"
- color: A hex color code (e.g., "#ff6b35")
- gradient: Optional object with "from" and "to" hex colors, or null
- shadowBlur: Number from 0-50 for text shadow blur
- shadowColor: Hex color for shadow
- strokeWidth: Number from 0-10 for text outline width
- strokeColor: Hex color for stroke
- bold: Boolean
- italic: Boolean
- animation: Object with "type" (one of: "fade", "bounce", "slide", "pulse", "typewriter", "wave", "glow", "shake", "zoom", "rotate"), "duration" (0.5-5 seconds), and "loop" (boolean). Can be null.
- description: A short description of the style (10-20 words)

Return ONLY a valid JSON object with a "styles" array containing exactly 3 style objects. No markdown, no explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create 3 unique text styles for: "${prompt}". The text to style is: "${text}"` }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log('AI response:', content);

    // Parse the JSON response
    let styles;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        styles = parsed.styles || [parsed];
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return fallback styles
      styles = [
        {
          fontFamily: "Bebas Neue",
          color: "#ff6b35",
          gradient: { from: "#ff6b35", to: "#f7931e" },
          shadowBlur: 10,
          shadowColor: "#ff0000",
          strokeWidth: 2,
          strokeColor: "#000000",
          bold: true,
          italic: false,
          animation: { type: "glow", duration: 1.5, loop: true },
          description: "Bold and fiery with glowing edges"
        },
        {
          fontFamily: "Montserrat",
          color: "#ffffff",
          gradient: { from: "#667eea", to: "#764ba2" },
          shadowBlur: 20,
          shadowColor: "#764ba2",
          strokeWidth: 0,
          strokeColor: "#000000",
          bold: false,
          italic: false,
          animation: { type: "pulse", duration: 2, loop: true },
          description: "Elegant purple gradient with soft glow"
        },
        {
          fontFamily: "Press Start 2P",
          color: "#00ff00",
          gradient: null,
          shadowBlur: 5,
          shadowColor: "#00ff00",
          strokeWidth: 1,
          strokeColor: "#003300",
          bold: false,
          italic: false,
          animation: { type: "shake", duration: 0.5, loop: true },
          description: "Retro gaming style with glitch effect"
        }
      ];
    }

    return new Response(JSON.stringify({ styles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error generating text styles:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      styles: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
