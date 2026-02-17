import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  uploadStudioMedia,
  deleteStudioMedia,
  validateStudioMediaFile,
} from '@/services/studioMedia.service';
import type { StudioMediaType } from '@/services/studioMedia.service';

export interface MediaFile {
  id: string;
  file?: File; // optional when restored from URL
  url: string;
  type: StudioMediaType;
  uploadProgress: number;
  isUploading: boolean;
  storagePath?: string;
  thumbnailUrl?: string;
  error?: string;
  abortController?: AbortController;
}

function generateMediaId(): string {
  return `media-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate a thumbnail for a video from a blob URL.
 */
async function generateVideoThumbnail(videoUrl: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        video.remove();
        resolve(dataUrl);
      } catch {
        video.remove();
        resolve(undefined);
      }
    };

    video.onerror = () => {
      video.remove();
      resolve(undefined);
    };

    video.src = videoUrl;
  });
}

export const useStudioMedia = () => {
  const { user } = useAuth();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [currentMedia, setCurrentMedia] = useState<MediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const uploadAbortRef = useRef<Map<string, AbortController>>(new Map());

  const addMedia = useCallback(
    async (files: FileList | File[]) => {
      if (!user) {
        toast.error('Please sign in to upload media');
        return;
      }

      const fileArray = Array.from(files);
      if (!fileArray.length) return;

      setIsUploading(true);

      for (const file of fileArray) {
        const validation = validateStudioMediaFile(file);
        if (!validation.valid) {
          toast.error(validation.error);
          continue;
        }

        const mediaId = generateMediaId();
        const localUrl = URL.createObjectURL(file);
        const controller = new AbortController();
        uploadAbortRef.current.set(mediaId, controller);

        const newMedia: MediaFile = {
          id: mediaId,
          file,
          url: localUrl,
          type: validation.type,
          uploadProgress: 0,
          isUploading: true,
          abortController: controller,
        };

        setMediaFiles((prev) => {
          const next = [...prev, newMedia];
          if (prev.length === 0) setCurrentMedia(newMedia);
          return next;
        });

        try {
          const result = await uploadStudioMedia({
            userId: user.id,
            file,
            signal: controller.signal,
            onProgress: (percent, phase) => {
              setMediaFiles((prev) =>
                prev.map((m) =>
                  m.id === mediaId
                    ? {
                        ...m,
                        uploadProgress: percent,
                        isUploading: phase !== 'complete',
                      }
                    : m
                )
              );
              setCurrentMedia((prev) =>
                prev?.id === mediaId
                  ? {
                      ...prev,
                      uploadProgress: percent,
                      isUploading: phase !== 'complete',
                    }
                  : prev
              );
            },
          });

          if (controller.signal.aborted) {
            setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
            setCurrentMedia((prev) => (prev?.id === mediaId ? null : prev));
            return;
          }

          let thumbnailUrl: string | undefined;
          if (validation.type === 'video') {
            thumbnailUrl = await generateVideoThumbnail(localUrl);
          }

          setMediaFiles((prev) =>
            prev.map((m) =>
              m.id === mediaId
                ? {
                    ...m,
                    url: result.url,
                    storagePath: result.url,
                    uploadProgress: 100,
                    isUploading: false,
                    thumbnailUrl: thumbnailUrl ?? m.url,
                  }
                : m
            )
          );
          setCurrentMedia((prev) =>
            prev?.id === mediaId
              ? {
                  ...prev,
                  url: result.url,
                  storagePath: result.url,
                  uploadProgress: 100,
                  isUploading: false,
                  thumbnailUrl: thumbnailUrl ?? prev.url,
                }
              : prev
          );

          toast.success('Media uploaded', {
            description: `${validation.type === 'video' ? 'Video' : 'Image'} ready for editing`,
          });
        } catch (err) {
          const isCancelled =
            (err as Error).message === 'Upload cancelled' ||
            (err as DOMException)?.name === 'AbortError';
          if (isCancelled) {
            setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
            setCurrentMedia((prev) =>
              prev?.id === mediaId ? mediaFiles[0] ?? null : prev
            );
          } else {
            setMediaFiles((prev) =>
              prev.map((m) =>
                m.id === mediaId
                  ? {
                      ...m,
                      isUploading: false,
                      error: (err as Error).message,
                    }
                  : m
              )
            );
            toast.error('Upload failed', {
              description: (err as Error).message,
            });
          }
        } finally {
          uploadAbortRef.current.delete(mediaId);
        }
      }

      setIsUploading(false);
    },
    [user]
  );

  const cancelUpload = useCallback((mediaId: string) => {
    const controller = uploadAbortRef.current.get(mediaId);
    if (controller) {
      controller.abort();
      uploadAbortRef.current.delete(mediaId);
    }
  }, []);

  const removeMedia = useCallback(async (mediaId: string) => {
    const media = mediaFiles.find((m) => m.id === mediaId);
    cancelUpload(mediaId);

    if (media?.storagePath && user) {
      const path = extractStoragePathFromUrl(media.storagePath);
      if (path) {
        await deleteStudioMedia(media.storagePath);
      }
    }

    if (media?.url.startsWith('blob:')) {
      URL.revokeObjectURL(media.url);
    }

    setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
    setCurrentMedia((prev) => {
      if (prev?.id === mediaId) {
        const remaining = mediaFiles.filter((m) => m.id !== mediaId);
        return remaining.length > 0 ? remaining[0] : null;
      }
      return prev;
    });

    toast.success('Media removed');
  }, [mediaFiles, user, cancelUpload]);

  const selectMedia = useCallback((mediaId: string) => {
    const media = mediaFiles.find((m) => m.id === mediaId);
    if (media) setCurrentMedia(media);
  }, [mediaFiles]);

  const reorderMedia = useCallback((fromIndex: number, toIndex: number) => {
    setMediaFiles((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length)
        return prev;
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
  }, []);

  const moveMedia = useCallback((mediaId: string, direction: 'up' | 'down') => {
    setMediaFiles((prev) => {
      const idx = prev.findIndex((m) => m.id === mediaId);
      if (idx < 0) return prev;
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]];
      return arr;
    });
  }, []);

  const clearAll = useCallback(async () => {
    mediaFiles.forEach((m) => {
      cancelUpload(m.id);
      if (m.url.startsWith('blob:')) URL.revokeObjectURL(m.url);
    });
    uploadAbortRef.current.clear();
    setMediaFiles([]);
    setCurrentMedia(null);
  }, [mediaFiles, cancelUpload]);

  const retryUpload = useCallback(
    (mediaId: string) => {
      const media = mediaFiles.find((m) => m.id === mediaId);
      if (media?.error && media.file) {
        const file = media.file;
        setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
        setCurrentMedia((prev) => (prev?.id === mediaId ? null : prev));
        addMedia([file]);
      }
    },
    [mediaFiles, addMedia]
  );

  /** Add media from URLs (e.g. restored draft or imported) */
  const addMediaFromUrls = useCallback(
    (items: { url: string; type: StudioMediaType }[]) => {
      const newItems: MediaFile[] = items.map((item) => ({
        id: generateMediaId(),
        url: item.url,
        type: item.type,
        uploadProgress: 100,
        isUploading: false,
        storagePath: item.url,
        thumbnailUrl: item.type === 'video' ? undefined : item.url,
      }));
      setMediaFiles((prev) => {
        const next = [...prev, ...newItems];
        if (prev.length === 0) setCurrentMedia(next[0] ?? null);
        return next;
      });
    },
    []
  );

  const DRAFT_KEY = 'studio-draft';
  useEffect(() => {
    const uploaded = mediaFiles.filter(
      (m) => !m.isUploading && !m.error && m.storagePath
    );
    if (uploaded.length > 0 && user) {
      const draft = uploaded.map((m) => ({
        url: m.storagePath ?? m.url,
        type: m.type,
      }));
      try {
        localStorage.setItem(
          `${DRAFT_KEY}-${user.id}`,
          JSON.stringify({ items: draft, at: Date.now() })
        );
      } catch {
        /* ignore */
      }
    }
  }, [mediaFiles, user]);

  const hasDraft = useCallback(() => {
    if (!user) return false;
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY}-${user.id}`);
      if (!raw) return false;
      const { items } = JSON.parse(raw);
      return Array.isArray(items) && items.length > 0;
    } catch {
      return false;
    }
  }, [user]);

  const restoreDraft = useCallback(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY}-${user.id}`);
      if (!raw) return;
      const { items } = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) {
        addMediaFromUrls(items);
        localStorage.removeItem(`${DRAFT_KEY}-${user.id}`);
        toast.success('Draft restored', {
          description: `${items.length} item(s) restored`,
        });
      }
    } catch {
      toast.error('Could not restore draft');
    }
  }, [user, addMediaFromUrls]);

  return {
    mediaFiles,
    currentMedia,
    isUploading,
    addMedia,
    addMediaFromUrls,
    removeMedia,
    selectMedia,
    clearAll,
    setCurrentMedia,
    cancelUpload,
    reorderMedia,
    moveMedia,
    retryUpload,
    validateFile: validateStudioMediaFile,
    hasDraft,
    restoreDraft,
  };
};
