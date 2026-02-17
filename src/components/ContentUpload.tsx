import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  Image,
  Video,
  Loader2,
  CheckCircle2,
  Camera,
  ClipboardPaste,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useMediaUpload } from '@/hooks/useMediaUpload';

export type ContentMediaType = 'image' | 'video' | 'carousel';

export interface ContentUploadProps {
  onUploadComplete: (url: string | string[], type: ContentMediaType) => void;
  mediaType: ContentMediaType;
  existingUrl?: string | string[];
  onRemove?: () => void;
  /** Optional: allow camera capture */
  allowCamera?: boolean;
  /** Optional: allow paste from clipboard */
  allowPaste?: boolean;
  /** Optional: compact mode for smaller layouts */
  compact?: boolean;
}

function parseExistingMedia(value: string | string[] | undefined): { urls: string[]; type: 'image' | 'video' } | null {
  if (!value) return null;
  let urls: string[];
  if (Array.isArray(value)) {
    urls = value;
  } else if (typeof value === 'string' && value.startsWith('[')) {
    try {
      urls = JSON.parse(value) as string[];
    } catch {
      urls = [value];
    }
  } else {
    urls = [value];
  }
  if (!urls?.length) return null;
  const first = urls[0];
  const type = /\.(mp4|webm|mov|avi)(\?|$)/i.test(first) || first.includes('/video') ? 'video' : 'image';
  return { urls, type };
}

export const ContentUpload: React.FC<ContentUploadProps> = ({
  onUploadComplete,
  mediaType,
  existingUrl,
  onRemove,
  allowCamera = true,
  allowPaste = true,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>(() => {
    const parsed = parseExistingMedia(existingUrl);
    return parsed?.urls ?? [];
  });
  const [uploadedType, setUploadedType] = useState<'image' | 'video' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);

  const effectiveCategory = mediaType === 'carousel' ? 'carousel' : mediaType === 'video' ? 'video' : 'image';

  const { upload, uploadMultiple, uploading, progress, cancel, validateFile } = useMediaUpload({
    category: effectiveCategory,
    onProgress: () => {},
    onComplete: (urlOrUrls, type) => {
      if (Array.isArray(urlOrUrls)) {
        setPreviewUrls(urlOrUrls);
        setUploadedType('image');
        onUploadComplete(urlOrUrls, 'carousel');
      } else {
        setPreviewUrls([urlOrUrls]);
        setUploadedType(type === 'video' ? 'video' : 'image');
        onUploadComplete(urlOrUrls, mediaType);
      }
    },
  });

  useEffect(() => {
    const parsed = parseExistingMedia(existingUrl);
    if (parsed) {
      setPreviewUrls(parsed.urls);
      setUploadedType(parsed.type);
    } else if (!existingUrl) {
      setPreviewUrls([]);
      setUploadedType(null);
    }
  }, [existingUrl]);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;

      const images = arr.filter((f) => f.type.startsWith('image/'));
      const videos = arr.filter((f) => f.type.startsWith('video/'));

      if (mediaType === 'video') {
        const video = videos[0] || images[0];
        if (!video) return;
        await upload(video);
      } else if (mediaType === 'carousel') {
        const toUpload = images.length ? images : videos;
        if (!toUpload.length) return;
        await uploadMultiple(toUpload);
      } else {
        const file = images[0] || videos[0];
        if (!file) return;
        await upload(file);
      }
    },
    [mediaType, upload, uploadMultiple]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      processFiles(files);
      e.target.value = '';
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files?.length) processFiles(files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!allowPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f && (f.type.startsWith('image/') || f.type.startsWith('video/'))) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        setPasteHint(true);
        setTimeout(() => setPasteHint(false), 2000);
        processFiles(files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [allowPaste, processFiles]);

  const handleRemove = useCallback(() => {
    setPreviewUrls([]);
    setUploadedType(null);
    cancel();
    fileInputRef.current && (fileInputRef.current.value = '');
    cameraInputRef.current && (cameraInputRef.current.value = '');
    onRemove?.();
  }, [cancel, onRemove]);

  const handleRemoveOne = useCallback(
    (index: number) => {
      const next = previewUrls.filter((_, i) => i !== index);
      setPreviewUrls(next);
      if (!next.length) {
        setUploadedType(null);
        onRemove?.();
      } else if (next.length === 1) {
        onUploadComplete(next[0], uploadedType === 'video' ? 'video' : 'image');
      } else {
        onUploadComplete(next, 'carousel');
      }
    },
    [previewUrls, uploadedType, onRemove, onUploadComplete]
  );

  const triggerFileInput = (capture?: boolean) => {
    if (capture && cameraInputRef.current) {
      cameraInputRef.current.click();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const canAddMore = mediaType === 'carousel' && previewUrls.length < 10 && !uploading;

  const dropzoneContent = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !uploading && !previewUrls.length && triggerFileInput()}
      onKeyDown={(e) => e.key === 'Enter' && triggerFileInput()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'rounded-2xl border-2 border-dashed transition-all duration-200',
        'flex flex-col items-center justify-center gap-3',
        isDragging && 'border-primary bg-primary/10 scale-[1.01]',
        !isDragging && 'border-border hover:border-primary/50 bg-muted/30',
        compact ? 'aspect-[4/3] min-h-[140px]' : 'aspect-[4/3] min-h-[200px]'
      )}
    >
      {uploading ? (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <Progress value={progress} className="w-2/3 max-w-[200px]" />
          <span className="text-sm text-muted-foreground">Uploading... {Math.round(progress)}%</span>
          <Button size="sm" variant="ghost" onClick={(e) => (e.stopPropagation(), cancel())}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center px-4">
            <p className="font-medium">
              {mediaType === 'carousel'
                ? 'Drop images or tap to select'
                : `Tap to upload ${mediaType}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {mediaType === 'video' ? 'Max 100MB' : 'Max 20MB per file'}
              {mediaType === 'carousel' && ' • Up to 10 images'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(e) => (e.stopPropagation(), triggerFileInput())}
            >
              <Image className="w-4 h-4 mr-2" /> Choose File
            </Button>
            {allowCamera && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(e) => (e.stopPropagation(), triggerFileInput(true))}
              >
                <Camera className="w-4 h-4 mr-2" /> Camera
              </Button>
            )}
          </div>
          {allowPaste && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ClipboardPaste className="w-3 h-3" /> Or paste from clipboard
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={
          mediaType === 'video'
            ? 'video/*'
            : mediaType === 'image'
              ? 'image/*'
              : 'image/*,video/*'
        }
        multiple={mediaType === 'carousel'}
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {pasteHint && (
        <div className="text-sm text-primary animate-pulse flex items-center gap-2">
          <ClipboardPaste className="w-4 h-4" /> Pasting from clipboard...
        </div>
      )}

      {previewUrls.length > 0 ? (
        <div className="space-y-3">
          <div
            className={cn(
              'grid gap-2 rounded-2xl overflow-hidden',
              previewUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'
            )}
          >
            {previewUrls.map((url, index) => (
              <div key={url} className="relative group rounded-xl overflow-hidden bg-muted aspect-[4/3]">
                {uploadedType === 'video' && index === 0 ? (
                  <video src={url} className="w-full h-full object-cover" controls />
                ) : (
                  <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                )}
                {uploading && index === previewUrls.length - 1 && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                    <Progress value={progress} className="w-2/3" />
                  </div>
                )}
                {!uploading && (
                  <>
                    {previewUrls.length > 1 && (
                      <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                        <GripVertical className="w-3 h-3" /> {index + 1}/{previewUrls.length}
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-8 w-8 opacity-90 hover:opacity-100"
                      onClick={() => handleRemoveOne(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    {index === 0 && (
                      <div className="absolute bottom-2 right-2 bg-green-500/90 text-white p-1.5 rounded-full">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {canAddMore && (
            <div
              onClick={() => triggerFileInput()}
              className={cn(
                'rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center cursor-pointer transition-colors',
                compact ? 'h-24' : 'h-28'
              )}
            >
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <Upload className="w-6 h-6" />
                <span className="text-sm">Add more ({previewUrls.length}/10)</span>
              </div>
            </div>
          )}

          {!uploading && previewUrls.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleRemove} className="w-full">
              <X className="w-4 h-4 mr-2" /> Remove all
            </Button>
          )}
        </div>
      ) : (
        dropzoneContent
      )}
    </div>
  );
};
