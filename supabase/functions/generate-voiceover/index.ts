import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      text,
      voiceId = DEFAULT_VOICE,
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.5,
      speed = 1,
      modelId = 'eleven_multilingual_v2',
      outputFormat = 'mp3_44100_128',
    } = body;

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_API_KEY is not configured', errorCode: 'CONFIG_MISSING' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clampedStability = Math.max(0, Math.min(1, Number(stability) ?? 0.5));
    const clampedSimilarity = Math.max(0, Math.min(1, Number(similarityBoost) ?? 0.75));
    const clampedStyle = Math.max(0, Math.min(1, Number(style) ?? 0.5));
    const clampedSpeed = Math.max(0.5, Math.min(2, Number(speed) ?? 1));

    console.log(`[generate-voiceover] voice=${voiceId} chars=${text.length}`);

    const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
    url.searchParams.set('output_format', outputFormat);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: clampedStability,
          similarity_boost: clampedSimilarity,
          style: clampedStyle,
          use_speaker_boost: true,
        },
        ...(clampedSpeed !== 1 && { speed: clampedSpeed }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-voiceover] ElevenLabs error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', errorCode: 'RATE_LIMIT' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Credits exhausted', errorCode: 'CREDITS_EXHAUSTED' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`ElevenLabs API: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);
    console.log('[generate-voiceover] success');

    return new Response(
      JSON.stringify({
        audioContent: base64Audio,
        format: 'audio/mpeg',
        voiceId,
        stability: clampedStability,
        similarityBoost: clampedSimilarity,
        speed: clampedSpeed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-voiceover]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
