import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { RewardBadge } from './RewardBadge';
import { EyeTrackingIndicator } from './EyeTrackingIndicator';
import { useEyeTracking } from '@/hooks/useEyeTracking';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaCardProps {
  type: 'video' | 'image' | 'promo';
  src: string;
  videoSrc?: string;
  duration?: number;
  reward?: { amount: number; type: 'vicoin' | 'icoin' };
  onComplete?: (attentionValidated: boolean) => void;
  onProgress?: (progress: number) => void;
  onSkip?: () => void;
  isActive?: boolean;
  contentId?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  type,
  src,
  videoSrc,
  duration = 30,
  reward,
  onComplete,
  onProgress,
  onSkip,
  isActive = true,
  contentId,
}) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showRewardBadge, setShowRewardBadge] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [attentionWarning, setAttentionWarning] = useState(false);
  const hasCompleted = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(0);

  // Eye tracking for promo content
  const isPromoContent = type === 'promo' && !!reward;
  const {
    isTracking,
    isFaceDetected,
    attentionScore,
    resetAttention,
    getAttentionResult,
  } = useEyeTracking({
    enabled: isPromoContent && isActive && isPlaying,
    onAttentionLost: () => {
      if (isPromoContent) {
        setAttentionWarning(true);
        toast.warning('Look at the screen to earn reward!', {
          duration: 2000,
        });
      }
    },
    onAttentionRestored: () => {
      setAttentionWarning(false);
    },
    requiredAttentionThreshold: 85,
  });

  // Reset state when media changes
  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
    setShowRewardBadge(false);
    setShowControls(false);
    setAttentionWarning(false);
    hasCompleted.current = false;
    startTimeRef.current = 0;
    resetAttention();
  }, [src, resetAttention]);

  // Show reward badge when promo starts
  useEffect(() => {
    if (type === 'promo' && isActive && reward) {
      setShowRewardBadge(true);
    }
  }, [type, isActive, reward]);

  // Validate attention and complete
  const handlePromoComplete = useCallback(async () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;

    const watchDuration = (Date.now() - startTimeRef.current) / 1000;
    const attentionResult = getAttentionResult();
    
    console.log('[MediaCard] Promo complete, validating attention...', attentionResult);

    try {
      // Validate with backend
      const { data, error } = await supabase.functions.invoke('validate-attention', {
        body: {
          userId: 'anonymous', // Will be replaced with actual user ID
          contentId: contentId || src,
          attentionScore: attentionResult.score,
          watchDuration,
          totalDuration: duration,
          framesDetected: attentionResult.framesDetected,
          totalFrames: attentionResult.totalFrames,
        },
      });

      if (error) {
        console.error('[MediaCard] Validation error:', error);
        onComplete?.(false);
        return;
      }

      console.log('[MediaCard] Validation result:', data);

      if (data?.validated) {
        toast.success('Reward earned!', {
          description: `Attention score: ${attentionResult.score}%`,
        });
        onComplete?.(true);
      } else {
        toast.error('Reward not earned', {
          description: data?.reasons?.join(', ') || 'Attention requirements not met',
        });
        onComplete?.(false);
      }
    } catch (err) {
      console.error('[MediaCard] Validation failed:', err);
      onComplete?.(false);
    }
  }, [contentId, src, duration, getAttentionResult, onComplete]);

  // Progress tracking for images/promos without video
  useEffect(() => {
    if (!isActive || !isPlaying || videoSrc) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (duration * 10));
        if (newProgress >= 100) {
          clearInterval(interval);
          if (isPromoContent) {
            handlePromoComplete();
          } else {
            onComplete?.(true);
          }
          return 100;
        }
        onProgress?.(Math.min(newProgress, 100));
        return Math.min(newProgress, 100);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, isPlaying, duration, videoSrc, isPromoContent, handlePromoComplete, onComplete, onProgress]);

  // Video element progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    const handleTimeUpdate = () => {
      const newProgress = (video.currentTime / video.duration) * 100;
      setProgress(newProgress);
      onProgress?.(newProgress);
    };

    const handleEnded = () => {
      if (isPromoContent) {
        handlePromoComplete();
      } else {
        onComplete?.(true);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isActive, isPromoContent, handlePromoComplete, onComplete, onProgress]);

  // Auto-start promo/video content
  useEffect(() => {
    if ((type === 'promo' || type === 'video') && isActive) {
      const timer = setTimeout(() => {
        setIsPlaying(true);
        startTimeRef.current = Date.now();
        if (videoRef.current) {
          videoRef.current.play().catch(console.error);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [type, isActive]);

  // Sync video mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Auto-hide controls after 3s
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleTap = useCallback(() => {
    setShowControls(prev => !prev);
    if (!showControls) {
      resetControlsTimeout();
    }
  }, [showControls, resetControlsTimeout]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const togglePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(prev => !prev);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handleSkipClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSkip?.();
  }, [onSkip]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className={cn(
        "relative w-full h-full bg-background overflow-hidden select-none",
        attentionWarning && "ring-2 ring-destructive ring-inset"
      )}
      onClick={handleTap}
    >
      {/* Fullscreen media background - image or video */}
      {videoSrc ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={videoSrc}
          poster={src}
          muted={isMuted}
          playsInline
          loop={type !== 'promo'}
        />
      ) : (
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
          style={{ backgroundImage: `url(${src})` }}
        />
      )}
      
      {/* Subtle vignette overlay for depth */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background/60" />
      
      {/* Bottom gradient for controls visibility */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />

      {/* Eye tracking indicator - center top */}
      {isPromoContent && isPlaying && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
          <EyeTrackingIndicator
            isTracking={isTracking}
            isFaceDetected={isFaceDetected}
            attentionScore={attentionScore}
          />
        </div>
      )}

      {/* Attention warning overlay */}
      {attentionWarning && (
        <div className="absolute inset-0 bg-destructive/10 pointer-events-none z-10 animate-pulse" />
      )}

      {/* Reward badge - appears for 3 seconds */}
      {reward && (
        <RewardBadge
          amount={reward.amount}
          type={reward.type}
          isVisible={showRewardBadge}
        />
      )}

      {/* Initial play button overlay - shown before playing starts */}
      {!isPlaying && type !== 'image' && !showControls && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
        >
          <div className="w-24 h-24 rounded-full neu-button flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
            <Play className="w-10 h-10 text-foreground ml-1" />
          </div>
        </button>
      )}

      {/* Tap-to-reveal playback controls - centered on screen */}
      {showControls && type !== 'image' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in">
          <div className="flex items-center gap-6">
            {/* Play/Pause - large center button */}
            <button
              onClick={togglePlayPause}
              className="w-16 h-16 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center transition-all hover:bg-background/80 active:scale-95 shadow-xl"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 text-foreground" />
              ) : (
                <Play className="w-7 h-7 text-foreground ml-1" />
              )}
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="w-12 h-12 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center transition-all hover:bg-background/80 active:scale-95 shadow-lg"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-foreground" />
              ) : (
                <Volume2 className="w-5 h-5 text-foreground" />
              )}
            </button>

            {/* Skip/Next */}
            <button
              onClick={handleSkipClick}
              className="w-12 h-12 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center transition-all hover:bg-background/80 active:scale-95 shadow-lg"
            >
              <SkipForward className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Progress bar for promos - thin line at very bottom */}
      {type === 'promo' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30 z-30">
          <div 
            className={cn(
              'h-full transition-all duration-100 ease-linear',
              reward?.type === 'vicoin' ? 'bg-primary' : 'bg-icoin'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Promo label - subtle top left */}
      {type === 'promo' && (
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-background/50 backdrop-blur-md border border-primary/30 z-20">
          <span className="text-xs font-medium gradient-text">PROMOTED</span>
        </div>
      )}
    </div>
  );
};
