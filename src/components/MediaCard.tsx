import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX, SkipForward, Eye, Clock, Award, XCircle } from 'lucide-react';
import { RewardBadge } from './RewardBadge';
import { EyeTrackingIndicator } from './EyeTrackingIndicator';
import { useEyeTracking } from '@/hooks/useEyeTracking';
import { useMediaSettings } from './MediaSettings';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { notificationSoundService } from '@/services/notificationSound.service';
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
  const [attentionPaused, setAttentionPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration);
  const [showEndStats, setShowEndStats] = useState(false);
  const [endStats, setEndStats] = useState<{ score: number; totalTime: number; attentiveTime: number; eligible: boolean } | null>(null);
  const hasCompleted = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(0);
  const lastWarningTimeRef = useRef<number>(0);

  const { attentionThreshold, eyeTrackingEnabled, soundEffects } = useMediaSettings();
  const haptic = useHapticFeedback();

  // Eye tracking for promo content
  const isPromoContent = type === 'promo' && !!reward;
  const {
    isTracking,
    isFaceDetected,
    attentionScore,
    resetAttention,
    getAttentionResult,
  } = useEyeTracking({
    enabled: isPromoContent && isActive && isPlaying && eyeTrackingEnabled,
    onAttentionLost: () => {
      if (isPromoContent) {
        setAttentionWarning(true);
        // Throttle warning feedback to once per 3 seconds
        const now = Date.now();
        if (now - lastWarningTimeRef.current > 3000) {
          lastWarningTimeRef.current = now;
          if (soundEffects) {
            notificationSoundService.playAttentionWarning();
          }
          haptic.error();
        }
      }
    },
    onAttentionRestored: () => {
      setAttentionWarning(false);
    },
    requiredAttentionThreshold: 85,
  });

  // Handle auto-pause when attention lost for too long (>10% of video time)
  const handleAttentionLostTooLong = useCallback(() => {
    if (isPromoContent && isPlaying && !attentionPaused) {
      setAttentionPaused(true);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isPromoContent, isPlaying, attentionPaused]);

  // Resume from attention pause
  const handleResumeFromAttentionPause = useCallback(() => {
    if (attentionPaused) {
      setAttentionPaused(false);
      setAttentionWarning(false);
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [attentionPaused]);

  // Reset state when media changes
  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
    setShowRewardBadge(false);
    setShowControls(false);
    setAttentionWarning(false);
    setAttentionPaused(false);
    setCurrentTime(0);
    setShowEndStats(false);
    setEndStats(null);
    hasCompleted.current = false;
    startTimeRef.current = 0;
    lastWarningTimeRef.current = 0;
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

    // Calculate stats for display
    const attentiveTime = (attentionResult.framesDetected / Math.max(attentionResult.totalFrames, 1)) * watchDuration;
    const isEligible = attentionResult.score >= 70 && eyeTrackingEnabled;
    
    setEndStats({
      score: attentionResult.score,
      totalTime: watchDuration,
      attentiveTime: attentiveTime,
      eligible: isEligible || !eyeTrackingEnabled, // Always eligible if eye tracking disabled
    });
    setShowEndStats(true);

    // Play appropriate sound
    if (soundEffects) {
      if (isEligible || !eyeTrackingEnabled) {
        notificationSoundService.playReward();
      } else {
        notificationSoundService.playAttentionWarning();
      }
    }
    haptic.success();

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
        onComplete?.(true);
      } else {
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
      setCurrentTime(video.currentTime);
      onProgress?.(newProgress);
    };

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
    };

    const handleEnded = () => {
      if (isPromoContent) {
        handlePromoComplete();
      } else {
        onComplete?.(true);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
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

      {/* Eye tracking indicator - very top center edge */}
      {isPromoContent && (isPlaying || attentionPaused) && eyeTrackingEnabled && (
        <>
          <EyeTrackingIndicator
            isTracking={isTracking}
            isFaceDetected={isFaceDetected}
            attentionScore={attentionScore}
            position="top-center"
            onAttentionLostTooLong={handleAttentionLostTooLong}
            videoDuration={videoDuration}
            currentTime={currentTime}
            attentionThreshold={attentionThreshold}
          />
          
          {/* Real-time attention percentage indicator */}
          {isTracking && !attentionPaused && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 animate-fade-in">
              <div 
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  attentionScore >= 80 ? "bg-green-500" : 
                  attentionScore >= 50 ? "bg-yellow-500" : 
                  attentionScore >= 30 ? "bg-orange-500" : "bg-red-500"
                )}
              />
              <span className={cn(
                "text-xs font-medium tabular-nums transition-colors",
                attentionScore >= 80 ? "text-green-500" : 
                attentionScore >= 50 ? "text-yellow-500" : 
                attentionScore >= 30 ? "text-orange-500" : "text-red-500"
              )}>
                {Math.round(attentionScore)}% attention
              </span>
            </div>
          )}
        </>
      )}

      {/* Attention warning overlay */}
      {attentionWarning && !attentionPaused && (
        <div className="absolute inset-0 bg-destructive/10 pointer-events-none z-10 animate-pulse" />
      )}

      {/* Attention pause overlay - requires user to look back */}
      {attentionPaused && (
        <div 
          className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 cursor-pointer animate-fade-in"
          onClick={handleResumeFromAttentionPause}
        >
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
            <svg viewBox="0 0 40 40" className="w-16 h-16 stroke-red-500" fill="none" strokeWidth="1.5">
              <circle cx="20" cy="20" r="18" />
              <circle cx="20" cy="20" r="10" />
            </svg>
            <div className="absolute w-4 h-4 rounded-full bg-red-500" />
          </div>
          <p className="text-foreground text-lg font-medium text-center px-8">
            Look at the screen to continue
          </p>
          <p className="text-muted-foreground text-sm">
            Tap anywhere to resume
          </p>
        </div>
      )}

      {/* End stats overlay - shows cumulative attention stats */}
      {showEndStats && endStats && isPromoContent && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-6 animate-fade-in">
          <div className="text-center space-y-2">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4",
              endStats.eligible ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              {endStats.eligible ? (
                <Award className="w-10 h-10 text-green-500" />
              ) : (
                <XCircle className="w-10 h-10 text-red-500" />
              )}
            </div>
            <h3 className={cn(
              "text-2xl font-bold",
              endStats.eligible ? "text-green-500" : "text-red-500"
            )}>
              {endStats.eligible ? "Reward Earned!" : "Reward Not Earned"}
            </h3>
            <p className="text-muted-foreground text-sm">
              {endStats.eligible 
                ? "Great focus! Your reward is being processed." 
                : "Try to maintain focus next time."}
            </p>
          </div>

          {/* Stats cards */}
          {eyeTrackingEnabled && (
            <div className="grid grid-cols-3 gap-3 px-6 w-full max-w-sm">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Eye className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{Math.round(endStats.score)}%</p>
                <p className="text-[10px] text-muted-foreground">Attention</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{Math.round(endStats.attentiveTime)}s</p>
                <p className="text-[10px] text-muted-foreground">Focused</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{Math.round(endStats.totalTime)}s</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>
          )}

          {/* Reward info */}
          {reward && endStats.eligible && (
            <div className="flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
              <span className="text-lg">
                {reward.type === 'icoin' ? '🪙' : '💎'}
              </span>
              <span className="font-bold text-primary">+{reward.amount}</span>
              <span className="text-sm text-muted-foreground">
                {reward.type === 'icoin' ? 'iCoins' : 'Vicoins'}
              </span>
            </div>
          )}

          {/* Dismiss button */}
          <button
            onClick={() => setShowEndStats(false)}
            className="mt-2 px-6 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {reward && (
        <RewardBadge
          amount={reward.amount}
          type={reward.type}
          isVisible={showRewardBadge}
        />
      )}

      {/* Initial play button overlay - shown before playing starts */}
      {!isPlaying && type !== 'image' && !showControls && !attentionPaused && (
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
