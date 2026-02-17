import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  Upload,
  Camera,
  ClipboardPaste,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface StudioUploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  isUploading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const StudioUploadZone: React.FC<StudioUploadZoneProps> = ({
  onFilesSelected,
  isUploading = false,
  disabled = false,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const valid = arr.filter(
        (f) =>
          f.type.startsWith('image/') || f.type.startsWith('video/')
      );
      if (valid.length) onFilesSelected(valid);
    },
    [onFilesSelected]
  );

  const triggerFileInput = useCallback(
    (capture?: boolean) => {
      if (disabled || isUploading) return;
      if (capture && cameraInputRef.current) {
        cameraInputRef.current.click();
      } else if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    },
    [disabled, isUploading]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) {
        processFiles(files);
        e.target.value = '';
      }
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled || isUploading) return;
      const files = e.dataTransfer.files;
      if (files?.length) processFiles(files);
    },
    [disabled, isUploading, processFiles]
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
    const onPaste = (e: ClipboardEvent) => {
      if (disabled || isUploading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f && (f.type.startsWith('image/') || f.type.startsWith('video/'))) {
            files.push(f);
          }
        }
      }
      if (files.length) {
        e.preventDefault();
        setPasteHint(true);
        setTimeout(() => setPasteHint(false), 2500);
        processFiles(files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [disabled, isUploading, processFiles]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && !isUploading && triggerFileInput()}
      onKeyDown={(e) => e.key === 'Enter' && triggerFileInput()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'relative flex flex-col items-center justify-center min-h-[280px] rounded-xl',
        'border-2 border-dashed transition-all duration-200',
        isDragging && 'border-primary bg-primary/10 scale-[1.01]',
        !isDragging && 'border-muted-foreground/30 hover:border-primary/50 bg-black/40',
        (disabled || isUploading) && 'opacity-70 cursor-not-allowed',
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-3 text-primary">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="text-sm font-medium">Uploading...</p>
        </div>
      ) : (
        <>
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mb-4">
            <Upload className="w-10 h-10 text-primary" />
          </div>
          <p className="text-foreground font-semibold text-lg mb-1">
            Upload Media
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-[240px] mb-4">
            Drag & drop or tap to select videos & images
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Videos up to 100MB • Images up to 20MB
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileInput();
              }}
            >
              <ImageIcon className="w-4 h-4 mr-2" /> Choose File
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileInput(true);
              }}
            >
              <Camera className="w-4 h-4 mr-2" /> Camera
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <ClipboardPaste className="w-3.5 h-3.5" />
            Or paste from clipboard
          </p>
        </>
      )}

      {pasteHint && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/20 text-primary text-sm animate-pulse">
          <ClipboardPaste className="w-4 h-4" />
          Pasting from clipboard...
        </div>
      )}
    </div>
  );
};
