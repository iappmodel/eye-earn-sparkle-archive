import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  uploadContentFile,
  uploadContentFiles,
  validateMediaFile,
  compressImage,
  type MediaCategory,
} from '@/services/mediaUpload.service';

export interface UseMediaUploadOptions {
  category?: MediaCategory;
  onProgress?: (percent: number) => void;
  onComplete?: (url: string | string[], type: 'image' | 'video' | 'carousel') => void;
}

export function useMediaUpload(options: UseMediaUploadOptions = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { category = 'image', onProgress, onComplete } = options;
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  const reportProgress = useCallback(
    (p: number) => {
      setProgress(p);
      onProgress?.(p);
    },
    [onProgress]
  );

  const uploadSingle = useCallback(
    async (file: File): Promise<string | null> => {
      if (!user) {
        toast({ title: 'Please sign in to upload', variant: 'destructive' });
        return null;
      }

      const validation = validateMediaFile(file, category);
      if (!validation.valid) {
        toast({ title: 'Invalid file', description: validation.error, variant: 'destructive' });
        return null;
      }

      abortRef.current = false;
      setUploading(true);
      reportProgress(5);

      try {
        // Simulate progress phases
        const phaseInterval = setInterval(() => {
          if (abortRef.current) return;
          setProgress((p) => Math.min(p + 8, 85));
        }, 300);

        const result = await uploadContentFile({
          userId: user.id,
          file,
          category,
          subfolder: 'content',
        });

        clearInterval(phaseInterval);
        if (abortRef.current) return null;

        reportProgress(100);
        const type = result.contentType.startsWith('video/') ? 'video' : 'image';
        onComplete?.(result.url, type);
        toast({ title: 'Upload complete', description: 'Your file has been uploaded successfully' });
        return result.url;
      } catch (err) {
        console.error('Upload error:', err);
        const msg = err instanceof Error ? err.message : 'Upload failed';
        toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
        return null;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [user, category, toast, onComplete, reportProgress]
  );

  const uploadMultiple = useCallback(
    async (files: File[]): Promise<string[] | null> => {
      if (!user) {
        toast({ title: 'Please sign in to upload', variant: 'destructive' });
        return null;
      }

      abortRef.current = false;
      setUploading(true);
      reportProgress(0);

      try {
        const urls = await uploadContentFiles(
          user.id,
          files,
          category,
          (index, total, percent) => {
            if (!abortRef.current) reportProgress(percent);
          }
        );
        if (abortRef.current) return null;
        reportProgress(100);
        onComplete?.(urls, 'carousel');
        toast({
          title: 'Upload complete',
          description: `${urls.length} file(s) uploaded successfully`,
        });
        return urls;
      } catch (err) {
        console.error('Upload error:', err);
        const msg = err instanceof Error ? err.message : 'Upload failed';
        toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
        return null;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [user, category, toast, onComplete, reportProgress]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    upload: uploadSingle,
    uploadMultiple,
    cancel,
    uploading,
    progress,
    validateFile: (file: File) => validateMediaFile(file, category),
    compressImage,
    userId: user?.id,
  };
}
