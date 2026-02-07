import React, { useState } from 'react';
import { Bookmark, X, Route, Check, Clock, Coins, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedVideo } from '@/hooks/useSavedVideos';
import { NeuButton } from './NeuButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';

interface SavedVideosGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  savedVideos: SavedVideo[];
  onUnsave: (contentId: string) => void;
  onAddToRoute?: (video: SavedVideo) => void;
}

export const SavedVideosGallery: React.FC<SavedVideosGalleryProps> = ({
  isOpen,
  onClose,
  savedVideos,
  onUnsave,
  onAddToRoute,
}) => {
  const { light } = useHapticFeedback();
  const [filter, setFilter] = useState<'all' | 'promos' | 'posts'>('all');

  if (!isOpen) return null;

  const filtered = savedVideos.filter((v) => {
    if (filter === 'promos') return v.type === 'promo';
    if (filter === 'posts') return v.type !== 'promo';
    return true;
  });

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-primary fill-primary" />
          <h2 className="text-lg font-semibold text-foreground">Saved</h2>
          <span className="text-sm text-muted-foreground">({savedVideos.length})</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3">
        {(['all', 'promos', 'posts'] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              light();
              setFilter(f);
            }}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted',
            )}
          >
            {f === 'all' ? 'All' : f === 'promos' ? 'Promos' : 'Posts'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-20">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Bookmark className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No saved videos yet</p>
            <p className="text-xs mt-1">Tap the save button on any video</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {filtered.map((video) => (
              <SavedVideoCard
                key={video.id}
                video={video}
                onUnsave={onUnsave}
                onAddToRoute={onAddToRoute}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Individual Card ─── */
interface SavedVideoCardProps {
  video: SavedVideo;
  onUnsave: (contentId: string) => void;
  onAddToRoute?: (video: SavedVideo) => void;
}

const SavedVideoCard: React.FC<SavedVideoCardProps> = ({
  video,
  onUnsave,
  onAddToRoute,
}) => {
  const [showActions, setShowActions] = useState(false);
  const { light, medium } = useHapticFeedback();

  return (
    <div className="relative aspect-[9/16] rounded-lg overflow-hidden group">
      <img
        src={video.thumbnail}
        alt={video.title}
        className="w-full h-full object-cover"
        onClick={() => {
          light();
          setShowActions(!showActions);
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Promo badge */}
      {video.type === 'promo' && (
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary/80 text-[10px] font-bold text-primary-foreground">
          PROMO
        </div>
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
          <p className="text-white/60 text-[10px] line-clamp-1">
            {video.creator.displayName}
          </p>
        )}
      </div>

      {/* Actions overlay */}
      {showActions && (
        <div
          className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Add to Route – only for promos that require physical action */}
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
                <>
                  <Check className="w-4 h-4" /> In Route
                </>
              ) : (
                <>
                  <Route className="w-4 h-4" /> Add to Route
                </>
              )}
            </button>
          )}

          {/* Remove saved */}
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

          {/* Close overlay */}
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

export default SavedVideosGallery;
