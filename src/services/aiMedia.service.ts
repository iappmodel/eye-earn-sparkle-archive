/**
 * Unified AI Media Service
 * Handles SFX, music, voiceover, and subtitle generation with consistent error handling and retries.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getBaseUrl() {
  return `${SUPABASE_URL}/functions/v1`;
}

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_KEY ?? ''}`,
  };
}

export interface GenerateSFXParams {
  prompt: string;
  duration?: number;
  loop?: boolean;
  promptInfluence?: number;
  modelId?: string;
}

export interface GenerateSFXResult {
  audioContent: string;
  format: string;
  prompt: string;
  duration: number | null;
  loop?: boolean;
}

export interface GenerateMusicParams {
  prompt: string;
  duration?: number;
}

export interface GenerateMusicResult {
  audioContent: string;
  format: string;
  prompt: string;
  duration: number;
}

export interface GenerateVoiceoverParams {
  text: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
}

export interface GenerateVoiceoverResult {
  audioContent: string;
  format: string;
  voiceId: string;
}

export interface SubtitleWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface GenerateSubtitlesResult {
  text: string;
  words: SubtitleWord[];
}

export class AIMediaError extends Error {
  constructor(
    message: string,
    public readonly code?: 'CONFIG_MISSING' | 'RATE_LIMIT' | 'CREDITS_EXHAUSTED' | 'NETWORK' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'AIMediaError';
  }
}

async function handleResponse<T>(res: Response, parse: (data: Record<string, unknown>) => T): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.error as string) ?? `Request failed: ${res.status}`;
    const code = (data.errorCode as string) ?? (res.status === 429 ? 'RATE_LIMIT' : res.status === 402 ? 'CREDITS_EXHAUSTED' : 'UNKNOWN');
    throw new AIMediaError(msg, code as AIMediaError['code']);
  }
  return parse(data);
}

export async function generateSFX(params: GenerateSFXParams): Promise<GenerateSFXResult> {
  const res = await fetch(`${getBaseUrl()}/generate-sfx`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      prompt: params.prompt,
      duration: params.duration,
      loop: params.loop ?? false,
      promptInfluence: params.promptInfluence ?? 0.3,
      modelId: params.modelId,
    }),
  });
  return handleResponse(res, (d) => ({
    audioContent: d.audioContent as string,
    format: (d.format as string) ?? 'audio/mpeg',
    prompt: d.prompt as string,
    duration: (d.duration as number | null) ?? null,
    loop: d.loop as boolean | undefined,
  }));
}

export async function generateMusic(params: GenerateMusicParams): Promise<GenerateMusicResult> {
  const res = await fetch(`${getBaseUrl()}/generate-music`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      prompt: params.prompt,
      duration: params.duration ?? 30,
    }),
  });
  return handleResponse(res, (d) => ({
    audioContent: d.audioContent as string,
    format: (d.format as string) ?? 'audio/mpeg',
    prompt: d.prompt as string,
    duration: (d.duration as number) ?? 30,
  }));
}

export async function generateVoiceover(params: GenerateVoiceoverParams): Promise<GenerateVoiceoverResult> {
  const res = await fetch(`${getBaseUrl()}/generate-voiceover`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      text: params.text,
      voiceId: params.voiceId,
      stability: params.stability,
      similarityBoost: params.similarityBoost,
      style: params.style,
      speed: params.speed,
    }),
  });
  return handleResponse(res, (d) => ({
    audioContent: d.audioContent as string,
    format: (d.format as string) ?? 'audio/mpeg',
    voiceId: d.voiceId as string,
  }));
}

export async function generateSubtitles(audioOrVideoFile: File, language = 'auto'): Promise<GenerateSubtitlesResult> {
  const form = new FormData();
  form.append('audio', audioOrVideoFile);
  form.append('video', audioOrVideoFile);
  form.append('language', language);

  const res = await fetch(`${getBaseUrl()}/generate-subtitles`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY ?? '',
      Authorization: `Bearer ${SUPABASE_KEY ?? ''}`,
    },
    body: form,
  });

  return handleResponse(res, (d) => ({
    text: (d.text as string) ?? '',
    words: ((d.words ?? []) as Array<{ text: string; start: number; end: number; speaker?: string }>).map((w) => ({
      text: w.text ?? '',
      start: Number(w.start) ?? 0,
      end: Number(w.end) ?? 0,
      speaker: w.speaker,
    })),
  }));
}
