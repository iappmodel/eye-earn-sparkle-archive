import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ElevenLabsWord {
  text?: string;
  start?: number;
  end?: number;
  speaker_id?: string;
  type?: string;
}

function mapWordsToSubtitles(raw: unknown): { text: string; words: Array<{ text: string; start: number; end: number; speaker?: string }> } {
  const obj = raw as Record<string, unknown>;
  const text = (obj.text as string) ?? '';
  const rawWords = (obj.words ?? obj.segments) as ElevenLabsWord[] | undefined;
  const speakerMap = new Map<string, string>();
  let speakerIndex = 0;

  const words = (rawWords ?? []).map((w) => {
    const t = (w.text ?? '').trim();
    const start = Number(w.start) ?? 0;
    const end = Number(w.end) ?? start + 0.5;
    let speaker: string | undefined;
    if (w.speaker_id != null) {
      if (!speakerMap.has(w.speaker_id)) {
        speakerIndex += 1;
        speakerMap.set(w.speaker_id, `Speaker ${speakerIndex}`);
      }
      speaker = speakerMap.get(w.speaker_id);
    }
    return { text: t, start, end, speaker };
  }).filter((w) => w.text);

  return { text, words };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = (formData.get('audio') ?? formData.get('video')) as File | null;
    const languageCode = (formData.get('language') as string) || 'eng';

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_API_KEY is not configured', errorCode: 'CONFIG_MISSING' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Audio or video file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-subtitles] file=${file.name} size=${file.size} lang=${languageCode}`);

    const apiFormData = new FormData();
    apiFormData.append('file', file);
    apiFormData.append('model_id', 'scribe_v1');
    apiFormData.append('tag_audio_events', 'true');
    apiFormData.append('diarize', 'true');
    if (languageCode !== 'auto') {
      apiFormData.append('language_code', languageCode);
    }

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-subtitles] ElevenLabs error:', response.status, errorText);
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

    const transcription = (await response.json()) as Record<string, unknown>;
    const { text, words } = mapWordsToSubtitles(transcription);
    console.log('[generate-subtitles] done, words=', words.length);

    return new Response(
      JSON.stringify({ text, words, ...transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-subtitles]', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
