import React from 'react';
import { X, Plus, ChevronUp, ChevronDown, RefreshCw, Image as ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { MediaFile } from '@/hooks/useStudioMedia';

export interface StudioMediaStripProps {
  mediaFiles: MediaFile[];
  currentMediaId: string | null;
  onSelect: (mediaId: string) => void;
  onRemove: (mediaId: string) => void;
  onAddMore: () => void;
  onCancelUpload?: (mediaId: string) => void;
  onRetry?: (mediaId: string) => void;
  onMove?: (mediaId: string, direction: 'up' | 'down') => void;
  canReorder?: boolean;
}

export const StudioMediaStrip: React.FC<StudioMediaStripProps> = ({
  mediaFiles,
  currentMediaId,
  onSelect,
  onRemove,
  onAddMore,
  onCancelUpload,
  onRetry,
  onMove,
  canReorder = true,
}) => {
  if (mediaFiles.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {mediaFiles.map((media, index) => (
        <div
          key={media.id}
          className={cn(
            'relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all',
            'group',
            currentMediaId === media.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(media.id)}
            className={cn(
              'absolute inset-0 w-full h-full block',
              currentMediaId !== media.id && 'opacity-80 hover:opacity-100'
            )}
          >
            {media.type === 'video' ? (
              <video
                src={media.thumbnailUrl ?? media.url}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            ) : (
              <img
                src={media.url}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </button>

          {/* Progress overlay */}
          {media.isUploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 p-1">
              <Progress
                value={media.uploadProgress}
                className="h-1.5 w-full"
              />
              {onCancelUpload && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelUpload(media.id);
                  }}
                  className="text-[10px] text-white/90 hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Error overlay with retry */}
          {media.error && onRetry && (
            <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center gap-1 p-1">
              <span className="text-[10px] text-white text-center line-clamp-2">
                Failed
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(media.id);
                }}
                className="flex items-center gap-0.5 text-[10px] text-white hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {/* Type badge */}
          <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center">
            {media.type === 'video' ? (
              <Video className="w-3 h-3 text-white/90" />
            ) : (
              <ImageIcon className="w-3 h-3 text-white/90" />
            )}
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(media.id);
            }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity z-10"
          >
            <X className="w-3 h-3 text-white" />
          </button>

          {/* Reorder buttons */}
          {canReorder && onMove && !media.isUploading && !media.error && (
            <div className="absolute left-0 top-0 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-br">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(media.id, 'up');
                }}
                disabled={index === 0}
                className="p-0.5 text-white disabled:opacity-30"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(media.id, 'down');
                }}
                disabled={index === mediaFiles.length - 1}
                className="p-0.5 text-white disabled:opacity-30"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add more button */}
      <button
        type="button"
        onClick={onAddMore}
        className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0 hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-6 h-6 text-muted-foreground" />
      </button>
    </div>
  );
};
