import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Route,
  Check,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';
import type { SavedVideo } from '@/hooks/useSavedVideos';

interface SavedVideoPlayerProps {
  video: SavedVideo;
  filteredVideos: SavedVideo[];
  currentIndex: number;
  likedIds: Set<string>;
  onBack: () => void;
  onToggleLike: (contentId: string) => void;
  onComment: (contentId: string) => void;
  onShare: (video: SavedVideo) => void;
  onUnsave: (contentId: string) => void;
  onAddToRoute?: (video: SavedVideo) => void;
  onNavigate: (index: number) => void;
}

const SavedVideoPlayer: React.FC<SavedVideoPlayerProps> = ({
  video,
  filteredVideos,
  currentIndex,
  likedIds,
  onBack,
  onToggleLike,
  onComment,
  onShare,
  onUnsave,
  onAddToRoute,
  onNavigate,
}) => {
  const { light, medium } = useHapticFeedback();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  // Swipe tracking
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const isLiked = likedIds.has(video.contentId);
  const hasVideo = !!video.videoSrc;

  // Auto-play on mount / video change
  useEffect(() => {
    if (videoRef.current && hasVideo) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [video.contentId, hasVideo]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  }, []);

  /* ── Swipe handlers ── */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientX - touchStartX.current;
    setSwipeOffset(touchDelta.current);
  };

  const handleTouchEnd = () => {
    const threshold = 80;
    if (touchDelta.current < -threshold && currentIndex < filteredVideos.length - 1) {
      onNavigate(currentIndex + 1);
    } else if (touchDelta.current > threshold && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
    setSwipeOffset(0);
    touchDelta.current = 0;
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Top bar ── */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => { light(); onBack(); }}
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {video.creator?.avatarUrl && (
          <Avatar className="h-8 w-8 border border-white/30">
            <AvatarImage src={video.creator.avatarUrl} />
            <AvatarFallback>{(video.creator.displayName || 'U')[0]}</AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {video.creator?.displayName || video.creator?.username || 'Creator'}
          </p>
          <p className="text-white/60 text-xs truncate">{video.title}</p>
        </div>
      </div>

      {/* ── Media area ── */}
      <div
        className="flex-1 relative overflow-hidden"
        onClick={hasVideo ? togglePlayPause : undefined}
        style={{ transform: `translateX(${swipeOffset * 0.3}px)`, transition: swipeOffset === 0 ? 'transform 0.25s ease' : 'none' }}
      >
        {hasVideo ? (
          <video
            ref={videoRef}
            src={video.videoSrc}
            poster={video.thumbnail}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            playsInline
            muted={false}
          />
        ) : (
          <img
            src={video.src || video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Play / Pause icon */}
        {showPlayIcon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center animate-fade-in">
              {isPlaying ? <Play className="w-8 h-8 text-white ml-1" /> : <Pause className="w-8 h-8 text-white" />}
            </div>
          </div>
        )}

        {/* Swipe hint arrows */}
        {currentIndex > 0 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none">
            <ChevronLeft className="w-6 h-6 text-white" />
          </div>
        )}
        {currentIndex < filteredVideos.length - 1 && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none">
            <ChevronRight className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* ── Right-side action buttons ── */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
        {/* Like */}
        <button
          onClick={(e) => { e.stopPropagation(); medium(); onToggleLike(video.contentId); }}
          className="flex flex-col items-center gap-1"
        >
          <Heart className={cn('w-7 h-7', isLiked ? 'fill-red-500 text-red-500' : 'text-white')} />
          <span className="text-white text-[10px]">{isLiked ? 'Liked' : 'Like'}</span>
        </button>

        {/* Comment */}
        <button
          onClick={(e) => { e.stopPropagation(); light(); onComment(video.contentId); }}
          className="flex flex-col items-center gap-1"
        >
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-white text-[10px]">Comment</span>
        </button>

        {/* Share */}
        <button
          onClick={(e) => { e.stopPropagation(); light(); onShare(video); }}
          className="flex flex-col items-center gap-1"
        >
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-white text-[10px]">Share</span>
        </button>

        {/* Unsave */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            medium();
            onUnsave(video.contentId);
            toast.info('Removed from saved');
          }}
          className="flex flex-col items-center gap-1"
        >
          <Bookmark className="w-7 h-7 text-white fill-white" />
          <span className="text-white text-[10px]">Unsave</span>
        </button>

        {/* Add to Route (promos with physical action) */}
        {video.type === 'promo' && video.requiresPhysicalAction && onAddToRoute && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              medium();
              onAddToRoute(video);
            }}
            className="flex flex-col items-center gap-1"
          >
            {video.addedToRoute ? (
              <Check className="w-7 h-7 text-green-400" />
            ) : (
              <Route className="w-7 h-7 text-white" />
            )}
            <span className="text-white text-[10px]">{video.addedToRoute ? 'In Route' : 'Route'}</span>
          </button>
        )}
      </div>

      {/* ── Bottom progress dots ── */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center gap-1.5 z-10 pointer-events-none">
        {filteredVideos.slice(
          Math.max(0, currentIndex - 3),
          Math.min(filteredVideos.length, currentIndex + 4),
        ).map((v, i) => {
          const realIdx = Math.max(0, currentIndex - 3) + i;
          return (
            <div
              key={v.id}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                realIdx === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40',
              )}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SavedVideoPlayer;
