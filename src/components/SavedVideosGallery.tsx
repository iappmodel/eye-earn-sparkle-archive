import React, { useState, useCallback, useMemo } from 'react';
import { Bookmark, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedVideo } from '@/hooks/useSavedVideos';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ShareSheet } from '@/components/ShareSheet';
import SavedVideoPlayer from '@/components/saved-gallery/SavedVideoPlayer';
import SavedVideoCard from '@/components/saved-gallery/SavedVideoCard';

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
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentsContentId, setCommentsContentId] = useState<string | null>(null);
  const [shareVideo, setShareVideo] = useState<SavedVideo | null>(null);

  const filtered = useMemo(
    () =>
      savedVideos.filter((v) => {
        if (filter === 'promos') return v.type === 'promo';
        if (filter === 'posts') return v.type !== 'promo';
        return true;
      }),
    [savedVideos, filter],
  );

  const activeVideo = activeVideoIndex !== null ? filtered[activeVideoIndex] ?? null : null;

  const handlePlay = useCallback(
    (video: SavedVideo) => {
      const idx = filtered.findIndex((v) => v.id === video.id);
      if (idx >= 0) setActiveVideoIndex(idx);
    },
    [filtered],
  );

  const handleToggleLike = useCallback((contentId: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  }, []);

  const handleUnsaveFromPlayer = useCallback(
    (contentId: string) => {
      onUnsave(contentId);
      if (filtered.length <= 1) {
        setActiveVideoIndex(null);
      } else if (activeVideoIndex !== null && activeVideoIndex >= filtered.length - 1) {
        setActiveVideoIndex(Math.max(0, filtered.length - 2));
      }
    },
    [onUnsave, filtered.length, activeVideoIndex],
  );

  const handlePlayerNavigate = useCallback((index: number) => {
    setActiveVideoIndex(index);
  }, []);

  if (!isOpen) return null;

  return (
    <>
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
              onClick={() => { light(); setFilter(f); }}
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
                  onPlay={handlePlay}
                  onUnsave={onUnsave}
                  onAddToRoute={onAddToRoute}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full-screen player */}
      {activeVideo && activeVideoIndex !== null && (
        <SavedVideoPlayer
          video={activeVideo}
          filteredVideos={filtered}
          currentIndex={activeVideoIndex}
          likedIds={likedIds}
          onBack={() => setActiveVideoIndex(null)}
          onToggleLike={handleToggleLike}
          onComment={(id) => setCommentsContentId(id)}
          onShare={(v) => setShareVideo(v)}
          onUnsave={handleUnsaveFromPlayer}
          onAddToRoute={onAddToRoute}
          onNavigate={handlePlayerNavigate}
        />
      )}

      {/* Comments panel */}
      <CommentsPanel
        isOpen={!!commentsContentId}
        onClose={() => setCommentsContentId(null)}
        contentId={commentsContentId || ''}
      />

      {/* Share sheet */}
      <ShareSheet
        isOpen={!!shareVideo}
        onClose={() => setShareVideo(null)}
        title={shareVideo?.title || 'Check out this content!'}
        url={shareVideo ? `${window.location.origin}/content/${shareVideo.contentId}` : ''}
      />
    </>
  );
};

export default SavedVideosGallery;
