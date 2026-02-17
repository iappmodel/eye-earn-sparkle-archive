/**
 * Media Upload Service – Centralized upload logic for content-uploads bucket.
 * Supports images, videos, carousels with progress, retries, metadata.
 */
import { supabase } from '@/integrations/supabase/client';

export const CONTENT_UPLOADS_BUCKET = 'content-uploads';

export const MEDIA_LIMITS = {
  image: {
    maxSizeBytes: 20 * 1024 * 1024, // 20MB
    maxSizeMB: 20,
    acceptedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  video: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    maxSizeMB: 100,
    acceptedMimes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  },
  carousel: {
    maxSizeBytes: 20 * 1024 * 1024,
    maxSizeMB: 20,
    maxItems: 10,
    acceptedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
} as const;

export type MediaCategory = keyof typeof MEDIA_LIMITS;

export interface UploadOptions {
  userId: string;
  file: File;
  category: MediaCategory;
  /** Subfolder within user dir, e.g. 'content', 'chat', 'voice' */
  subfolder?: string;
  /** Override cache control (default 3600) */
  cacheControl?: string;
  /** Custom filename (without path) */
  customName?: string;
}

export interface UploadResult {
  url: string;
  path: string;
  contentType: string;
  sizeBytes: number;
}

export interface UploadProgress {
  phase: 'validating' | 'compressing' | 'uploading' | 'complete';
  percent: number;
  bytesUploaded?: number;
  totalBytes?: number;
}

/**
 * Compress image using Canvas API before upload (reduces size, preserves quality).
 * Max dimension 1920px, JPEG quality 0.85.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 100 * 1024) return file; // Skip compression for small files

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1920;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Validate file against category limits.
 */
export function validateMediaFile(
  file: File,
  category: MediaCategory
): { valid: boolean; error?: string } {
  const limits = MEDIA_LIMITS[category];
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (category === 'video' && !isVideo) {
    return { valid: false, error: 'Please upload a video file (MP4, WebM)' };
  }
  if ((category === 'image' || category === 'carousel') && !isImage) {
    return { valid: false, error: 'Please upload an image file (JPEG, PNG, WebP)' };
  }

  if (file.size > limits.maxSizeBytes) {
    return {
      valid: false,
      error: `File size must be under ${limits.maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate storage path: {userId}/{subfolder?}/{timestamp}-{random}.{ext}
 */
function buildStoragePath(userId: string, file: File, subfolder?: string, customName?: string): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const base = customName || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const fileName = `${base}.${ext}`;
  const parts = [userId];
  if (subfolder) parts.push(subfolder);
  parts.push(fileName);
  return parts.join('/');
}

/**
 * Upload a single file to content-uploads bucket.
 */
export async function uploadContentFile(options: UploadOptions): Promise<UploadResult> {
  const { userId, file, category, subfolder = 'content', cacheControl = '3600', customName } = options;

  const validation = validateMediaFile(file, category);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let blob: Blob = file;
  if (category !== 'video' && file.type.startsWith('image/')) {
    blob = await compressImage(file);
  }

  const path = buildStoragePath(userId, file, subfolder, customName);

  const { data, error } = await supabase.storage
    .from(CONTENT_UPLOADS_BUCKET)
    .upload(path, blob, {
      cacheControl,
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(CONTENT_UPLOADS_BUCKET).getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
    contentType: file.type,
    sizeBytes: blob.size,
  };
}

/**
 * Delete a file from storage by path (for orphan cleanup).
 */
export async function deleteFromStorage(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(CONTENT_UPLOADS_BUCKET).remove([path]);
  return !error;
}

/**
 * Upload multiple files (e.g. carousel). Returns array of public URLs.
 */
export async function uploadContentFiles(
  userId: string,
  files: File[],
  category: MediaCategory = 'carousel',
  onProgress?: (index: number, total: number, percent: number) => void
): Promise<string[]> {
  const limits = MEDIA_LIMITS[category];
  const maxItems = 'maxItems' in limits ? limits.maxItems : 1;
  if (files.length > maxItems) {
    throw new Error(`Maximum ${maxItems} items allowed`);
  }

  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length, (i / files.length) * 100);
    const result = await uploadContentFile({
      userId,
      file: files[i],
      category,
      subfolder: 'carousel',
    });
    urls.push(result.url);
  }
  onProgress?.(files.length, files.length, 100);
  return urls;
}
