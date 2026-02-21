// Friends Posts Feed – Left swipe: posts from people you follow
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Bookmark,
  UserPlus,
  UserMinus,
  RefreshCw,
  MoreHorizontal,
  Flag,
  Users,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Neu3DButton, VideoTheme } from '@/components/ui/Neu3DButton';
import { GlassText } from '@/components/ui/GlassText';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ShareSheet } from '@/components/ShareSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFriendsFeed, type FriendPost } from '@/hooks/useFriendsFeed';
import { useVideoMute } from '@/contexts/VideoMuteContext';
import { useContentLikes } from '@/hooks/useContentLikes';
import { useSavedVideos } from '@/hooks/useSavedVideos';
import { useFollowBatch } from '@/hooks/useFollow';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';

const themeOverlays: Record<VideoTheme, string> = {
  purple: 'from-[hsl(270,95%,5%,0.3)] via-transparent to-[hsl(270,95%,5%,0.7)]',
  magenta: 'from-[hsl(320,90%,5%,0.3)] via-transparent to-[hsl(320,90%,5%,0.7)]',
  cyan: 'from-[hsl(185,100%,5%,0.3)] via-transparent to-[hsl(185,100%,5%,0.7)]',
  gold: 'from-[hsl(45,100%,5%,0.3)] via-transparent to-[hsl(45,100%,5%,0.7)]',
  emerald: 'from-[hsl(160,84%,5%,0.3)] via-transparent to-[hsl(160,84%,5%,0.7)]',
  rose: 'from-[hsl(350,89%,5%,0.3)] via-transparent to-[hsl(350,89%,5%,0.7)]',
};

const themeProgressBars: Record<VideoTheme, string> = {
  purple: 'bg-[hsl(270,95%,65%)]',
  magenta: 'bg-[hsl(320,90%,60%)]',
  cyan: 'bg-[hsl(185,100%,50%)]',
  gold: 'bg-[hsl(45,100%,55%)]',
  emerald: 'bg-[hsl(160,84%,39%)]',
  rose: 'bg-[hsl(350,89%,60%)]',
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes('gtv-videos-bucket');
}

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return date.toLocaleDateString();
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/** Renders caption with hashtags as styled spans */
function CaptionWithHashtags({ text }: { text: string }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <p className="text-white text-sm leading-relaxed font-medium drop-shadow-lg">
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <span key={i} className="text-primary/90 font-semibold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

interface FriendsPostsFeedProps {
  isActive: boolean;
  onSwipeRight?: () => void;
  /** Called when user taps "Find people to follow" in empty state (following 0 users). */
  onFindPeople?: () => void;
}

export const FriendsPostsFeed: React.FC<FriendsPostsFeedProps> = ({ isActive, onSwipeRight, onFindPeople }) => {
  const haptics = useHapticFeedback();
  const contentLikes = useContentLikes();
  const { isSaved, toggleSave } = useSavedVideos();
  const { items: feedItems, isLoading, refresh, followingCount, fromBackend } = useFriendsFeed();
  const creatorIds = feedItems.map((p) => p.userId);
  const followBatch = useFollowBatch({ creatorIds, skipFetch: true });

  const [posts, setPosts] = useState<FriendPost[]>(feedItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const { isMuted, toggleMute } = useVideoMute();
  const [progress, setProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [sharePost, setSharePost] = useState<FriendPost | null>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // Sync feed into local state and clamp index
  useEffect(() => {
    setPosts(feedItems);
    if (currentIndex >= feedItems.length) setCurrentIndex(Math.max(0, feedItems.length - 1));
  }, [feedItems]);

  // Fetch like counts for visible content (current + adjacent for preload)
  useEffect(() => {
    const windowSize = 5;
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(feedItems.length, start + windowSize);
    const ids = feedItems.slice(start, end).map((p) => p.id);
    if (ids.length > 0) contentLikes.fetchLikeCounts(ids);
  }, [feedItems, currentIndex, contentLikes.fetchLikeCounts]);

  const currentPost = posts[currentIndex];
  const currentTheme = currentPost?.theme ?? 'rose';
  const hasVideo = currentPost ? isVideoUrl(currentPost.videoUrl) : false;

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleScreenTap = useCallback(
    async (e?: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        lastTapRef.current = 0;
        if (currentPost) {
          const result = await contentLikes.toggleLike(currentPost.id);
          if (result.success) haptics.success();
          else toast.error('Could not update like');
        }
        return;
      }
      lastTapRef.current = now;
      setShowControls((prev) => !prev);
      if (!showControls) resetControlsTimeout();
    },
    [currentPost, showControls, resetControlsTimeout, haptics, contentLikes]
  );

  useEffect(() => () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, []);

  // Video progress: real video timeupdate or simulated timer
  useEffect(() => {
    if (!isActive || !currentPost) return;

    if (hasVideo && videoRef.current) {
      const video = videoRef.current;
      const onTimeUpdate = () => {
        if (video.duration && isFinite(video.duration))
          setProgress((video.currentTime / Math.min(video.duration, currentPost.duration)) * 100);
      };
      const onEnded = () => {
        setProgress(100);
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % posts.length);
          setProgress(0);
        }, 300);
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('ended', onEnded);
      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('ended', onEnded);
      };
    }

    if (isPlaying) {
      const duration = currentPost.duration * 1000;
      const startTime = Date.now();
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
        if (newProgress >= 100) {
          if (progressInterval.current) clearInterval(progressInterval.current);
          setCurrentIndex((prev) => (prev + 1) % posts.length);
          setProgress(0);
        }
      }, 50);
      return () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
      };
    }
  }, [isActive, isPlaying, currentIndex, currentPost, posts.length, hasVideo]);

  useEffect(() => setProgress(0), [currentIndex]);

  // Sync video play/pause and mute when post or state changes; pause when feed inactive
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;
    video.muted = isMuted;
    if (isActive && isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [currentIndex, isActive, isPlaying, isMuted, hasVideo]);

  const handleLike = useCallback(async () => {
    if (!currentPost) return;
    const result = await contentLikes.toggleLike(currentPost.id);
    haptics.light();
    if (!result.success) {
      toast.error('Could not update like', { description: 'Please try again.' });
      return;
    }
    toast.success(result.liked ? 'Liked!' : 'Unliked');
  }, [currentPost, haptics, contentLikes]);

  const handleSave = useCallback(() => {
    if (!currentPost) return;
    const wasSaved = toggleSave({
      id: `saved-${currentPost.id}`,
      contentId: currentPost.id,
      title: currentPost.caption || currentPost.displayName || 'Untitled',
      thumbnail: currentPost.thumbnail,
      type: 'video',
      videoSrc: currentPost.videoUrl,
      src: currentPost.thumbnail,
      creator: {
        id: currentPost.userId,
        username: currentPost.username,
        displayName: currentPost.displayName,
        avatarUrl: currentPost.avatar,
      },
    });
    haptics.light();
    toast.success(wasSaved ? 'Saved for later' : 'Removed from saved');
  }, [currentPost, haptics, toggleSave]);

  const handleFollow = useCallback(() => {
    if (!currentPost) return;
    followBatch.toggleFollow(currentPost.userId);
    haptics.success();
  }, [currentPost, followBatch, haptics]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((p) => !p);
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
    haptics.light();
  }, [isPlaying, haptics]);

  const goNext = useCallback(() => {
    if (posts.length === 0) return;
    haptics.light();
    setCurrentIndex((prev) => Math.min(prev + 1, posts.length - 1));
    setProgress(0);
  }, [posts.length, haptics]);

  const goPrev = useCallback(() => {
    haptics.light();
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setProgress(0);
  }, [haptics]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartY.current - touchEndY.current;
    if (Math.abs(diff) > 50 && posts.length > 0) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  }, [posts.length, goNext, goPrev]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (Math.abs(e.deltaY) > 30 && posts.length > 0) {
        e.deltaY > 0 ? goNext() : goPrev();
      }
    },
    [posts.length, goNext, goPrev]
  );

  const handleRefresh = useCallback(async () => {
    await refresh();
    setCurrentIndex(0);
    toast.success('Feed refreshed');
  }, [refresh]);

  const handleReport = useCallback(() => {
    haptics.light();
    toast.success("Thanks, we'll review this.");
  }, [haptics]);

  const openComments = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  }, []);

  const openShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentPost) setSharePost(currentPost);
    },
    [currentPost]
  );

  // Loading
  if (isLoading && posts.length === 0) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm">Loading friends...</p>
      </div>
    );
  }

  // Empty state – differentiate between following nobody vs following but no posts
  if (posts.length === 0) {
    const noFollows = followingCount === 0;
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="w-12 h-12 text-primary" />
        </div>
        {noFollows ? (
          <>
            <h2 className="text-xl font-semibold text-center">You're not following anyone</h2>
            <p className="text-muted-foreground text-center text-sm max-w-xs">
              Find creators to follow and their posts will show up here.
            </p>
            {onFindPeople ? (
              <button
                onClick={() => {
                  haptics.light();
                  onFindPeople();
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-medium"
              >
                <Search className="w-5 h-5" />
                Find people to follow
              </button>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-center">No posts from friends yet</h2>
            <p className="text-muted-foreground text-center text-sm max-w-xs">
              People you follow haven't posted recently. Pull to refresh for new posts.
            </p>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          </>
        )}
      </div>
    );
  }

  const atStart = currentIndex === 0;
  const atEnd = currentIndex === posts.length - 1;

  const content = (
    <div
      className="h-full w-full relative overflow-hidden"
      onClick={(e) => handleScreenTap(e as unknown as React.MouseEvent)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Media: video or image */}
      <div className="absolute inset-0">
        {hasVideo ? (
          <video
            ref={videoRef}
            src={currentPost.videoUrl}
            poster={currentPost.thumbnail}
            className="w-full h-full object-cover"
            muted={isMuted}
            playsInline
            loop={false}
            style={{ opacity: !isPlaying ? 0.9 : 1 }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <img
            src={currentPost.thumbnail}
            alt={currentPost.caption}
            className="w-full h-full object-cover"
          />
        )}
        <div className={cn('absolute inset-0 bg-gradient-to-b', themeOverlays[currentTheme])} />
      </div>

      {/* Play overlay when paused */}
      {hasVideo && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-[14] pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-2 pt-2">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-100 ease-linear',
              themeProgressBars[currentTheme]
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Top: index + live badge */}
      <div className="absolute top-10 left-0 right-0 z-20 px-4 flex items-center justify-between">
        <span className="text-white/80 text-xs font-medium">
          {currentIndex + 1} / {posts.length}
        </span>
        {fromBackend && (
          <span className="text-white/50 text-[10px] bg-white/10 px-2 py-0.5 rounded">Live</span>
        )}
      </div>

      {/* Header: user card */}
      {showControls && (
        <div className="absolute top-14 left-0 right-0 z-10 px-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 glass-neon rounded-2xl p-3">
            <div
              className={cn(
                'w-11 h-11 rounded-full overflow-hidden border-2',
                'border-white/30 shadow-[0_0_15px_hsl(var(--primary)/0.3)]'
              )}
            >
              <img
                src={currentPost.avatar}
                alt={currentPost.username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <GlassText theme={currentTheme} variant="3d" size="md" as="p" className="truncate">
                {currentPost.displayName || currentPost.username}
              </GlassText>
              <p className="text-white/60 text-xs font-medium flex items-center gap-1">
                {currentPost.location ? (
                  <span className="truncate">{currentPost.location}</span>
                ) : (
                  <span>{formatTimeAgo(currentPost.createdAt)}</span>
                )}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFollow();
              }}
              className={cn(
                'px-4 py-2 rounded-xl font-display font-semibold text-sm flex items-center gap-1.5',
                'glass-neon border border-white/20',
                'hover:border-white/40 transition-all',
                (followBatch.isFollowing[currentPost.userId] ?? currentPost.isFollowing) && 'opacity-80'
              )}
            >
              {(followBatch.isFollowing[currentPost.userId] ?? currentPost.isFollowing) ? (
                <>
                  <UserMinus className="w-4 h-4" />
                  <GlassText theme={currentTheme} variant="glow" size="sm">
                    Unfollow
                  </GlassText>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <GlassText theme={currentTheme} variant="glow" size="sm">
                    Follow
                  </GlassText>
                </>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-xl glass-neon border border-white/20 hover:border-white/40"
                >
                  <MoreHorizontal className="w-5 h-5 text-white" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleReport}>
                  <Flag className="w-4 h-4 mr-2" />
                  Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Not interested')}>
                  Not interested
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Center play/pause tap */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handlePlayPause();
        }}
        className="absolute inset-0 z-5 flex items-center justify-center"
      >
        {!isPlaying && (
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center',
              'glass-neon backdrop-blur-xl',
              'shadow-[0_0_40px_hsl(var(--primary)/0.4)]',
              'animate-pulse-3d'
            )}
          >
            <Play className="w-10 h-10 text-white ml-1 drop-shadow-lg" fill="white" />
          </div>
        )}
      </button>

      {/* Left controls */}
      {showControls && (
        <div className="absolute left-4 bottom-36 z-20 flex flex-col items-center gap-4 animate-in fade-in duration-200">
          <Neu3DButton onClick={handlePlayPause} theme={currentTheme} variant="glass">
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </Neu3DButton>
          <Neu3DButton
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
              haptics.light();
            }}
            theme={currentTheme}
            variant="glass"
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </Neu3DButton>
        </div>
      )}

      {/* Right actions */}
      {showControls && (
        <div className="absolute right-4 bottom-36 z-20 flex flex-col items-center gap-4 animate-in fade-in duration-200">
          <Neu3DButton
            onClick={handleLike}
            theme={contentLikes.isLiked(currentPost.id) ? 'rose' : currentTheme}
            variant={contentLikes.isLiked(currentPost.id) ? 'neon' : 'glass'}
            isPressed={contentLikes.isLiked(currentPost.id)}
            count={formatCount(contentLikes.getLikeCount(currentPost.id, currentPost.likes))}
          >
            <Heart className={cn('w-6 h-6', contentLikes.isLiked(currentPost.id) && 'fill-current')} />
          </Neu3DButton>
          <Neu3DButton
            onClick={openComments}
            theme={currentTheme}
            variant="glass"
            count={formatCount(currentPost.comments)}
          >
            <MessageCircle className="w-6 h-6" />
          </Neu3DButton>
          <Neu3DButton onClick={openShare} theme={currentTheme} variant="glass" label="Share">
            <Share2 className="w-6 h-6" />
          </Neu3DButton>
          <Neu3DButton
            onClick={handleSave}
            theme={isSaved(currentPost.id) ? 'gold' : currentTheme}
            variant={isSaved(currentPost.id) ? 'neon' : 'glass'}
            isPressed={isSaved(currentPost.id)}
          >
            <Bookmark className={cn('w-6 h-6', isSaved(currentPost.id) && 'fill-current')} />
          </Neu3DButton>
        </div>
      )}

      {/* Caption + time */}
      <div className="absolute bottom-20 left-0 right-20 z-10 px-4 space-y-1">
        <CaptionWithHashtags text={currentPost.caption} />
        <p className="text-white/50 text-xs">{formatTimeAgo(currentPost.createdAt)}</p>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 text-white/40 text-xs font-medium">
        <ChevronRight className="w-4 h-4" />
        Swipe right for main feed
      </div>

      {/* End of feed */}
      {atEnd && posts.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 z-10 flex flex-col items-center gap-2">
          <p className="text-white/70 text-sm">You're all caught up!</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      )}

      {/* Vertical nav touch areas */}
      <div
        className="absolute top-0 left-0 right-0 h-1/3 z-5"
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 z-5"
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
      />
    </div>
  );

  return (
    <>
      <PullToRefresh onRefresh={handleRefresh} className="h-full w-full overflow-hidden">
        {content}
      </PullToRefresh>
      <CommentsPanel
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        contentId={currentPost?.id ?? ''}
        contentType="friend_post"
      />
      <ShareSheet
        isOpen={!!sharePost}
        onClose={() => setSharePost(null)}
        contentId={sharePost?.id ?? null}
        title={sharePost ? `${sharePost.displayName || sharePost.username}'s post` : undefined}
        description={sharePost?.caption}
        mediaUrl={sharePost?.videoUrl ?? undefined}
        mediaType="video"
      />
    </>
  );
};
