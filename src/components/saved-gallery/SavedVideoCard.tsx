import React, { useState, useRef, useCallback } from 'react';
import { Coins, Route, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';
import type { SavedVideo } from '@/hooks/useSavedVideos';

interface SavedVideoCardProps {
  video: SavedVideo;
  onPlay: (video: SavedVideo) => void;
  onUnsave: (contentId: string) => void;
  onAddToRoute?: (video: SavedVideo) => void;
}

const SavedVideoCard: React.FC<SavedVideoCardProps> = ({
  video,
  onPlay,
  onUnsave,
  onAddToRoute,
}) => {
  const [showActions, setShowActions] = useState(false);
  const { light, medium } = useHapticFeedback();
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const didLongPress = useRef(false);

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
      onPlay(video);
    }
  }, [light, onPlay, video]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div className="relative aspect-[9/16] rounded-lg overflow-hidden group">
      <img
        src={video.thumbnail}
        alt={video.title}
        className="w-full h-full object-cover select-none"
        draggable={false}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchCancel}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Promo badge */}
      {video.type === 'promo' && (
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary/80 text-[10px] font-bold text-primary-foreground">
          PROMO
        </div>
      )}

      {/* Video indicator */}
      {video.videoSrc && (
        <div className="absolute top-1.5 right-1.5 w-0 h-0 border-l-[6px] border-l-white/70 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
      )}

      {/* Reward badge */}
      {video.reward && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60">
          <Coins className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] text-white font-medium">{video.reward.amount}</span>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 pointer-events-none">
        <p className="text-white text-xs font-medium line-clamp-1">{video.title}</p>
        {video.creator?.displayName && (
          <p className="text-white/60 text-[10px] line-clamp-1">{video.creator.displayName}</p>
        )}
      </div>

      {/* Long-press actions overlay */}
      {showActions && (
        <div
          className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 animate-fade-in z-10"
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
