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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { message, context, tone = 'friendly' } = await req.json();
    console.log('[GenerateReply] Request:', { messageLength: message?.length, tone });

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toneInstructions = {
      friendly: 'Be warm, friendly, and approachable. Use casual language and emoji occasionally.',
      professional: 'Be professional, clear, and helpful. Maintain a courteous tone.',
      enthusiastic: 'Be enthusiastic and excited! Show genuine interest and energy.',
      concise: 'Be brief and to the point. Keep responses short but helpful.',
    };

    const systemPrompt = `You are an AI assistant helping generate quick reply suggestions for a messaging app. 
${toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.friendly}

Generate 3 different reply options that the user can choose from. Each reply should be:
- Natural and conversational
- Appropriate for the context
- Varied in approach (one can be a question, one a statement, one more casual)

Context about the conversation: ${context || 'General chat'}

Return ONLY a JSON array with 3 string replies, nothing else. Example format:
["Reply 1", "Reply 2", "Reply 3"]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate reply suggestions for this message: "${message}"` }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    let suggestions: string[];
    try {
      // Try to parse as JSON
      suggestions = JSON.parse(content);
      if (!Array.isArray(suggestions)) {
        suggestions = [content];
      }
    } catch {
      // If parsing fails, split by newlines or use as single suggestion
      suggestions = content.split('\n').filter((s: string) => s.trim()).slice(0, 3);
    }

    console.log('[GenerateReply] Generated', suggestions.length, 'suggestions');

    return new Response(
      JSON.stringify({
        success: true,
        suggestions: suggestions.slice(0, 3),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[GenerateReply] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
