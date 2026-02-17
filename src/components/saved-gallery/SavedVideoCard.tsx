import React, { useState, useRef, useCallback } from 'react';
import { Coins, Route, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';
import type { SavedVideo } from '@/hooks/useSavedVideos';

function formatDuration(seconds?: number): string | null {
  if (seconds == null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SavedVideoCardProps {
  video: SavedVideo;
  onPlay: (video: SavedVideo) => void;
  onUnsave: (contentId: string) => void;
  onAddToRoute?: (video: SavedVideo) => void;
  viewMode?: 'grid' | 'list';
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const SavedVideoCard: React.FC<SavedVideoCardProps> = ({
  video,
  onPlay,
  onUnsave,
  onAddToRoute,
  viewMode = 'grid',
  selectionMode = false,
  selected = false,
  onToggleSelect,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const { light, medium } = useHapticFeedback();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const didLongPress = useRef(false);

  const durationStr = formatDuration(video.duration);

  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      medium();
      setShowActions(true);
    }, 600);
  }, [medium]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!didLongPress.current) {
      light();
      if (selectionMode && onToggleSelect) {
        onToggleSelect();
      } else {
        onPlay(video);
      }
    }
  }, [light, onPlay, video, selectionMode, onToggleSelect]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const thumb = (
    <div className="relative flex-shrink-0 w-full overflow-hidden rounded-lg bg-muted/30">
      <div className={cn(viewMode === 'grid' ? 'aspect-[9/16]' : 'aspect-video')}>
        {!thumbLoaded && (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        )}
        <img
          src={video.thumbnail}
          alt={video.title}
          className={cn(
            'w-full h-full object-cover select-none transition-opacity duration-200',
            thumbLoaded ? 'opacity-100' : 'opacity-0',
          )}
          draggable={false}
          onLoad={() => setThumbLoaded(true)}
        />
      </div>
      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Selection checkbox */}
      {selectionMode && (
        <div
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
          style={{
            borderColor: selected ? 'var(--primary)' : 'rgba(255,255,255,0.8)',
            backgroundColor: selected ? 'var(--primary)' : 'rgba(0,0,0,0.4)',
          }}
        >
          {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
        </div>
      )}

      {/* Promo badge */}
      {video.type === 'promo' && (
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary/80 text-[10px] font-bold text-primary-foreground">
          PROMO
        </div>
      )}

      {/* In route badge (bottom-left to avoid overlapping PROMO) */}
      {video.addedToRoute && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-600/90 text-[10px] font-medium text-white">
          <Route className="w-3 h-3" /> In route
        </div>
      )}
      {video.type === 'promo' && !video.addedToRoute && video.requiresPhysicalAction && (
        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] text-white/90">
          Visit to earn
        </div>
      )}

      {/* Duration (bottom-right for video; left side may have "In route" or "Visit to earn") */}
      {durationStr && video.videoSrc && (
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-medium text-white">
          {durationStr}
        </div>
      )}

      {/* Video indicator (triangle) - only when no duration to avoid overlap */}
      {video.videoSrc && !durationStr && (
        <div className="absolute top-1.5 right-1.5 w-0 h-0 border-l-[6px] border-l-white/70 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
      )}

      {/* Reward badge */}
      {video.reward && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60">
          <Coins className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] text-white font-medium">{video.reward.amount}</span>
        </div>
      )}

      {/* Bottom info (grid view only on thumb) */}
      {viewMode === 'grid' && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 pointer-events-none">
          <p className="text-white text-xs font-medium line-clamp-1 drop-shadow-sm">{video.title}</p>
          {video.creator?.displayName && (
            <p className="text-white/60 text-[10px] line-clamp-1">{video.creator.displayName}</p>
          )}
        </div>
      )}
    </div>
  );

  const listInfo = viewMode === 'list' && (
    <div className="flex-1 min-w-0 flex flex-col justify-center py-2 px-3">
      <p className="text-foreground text-sm font-medium line-clamp-2">{video.title}</p>
      {video.creator?.displayName && (
        <p className="text-muted-foreground text-xs line-clamp-1 mt-0.5">{video.creator.displayName}</p>
      )}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {video.type === 'promo' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">Promo</span>
        )}
        {video.reward && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
            <Coins className="w-3 h-3" /> {video.reward.amount}
          </span>
        )}
        {video.addedToRoute && (
          <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
            <Check className="w-3 h-3" /> In route
          </span>
        )}
      </div>
    </div>
  );

  const wrapperClass = cn(
    'relative rounded-lg overflow-hidden group',
    viewMode === 'grid' && 'aspect-[9/16]',
    viewMode === 'list' && 'flex flex-row gap-0 rounded-xl border border-border/50',
  );

  return (
    <div
      className={wrapperClass}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchCancel}
    >
      {viewMode === 'list' ? (
        <>
          <div className="w-24 flex-shrink-0">{thumb}</div>
          {listInfo}
        </>
      ) : (
        thumb
      )}

      {/* Long-press actions overlay */}
      {showActions && (
        <div
          className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 animate-fade-in z-20 rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {video.type === 'promo' && video.requiresPhysicalAction && onAddToRoute && (
            <button
              onClick={() => {
                medium();
                onAddToRoute(video);
                setShowActions(false);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                video.addedToRoute
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-primary/20 text-primary border border-primary/30',
              )}
            >
              {video.addedToRoute ? (
                <><Check className="w-4 h-4" /> In Route</>
              ) : (
                <><Route className="w-4 h-4" /> Add to Route</>
              )}
            </button>
          )}

          <button
            onClick={() => {
              medium();
              onUnsave(video.contentId);
              toast.info('Removed from saved');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-destructive/20 text-destructive border border-destructive/30"
          >
            <Trash2 className="w-4 h-4" /> Remove
          </button>

          <button
            onClick={() => setShowActions(false)}
            className="mt-2 text-xs text-white/50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default SavedVideoCard;
