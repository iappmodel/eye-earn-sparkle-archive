/**
 * Studio Media Service – Upload to studio-media bucket with progress, compression, retry.
 * Aligned with storage policies and MIME types from supabase migrations.
 */
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/services/mediaUpload.service';

export const STUDIO_MEDIA_BUCKET = 'studio-media';

export const STUDIO_MEDIA_LIMITS = {
  image: {
    maxSizeBytes: 20 * 1024 * 1024, // 20MB
    maxSizeMB: 20,
    acceptedMimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  video: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    maxSizeMB: 100,
    acceptedMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
} as const;

export type StudioMediaType = 'image' | 'video';

export interface UploadStudioMediaOptions {
  userId: string;
  file: File;
  onProgress?: (percent: number, phase: 'validating' | 'compressing' | 'uploading' | 'complete') => void;
  signal?: AbortSignal | null;
}

export interface UploadStudioMediaResult {
  url: string;
  path: string;
  type: StudioMediaType;
  contentType: string;
  sizeBytes: number;
}

export function validateStudioMediaFile(
  file: File
): { valid: boolean; type: StudioMediaType; error?: string } {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    return { valid: false, type: 'image', error: 'Please upload images or videos only (JPEG, PNG, WebP, GIF, MP4, WebM, MOV).' };
  }

  const limits = isVideo ? STUDIO_MEDIA_LIMITS.video : STUDIO_MEDIA_LIMITS.image;
  if (file.size > limits.maxSizeBytes) {
    return {
      valid: false,
      type: isVideo ? 'video' : 'image',
      error: `File too large. Maximum size is ${limits.maxSizeMB}MB for ${limits.maxSizeMB === 100 ? 'videos' : 'images'}.`,
    };
  }

  return { valid: true, type: isVideo ? 'video' : 'image' };
}

function buildStoragePath(userId: string, file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeExt = ['mp4', 'webm', 'mov', 'jpeg', 'jpg', 'png', 'gif', 'webp'].includes(ext)
    ? ext
    : file.type.startsWith('video/')
      ? 'mp4'
      : 'jpg';
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${userId}/${base}.${safeExt}`;
}

const MAX_RETRIES = 2;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload a single file to studio-media bucket with progress and retry.
 */
export async function uploadStudioMedia(
  options: UploadStudioMediaOptions
): Promise<UploadStudioMediaResult> {
  const { userId, file, onProgress, signal } = options;

  onProgress?.(0, 'validating');
  const validation = validateStudioMediaFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let blob: Blob = file;

  if (validation.type === 'image') {
    onProgress?.(5, 'compressing');
    blob = await compressImage(file);
    if (signal?.aborted) throw new Error('Upload cancelled');
  }

  const path = buildStoragePath(userId, file);
  onProgress?.(validation.type === 'image' ? 15 : 5, 'uploading');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error('Upload cancelled');

    try {
      // Phase-based progress simulation (Supabase JS client doesn't expose real progress)
      const progressInterval = setInterval(() => {
        if (signal?.aborted) return;
        onProgress?.(
          Math.min(15 + Math.floor((Date.now() % 3000) / 30), 95),
          'uploading'
        );
      }, 200);

      const { data, error } = await supabase.storage
        .from(STUDIO_MEDIA_BUCKET)
        .upload(path, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      clearInterval(progressInterval);
      if (signal?.aborted) throw new Error('Upload cancelled');

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(STUDIO_MEDIA_BUCKET)
        .getPublicUrl(data.path);

      onProgress?.(100, 'complete');

      return {
        url: urlData.publicUrl,
        path: data.path,
        type: validation.type,
        contentType: file.type,
        sizeBytes: blob.size,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(500 * (attempt + 1));
      } else {
        break;
      }
    }
  }

  throw lastError ?? new Error('Upload failed');
}

/**
 * Delete a file from studio-media bucket by public URL.
 */
export function extractStoragePathFromUrl(publicUrl: string): string | null {
  const match = publicUrl.match(/\/studio-media\/(.+)$/);
  return match ? match[1] : null;
}

export async function deleteStudioMedia(publicUrl: string): Promise<boolean> {
  const path = extractStoragePathFromUrl(publicUrl);
  if (!path) return false;
  const { error } = await supabase.storage
    .from(STUDIO_MEDIA_BUCKET)
    .remove([path]);
  return !error;
}
