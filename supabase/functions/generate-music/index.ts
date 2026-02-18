import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors.headers });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      text,
      duration = 30,
      outputFormat = 'mp3_44100_128',
    } = body;

    const effectivePrompt = prompt || text;
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_API_KEY is not configured', errorCode: 'CONFIG_MISSING' }),
        { status: 503, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    if (!effectivePrompt || typeof effectivePrompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt (or text) is required' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const clampedDuration = Math.max(10, Math.min(120, Number(duration) || 30));

    console.log(`[generate-music] "${effectivePrompt.slice(0, 60)}..." duration=${clampedDuration}s`);

    const url = new URL('https://api.elevenlabs.io/v1/music');
    url.searchParams.set('output_format', outputFormat);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: effectivePrompt,
        duration_seconds: clampedDuration,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-music] ElevenLabs error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', errorCode: 'RATE_LIMIT' }),
          { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Credits exhausted', errorCode: 'CREDITS_EXHAUSTED' }),
          { status: 402, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`ElevenLabs API: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);
    console.log('[generate-music] success');

    return new Response(
      JSON.stringify({
        audioContent: base64Audio,
        format: 'audio/mpeg',
        prompt: effectivePrompt,
        duration: clampedDuration,
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-music]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
