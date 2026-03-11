// Promo Videos Feed – Right swipe screen: rewards, video playback, share/save, filters
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Gift,
  Coins,
  Clock,
  Check,
  Eye,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  SkipForward,
  SkipBack,
  Flag,
  RefreshCw,
  Sparkles,
  Maximize,
  RotateCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { rewardsService } from '@/services/rewards.service';
import { toast } from 'sonner';
import { Neu3DButton, VideoTheme } from '@/components/ui/Neu3DButton';
import { GlassText } from '@/components/ui/GlassText';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { ShareSheet } from '@/components/ShareSheet';
import { usePromoFeed, type PromoFeedItem, type PromoFeedRewardFilter } from '@/hooks/usePromoFeed';
import { useVideoMute } from '@/contexts/VideoMuteContext';
import { useSavedVideos } from '@/hooks/useSavedVideos';
import { useContentLikes } from '@/hooks/useContentLikes';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useEyeTracking } from '@/hooks/useEyeTracking';
import { useMediaSettings } from './MediaSettings';
import { dispatchCameraUserStart } from '@/lib/utils';

const themeOverlays: Record<VideoTheme, string> = {
  purple: 'from-[hsl(270,95%,10%,0.4)] via-transparent to-[hsl(270,95%,5%,0.8)]',
  magenta: 'from-[hsl(320,90%,10%,0.4)] via-transparent to-[hsl(320,90%,5%,0.8)]',
  cyan: 'from-[hsl(185,100%,10%,0.4)] via-transparent to-[hsl(185,100%,5%,0.8)]',
  gold: 'from-[hsl(45,100%,10%,0.4)] via-transparent to-[hsl(45,100%,5%,0.8)]',
  emerald: 'from-[hsl(160,84%,10%,0.4)] via-transparent to-[hsl(160,84%,5%,0.8)]',
  rose: 'from-[hsl(350,89%,10%,0.4)] via-transparent to-[hsl(350,89%,5%,0.8)]',
};

const themeProgressBars: Record<VideoTheme, string> = {
  purple: 'bg-[hsl(270,95%,65%)]',
  magenta: 'bg-[hsl(320,90%,60%)]',
  cyan: 'bg-[hsl(185,100%,50%)]',
  gold: 'bg-[hsl(45,100%,55%)]',
  emerald: 'bg-[hsl(160,84%,39%)]',
  rose: 'bg-[hsl(350,89%,60%)]',
};

interface PromoVideosFeedProps {
  isActive: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onRewardEarned?: (amount: number, type: 'vicoin' | 'icoin') => void;
}

const REWARD_FILTERS: { value: PromoFeedRewardFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'vicoin', label: 'Vicoins' },
  { value: 'icoin', label: 'Icoins' },
];

export const PromoVideosFeed: React.FC<PromoVideosFeedProps> = ({
  isActive,
  onSwipeLeft,
  onSwipeRight,
  onRewardEarned,
}) => {
  const { user, refreshProfile } = useAuth();
  const haptics = useHapticFeedback();
  const [rewardFilter, setRewardFilter] = useState<PromoFeedRewardFilter>('all');
  const promoFeed = usePromoFeed({ rewardFilter });
  const { items: feedItems, isLoading, error, fromBackend, refresh } = promoFeed;
  const { saveVideo, isSaved } = useSavedVideos();
  const contentLikes = useContentLikes();
  const { eyeTrackingEnabled, attentionPreset, requiredAttentionOverride } = useMediaSettings();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const { isMuted, toggleMute } = useVideoMute();
  const [isPaused, setIsPaused] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [shareItem, setShareItem] = useState<PromoFeedItem | null>(null);
  const [localItems, setLocalItems] = useState<PromoFeedItem[]>([]);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [attentionSessionId, setAttentionSessionId] = useState<string | null>(null);

  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const claimModalRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const lastTapRef = useRef(0);

  // Sync feed items and reset index when filter or data changes
  useEffect(() => {
    setLocalItems(feedItems);
    if (currentIndex >= feedItems.length) setCurrentIndex(Math.max(0, feedItems.length - 1));
  }, [feedItems, rewardFilter]);

  // Fetch like counts for visible content (current + adjacent for preload)
  useEffect(() => {
    const windowSize = 5;
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(feedItems.length, start + windowSize);
    const ids = feedItems.slice(start, end).map((i) => i.id);
    if (ids.length > 0) contentLikes.fetchLikeCounts(ids);
  }, [feedItems, currentIndex, contentLikes.fetchLikeCounts]);

  const currentItem = localItems[currentIndex];
  const currentTheme = currentItem?.theme ?? 'gold';
  const isPromo = currentItem?.type === 'promo';
  const hasVideo = !!(currentItem?.videoUrl && currentItem.videoUrl.length > 0);

  const { getAttentionResult, stopPromoAttention, needsUserGesture } = useEyeTracking({
    enabled: Boolean(user && isActive && isPromo && isWatching && !currentItem?.claimed && eyeTrackingEnabled),
    preset: attentionPreset,
    ...(requiredAttentionOverride > 0 ? { requiredAttentionThreshold: requiredAttentionOverride } : {}),
  });

  const handleWatchComplete = useCallback(async () => {
    if (!currentItem || currentItem.type !== 'promo' || currentItem.claimed || !user) return;
    const duration = currentItem.duration ?? 0;
    if (duration <= 0) return;
    if (!eyeTrackingEnabled) {
      toast.info('Enable Eye Tracking to earn promo rewards');
      return;
    }
    if (needsUserGesture) {
      toast.info('Tap video to enable camera', {
        description: 'Camera access is required to validate attention for promo rewards.',
      });
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(currentItem.id)) {
      toast.info('Preview promo rewards unavailable', {
        description: 'Rewards only work for live campaign items from the backend feed.',
      });
      return;
    }

    stopPromoAttention();
    const attentionResult = getAttentionResult();

    try {
      const { data, error } = await supabase.functions.invoke('validate-attention', {
        body: {
          contentId: currentItem.id,
          attentionScore: attentionResult.score,
          attentiveMs: attentionResult.attentiveMs,
          totalMs: attentionResult.totalMs,
          source: attentionResult.source,
          sourceConfidence: attentionResult.sourceConfidence,
          watchDuration: duration,
          totalDuration: duration,
          framesDetected: attentionResult.framesDetected,
          totalFrames: attentionResult.totalFrames,
          samples: attentionResult.samples,
        },
      });
      if (error || !data?.validated || !data.attentionSessionId) {
        if (!data?.validated) {
          const isWatchIncomplete =
            data?.reason === 'watch_incomplete' || data?.reasonCodes?.includes('watch_incomplete');
          toast.info(
            isWatchIncomplete
              ? (data?.message ?? 'Full watch required. No credit for partial views.')
              : 'Keep watching with attention to earn rewards'
          );
        }
        return;
      }
      setAttentionSessionId(data.attentionSessionId);
      setShowReward(true);
      navigator.vibrate?.([100, 50, 100]);
    } catch {
      toast.error('Could not validate watch');
    }
  }, [currentItem, user, eyeTrackingEnabled, needsUserGesture, stopPromoAttention, getAttentionResult]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartY.current - touchEndY.current;
    if (Math.abs(diff) > 50 && localItems.length > 0) {
      haptics.light();
      const len = localItems.length;
      setCurrentIndex((prev) =>
        diff > 0 ? (prev + 1) % len : (prev - 1 + len) % len
      );
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  }, [localItems.length, haptics]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (Math.abs(e.deltaY) > 30 && localItems.length > 0) {
        haptics.light();
        const len = localItems.length;
        setCurrentIndex((prev) =>
          e.deltaY > 0 ? (prev + 1) % len : (prev - 1 + len) % len
        );
      }
    },
    [localItems.length, haptics]
  );

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleScreenTap = useCallback(
    async (e?: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        lastTapRef.current = 0;
        if (currentItem && currentItem.type === 'user_post') {
          const result = await contentLikes.toggleLike(currentItem.id);
          if (result.success) haptics.success();
          else toast.error('Could not update like');
        }
        return;
      }
      lastTapRef.current = now;
      if (isPromo && eyeTrackingEnabled) {
        dispatchCameraUserStart();
      }
      setShowControls((prev) => !prev);
      if (!showControls) resetControlsTimeout();
    },
    [currentItem, isPromo, eyeTrackingEnabled, showControls, resetControlsTimeout, haptics, contentLikes]
  );

  useEffect(() => () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (isActive && currentItem && isPromo && !currentItem.claimed && !isPaused) setIsWatching(true);
    else setIsWatching(false);
  }, [isActive, currentIndex, currentItem, isPaused, isPromo]);

  // Progress: video-driven when hasVideo, else timer
  useEffect(() => {
    if (!currentItem || !isPromo || currentItem.claimed) return;
    if (hasVideo && videoRef.current) {
      const video = videoRef.current;
      const onTimeUpdate = () => {
        if (video.duration && isFinite(video.duration))
          setProgress((video.currentTime / Math.min(video.duration, currentItem.duration)) * 100);
      };
      const onEnded = () => {
        setProgress(100);
        setIsWatching(false);
        handleWatchComplete();
        const len = Math.max(1, localItems.length);
        setCurrentIndex((prev) => (prev + 1) % len);
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('ended', onEnded);
      return () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('ended', onEnded);
      };
    }
    if (isWatching) {
      const duration = currentItem.duration * 1000;
      const startTime = Date.now();
      progressInterval.current = setInterval(() => {
        const newProgress = Math.min(((Date.now() - startTime) / duration) * 100, 100);
        setProgress(newProgress);
        if (newProgress >= 100) {
          if (progressInterval.current) clearInterval(progressInterval.current);
          setIsWatching(false);
          handleWatchComplete();
          const len = Math.max(1, localItems.length);
          setCurrentIndex((prev) => (prev + 1) % len);
        }
      }, 50);
      return () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
      };
    }
  }, [isWatching, currentItem, isPromo, hasVideo, handleWatchComplete, localItems.length]);

  useEffect(() => {
    setProgress(0);
    setShowReward(false);
    setAttentionSessionId(null);
    setIsPaused(false);
    setVideoLoading(true);
    setVideoError(false);
    setPlaybackRate(1);
  }, [currentIndex]);

  // Focus trap for claim reward modal
  useEffect(() => {
    if (!showReward || !claimModalRef.current) return;
    const el = claimModalRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [showReward]);

  // Sync video element play/pause, mute, and playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!hasVideo || !video) return;
    video.muted = isMuted;
    video.playbackRate = playbackRate;
    if (isActive && !isPaused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive, isPaused, isMuted, playbackRate, hasVideo, currentIndex]);

  const claimReward = useCallback(async () => {
    if (!currentItem || !isPromo || currentItem.claimed || isClaimingReward || !currentItem.reward)
      return;
    if (!attentionSessionId) {
      toast.error('Session expired', { description: 'Please watch the video again to claim.' });
      return;
    }
    setIsClaimingReward(true);
    try {
      const result = await rewardsService.issueReward('promo_view', currentItem.id, {
        attentionSessionId,
      });
      if (result.success && result.amount) {
        setLocalItems((prev) =>
          prev.map((v, idx) => (idx === currentIndex ? { ...v, claimed: true } : v))
        );
        await refreshProfile();
        onRewardEarned?.(result.amount, result.coinType || currentItem.reward.type);
        const coinLabel = result.coinType === 'vicoin' ? 'Vicoins' : 'Icoins';
        toast.success(`+${result.amount} ${coinLabel}!`, {
          description: result.dailyRemaining?.promo_views != null && result.dailyRemaining.promo_views < 5
            ? `${result.dailyRemaining.promo_views} rewards left today`
            : undefined,
        });
        haptics.success();
        setTimeout(() => setShowReward(false), 1200);
      } else if (result.error) {
        if (result.error.includes('already claimed') || result.error.includes('Reward already')) {
          setLocalItems((prev) =>
            prev.map((v, idx) => (idx === currentIndex ? { ...v, claimed: true } : v))
          );
          setShowReward(false);
        } else if (result.error.includes('limit') || result.error.includes('Daily')) {
          toast.info('Daily limit reached', { description: 'Come back tomorrow for more rewards!' });
        } else if (result.error.includes('Watch more')) {
          toast.warning('Keep watching', { description: result.error });
        } else if (result.code === 'invalid_session' || result.error?.includes('session')) {
          setShowReward(false);
          setAttentionSessionId(null);
          toast.error('Session expired', { description: 'Please watch the video again to claim.' });
        } else {
          toast.error('Could not claim', { description: result.error });
        }
      }
    } catch (err) {
      console.error('Error claiming reward:', err);
      toast.error('Connection error', { description: 'Please try again' });
    } finally {
      setIsClaimingReward(false);
    }
  }, [currentItem, currentIndex, isClaimingReward, isPromo, attentionSessionId, onRewardEarned, refreshProfile, haptics]);

  const handleRefresh = useCallback(async () => {
    await refresh();
    setCurrentIndex(0);
    if (error) toast.success('Feed refreshed');
  }, [refresh, error]);

  const handleSave = useCallback(() => {
    if (!currentItem) return;
    saveVideo({
      contentId: currentItem.id,
      title: currentItem.title,
      thumbnail: currentItem.thumbnail,
      type: currentItem.type === 'promo' ? 'promo' : 'video',
      videoSrc: currentItem.videoUrl || undefined,
      src: currentItem.thumbnail,
      creator: currentItem.brandName
        ? { displayName: currentItem.brandName }
        : currentItem.username
          ? { displayName: currentItem.username }
          : undefined,
      reward: currentItem.reward,
      duration: currentItem.duration,
    });
    haptics.success();
    toast.success('Saved for later');
  }, [currentItem, saveVideo, haptics]);

  const handleReport = useCallback(() => {
    haptics.light();
    toast.success("Thanks, we'll review this.");
  }, [haptics]);

  const formatNumber = (num: number) =>
    num >= 1_000_000 ? (num / 1_000_000).toFixed(1) + 'M' : num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toString();

  const goNext = useCallback(() => {
    if (localItems.length === 0) return;
    haptics.light();
    const len = Math.max(1, localItems.length);
    setCurrentIndex((prev) => (prev + 1) % len);
  }, [localItems.length, haptics]);

  const goPrev = useCallback(() => {
    haptics.light();
    const len = Math.max(1, localItems.length);
    setCurrentIndex((prev) => (prev - 1 + len) % len);
  }, [localItems.length, haptics]);

  const handleVideoLoadedData = useCallback(() => {
    setVideoLoading(false);
    setVideoError(false);
  }, []);

  const handleVideoError = useCallback(() => {
    setVideoLoading(false);
    setVideoError(true);
  }, []);

  const handleVideoRetry = useCallback(() => {
    setVideoError(false);
    setVideoLoading(true);
    const video = videoRef.current;
    if (video && currentItem?.videoUrl) {
      video.load();
      video.play().catch(() => {});
    }
  }, [currentItem?.videoUrl]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => haptics.light()).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => haptics.light()).catch(() => {});
    }
    resetControlsTimeout();
  }, [haptics, resetControlsTimeout]);

  const seekBack = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 10);
    haptics.light();
    resetControlsTimeout();
  }, [haptics, resetControlsTimeout]);

  const seekForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : currentItem?.duration ?? 999;
    video.currentTime = Math.min(duration, video.currentTime + 10);
    haptics.light();
    resetControlsTimeout();
  }, [currentItem?.duration, haptics, resetControlsTimeout]);

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((r) => (r >= 1.5 ? 1 : 1.5));
    haptics.light();
    resetControlsTimeout();
  }, [haptics, resetControlsTimeout]);

  // Loading state
  if (isLoading && localItems.length === 0) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm">Loading promos...</p>
      </div>
    );
  }

  // Empty state
  if (localItems.length === 0) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-center">No promos right now</h2>
        <p className="text-muted-foreground text-center text-sm max-w-xs">
          Check back later or pull to refresh for new rewards.
        </p>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-medium"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>
    );
  }

  const atStart = currentIndex === 0;
  const atEnd = currentIndex === localItems.length - 1;

  const content = (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      onClick={(e) => handleScreenTap(e as unknown as React.MouseEvent)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Background: video or image */}
      <div className="absolute inset-0">
        {hasVideo ? (
          <video
            ref={videoRef}
            src={currentItem.videoUrl}
            poster={currentItem.thumbnail}
            className="w-full h-full object-cover"
            muted={isMuted}
            playsInline
            loop={!isPromo}
            onLoadedData={handleVideoLoadedData}
            onCanPlay={handleVideoLoadedData}
            onError={handleVideoError}
            style={{ opacity: isPaused ? 0.85 : 1 }}
          />
        ) : (
          <img
            src={currentItem.thumbnail}
            alt={currentItem.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className={cn('absolute inset-0 bg-gradient-to-b', themeOverlays[currentTheme])} />
      </div>

      {/* Video loading overlay */}
      {hasVideo && videoLoading && !videoError && (
        <div className="absolute inset-0 z-[13] flex items-center justify-center bg-black/30">
          <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Video error overlay: fallback thumbnail message + retry */}
      {hasVideo && videoError && (
        <div className="absolute inset-0 z-[13] flex flex-col items-center justify-center gap-4 bg-black/50 p-6">
          <AlertCircle className="w-12 h-12 text-amber-400" />
          <p className="text-white text-sm text-center">Couldn&apos;t load video</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleVideoRetry();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 text-white font-medium text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Video play/pause when hasVideo and paused */}
      {hasVideo && isPaused && !videoLoading && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center z-[14] pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Top: filter chips */}
      <div className="absolute top-2 left-2 right-2 z-20 flex justify-center gap-2 flex-wrap">
        {REWARD_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={(e) => {
              e.stopPropagation();
              setRewardFilter(value);
              setCurrentIndex(0);
              haptics.light();
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              rewardFilter === value
                ? 'bg-white/25 text-white border border-white/40'
                : 'bg-white/10 text-white/80 border border-transparent'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Promo: progress bar + reward badge */}
      {isPromo && currentItem.reward && (
        <div className="absolute top-12 left-0 right-0 z-20 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-4 h-4 text-white shrink-0" />
            <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  progress >= 100 ? 'bg-green-400' : themeProgressBars[currentTheme]
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <GlassText theme={currentTheme} variant="glow" size="sm">
              {Math.ceil((currentItem.duration * (100 - progress)) / 100)}s
            </GlassText>
          </div>
          <div className="flex items-center justify-center gap-2 glass-neon rounded-full px-4 py-2 w-fit mx-auto">
            <Coins
              className={cn(
                'w-5 h-5',
                currentItem.reward.type === 'icoin' ? 'text-icoin' : 'text-primary'
              )}
            />
            <GlassText
              theme={currentItem.reward.type === 'icoin' ? 'gold' : currentTheme}
              variant="gradient"
              size="lg"
            >
              +{currentItem.reward.amount}
            </GlassText>
            <span className="text-white/70 text-sm">
              {currentItem.reward.type === 'vicoin' ? 'Vicoins' : 'Icoins'}
            </span>
          </div>
        </div>
      )}

      {/* Header: brand / user */}
      <div
        className={cn(
          'absolute left-0 right-0 z-10 px-4',
          isPromo && currentItem.reward ? 'top-44' : 'top-14'
        )}
      >
        <div className="flex items-center gap-3 glass-neon rounded-2xl p-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/50 shrink-0">
            <img
              src={isPromo ? currentItem.brandLogo : currentItem.avatar}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <GlassText theme={currentTheme} variant="3d" size="lg" as="p" className="truncate">
              {isPromo ? currentItem.brandName : currentItem.username}
            </GlassText>
            <p className="text-white/60 text-xs flex items-center gap-1">
              {isPromo ? (
                <>
                  <Gift className="w-3 h-3 shrink-0" /> Sponsored
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 shrink-0" /> {formatNumber(contentLikes.getLikeCount(currentItem.id, currentItem.likes || 0))} likes
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Claim reward modal - focus trapped for keyboard/screen reader */}
      {showReward && isPromo && !currentItem.claimed && currentItem.reward && (
        <div
          ref={claimModalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-reward-title"
          aria-describedby="claim-reward-amount"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          <div className="glass-neon rounded-3xl p-8 mx-6 text-center animate-scale-in">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-primary/30 to-accent/20">
              <Coins
                className={cn(
                  'w-10 h-10',
                  currentItem.reward.type === 'icoin' ? 'text-icoin' : 'text-primary'
                )}
              />
            </div>
            <GlassText id="claim-reward-title" theme={currentTheme} variant="gradient" size="xl" as="h3" className="mb-2">
              Reward Earned!
            </GlassText>
            <GlassText
              id="claim-reward-amount"
              theme={currentItem.reward.type === 'icoin' ? 'gold' : currentTheme}
              variant="neon"
              className="text-5xl mb-2 block"
            >
              +{currentItem.reward.amount}
            </GlassText>
            <button
              onClick={(e) => {
                e.stopPropagation();
                claimReward();
              }}
              disabled={isClaimingReward}
              className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-primary to-accent text-white flex items-center justify-center gap-2"
            >
              {isClaimingReward ? (
                'Claiming...'
              ) : (
                <>
                  <Check className="w-5 h-5" /> Claim Reward
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Claimed badge */}
      {isPromo && currentItem.claimed && (
        <div className="absolute top-52 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 glass-neon rounded-full px-4 py-2 border border-green-500/30">
            <Check className="w-5 h-5 text-green-400" />
            <GlassText theme="emerald" variant="glow" size="sm">
              Reward Claimed
            </GlassText>
          </div>
        </div>
      )}

      {/* Always-available accessible button to show controls when hidden */}
      {!showControls && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowControls(true);
            resetControlsTimeout();
          }}
          className={cn(
            'absolute left-4 bottom-24 z-20',
            'w-10 h-10 rounded-full',
            'flex items-center justify-center',
            'bg-white/20 backdrop-blur-sm text-white',
            'border border-white/40',
            'hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-transparent',
            'transition-colors'
          )}
          aria-label="Show video controls"
          title="Show controls"
        >
          <Eye className="w-5 h-5" aria-hidden />
        </button>
      )}

      {/* Overlay controls (play/pause, mute, seek, rate, fullscreen, skip) */}
      {showControls && (
        <div
          className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-full px-4">
            <Neu3DButton
              onClick={() => {
                if (isPromo && eyeTrackingEnabled) {
                  dispatchCameraUserStart();
                }
                if (hasVideo && videoRef.current) {
                  if (isPaused) videoRef.current.play();
                  else videoRef.current.pause();
                }
                setIsPaused(!isPaused);
                resetControlsTimeout();
              }}
              theme={currentTheme}
              variant="glass"
              size="lg"
            >
              {isPaused ? <Play className="w-8 h-8 ml-1" /> : <Pause className="w-8 h-8" />}
            </Neu3DButton>
            <Neu3DButton
              onClick={() => {
                toggleMute();
                resetControlsTimeout();
              }}
              theme={currentTheme}
              variant="glass"
            >
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </Neu3DButton>
            {hasVideo && (
              <>
                <Neu3DButton onClick={seekBack} theme={currentTheme} variant="glass" title="Back 10s">
                  <SkipBack className="w-6 h-6" />
                </Neu3DButton>
                <Neu3DButton onClick={seekForward} theme={currentTheme} variant="glass" title="Forward 10s">
                  <SkipForward className="w-6 h-6" />
                </Neu3DButton>
                <Neu3DButton onClick={cyclePlaybackRate} theme={currentTheme} variant="glass" title="Playback speed">
                  <RotateCw className="w-6 h-6" />
                  <span className="text-xs ml-1">{playbackRate}x</span>
                </Neu3DButton>
                <Neu3DButton onClick={toggleFullscreen} theme={currentTheme} variant="glass" title="Fullscreen">
                  <Maximize className="w-6 h-6" />
                </Neu3DButton>
              </>
            )}
            {isPromo && !currentItem.claimed && (
              <Neu3DButton onClick={() => { goNext(); resetControlsTimeout(); }} theme={currentTheme} variant="glass">
                <SkipForward className="w-6 h-6" />
                <span className="text-xs ml-1">Next</span>
              </Neu3DButton>
            )}
          </div>
        </div>
      )}

      {/* Right rail: like, comment, share, save, report */}
      <div className="absolute right-4 bottom-36 z-10 flex flex-col items-center gap-4">
        <button
          className="flex flex-col items-center gap-1"
          onClick={async (e) => {
            e.stopPropagation();
            if (currentItem?.type === 'user_post') {
              const result = await contentLikes.toggleLike(currentItem.id);
              if (result.success) haptics.success();
              else toast.error('Could not update like');
            }
          }}
        >
          <div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center">
            <Heart
              className={cn(
                'w-6 h-6',
                currentItem?.type === 'user_post' && contentLikes.isLiked(currentItem?.id ?? '')
                  ? 'fill-red-500 text-red-500'
                  : 'text-white'
              )}
            />
          </div>
          <span className="text-white text-xs">
            {currentItem?.type === 'user_post'
              ? formatNumber(contentLikes.getLikeCount(currentItem?.id ?? '', currentItem?.likes ?? 0))
              : 'Like'}
          </span>
        </button>
        {currentItem?.type === 'user_post' && (
          <>
            <button className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-xs">{formatNumber(currentItem.comments ?? 0)}</span>
            </button>
          </>
        )}
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            setShareItem(currentItem ?? null);
          }}
        >
          <div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs">Share</span>
        </button>
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
        >
          <div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center">
            <Bookmark
              className={cn('w-6 h-6', isSaved(currentItem?.id ?? '') ? 'fill-primary text-primary' : 'text-white')}
            />
          </div>
          <span className="text-white text-xs">{isSaved(currentItem?.id ?? '') ? 'Saved' : 'Save'}</span>
        </button>
        <button
          className="flex flex-col items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            handleReport();
          }}
        >
          <div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center">
            <Flag className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs">Report</span>
        </button>
      </div>

      {/* Title + description */}
      <div className="absolute bottom-28 left-4 right-20 z-10">
        <GlassText theme={currentTheme} variant="3d" size="xl" as="h2" className="mb-2">
          {currentItem.title}
        </GlassText>
        <p className="text-white/80 text-sm line-clamp-2">{currentItem.description}</p>
      </div>

      {/* Swipe hint (only near bottom, first few items; hide at end) */}
      {currentIndex < 3 && !atEnd && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <div className="flex flex-col items-center gap-1 animate-bounce">
            <div className="w-1 h-6 bg-white/30 rounded-full" />
            <span className="text-white/50 text-xs">Swipe</span>
          </div>
        </div>
      )}

      {/* Position + source badge */}
      <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
        <div className="glass-neon rounded-full px-3 py-1">
          <span className="text-white/80 text-sm">
            {currentIndex + 1}/{localItems.length}
          </span>
        </div>
        {fromBackend && (
          <span className="text-white/50 text-[10px]">Live</span>
        )}
      </div>

      {/* End of feed card */}
      {atEnd && localItems.length > 0 && (
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
    </div>
  );

  return (
    <>
      <PullToRefresh onRefresh={handleRefresh} className="h-full w-full overflow-hidden">
        {content}
      </PullToRefresh>
      <ShareSheet
        isOpen={!!shareItem}
        onClose={() => setShareItem(null)}
        contentId={shareItem?.id ?? null}
        title={shareItem?.title}
        description={shareItem?.description}
        mediaUrl={shareItem?.videoUrl ?? undefined}
        mediaType="video"
      />
    </>
  );
};

export default PromoVideosFeed;
