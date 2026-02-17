import { supabase } from '@/integrations/supabase/client';

export interface UploadVoiceMessageOptions {
  userId: string;
  conversationId: string;
  blob: Blob;
  durationSeconds: number;
  /** Optional retry count (internal) */
  _retries?: number;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function getExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'webm';
}

/**
 * Upload a voice message blob to Supabase storage and return the public URL.
 * Stores audio in content-uploads/{userId}/voice/{timestamp}.{ext}
 * Includes retry logic for transient failures.
 */
export async function uploadVoiceMessage(options: UploadVoiceMessageOptions): Promise<string> {
  const { userId, blob, durationSeconds, _retries = 0 } = options;
  const ext = getExtension(blob.type);
  const fileName = `${userId}/voice/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from('content-uploads')
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('content-uploads')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    const isRetriable =
      _retries < MAX_RETRIES &&
      (err instanceof Error
        ? /network|timeout|failed|429|503/i.test(err.message)
        : false);

    if (isRetriable) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return uploadVoiceMessage({
        ...options,
        _retries: _retries + 1,
      });
    }
    throw err;
  }
}

/**
 * Parse duration from message content when type is 'voice'.
 * Voice messages store duration as a string number in content (e.g. "5.2").
 */
export function parseVoiceDuration(content: string | null): number | undefined {
  if (content == null || content === '') return undefined;
  const parsed = parseFloat(content);
  return Number.isFinite(parsed) ? parsed : undefined;
}
