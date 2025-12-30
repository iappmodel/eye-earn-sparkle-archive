import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX, SkipForward, Eye, Clock, Award, XCircle } from 'lucide-react';
import { RewardBadge } from './RewardBadge';
import { EyeTrackingIndicator } from './EyeTrackingIndicator';
import { AttentionProgressBar } from './AttentionProgressBar';
import { FocusChallengeMiniGame } from './FocusChallengeMiniGame';
import { PerfectAttentionCelebration } from './PerfectAttentionCelebration';
import { AttentionHeatmap, useAttentionHeatmap } from './AttentionHeatmap';

import { useAttentionAchievements } from './AttentionAchievements';
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
  const [showFocusChallenge, setShowFocusChallenge] = useState(false);
  const [attentionLostCount, setAttentionLostCount] = useState(0);
  const [showPerfectCelebration, setShowPerfectCelebration] = useState(false);
  
  
  const hasCompleted = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(0);
  const lastWarningTimeRef = useRef<number>(0);
  const lastChallengeTriggerRef = useRef<number>(0);
  const attentionLostTimeRef = useRef(0);
  const lastAttentionCheckRef = useRef(Date.now());

  const { attentionThreshold, eyeTrackingEnabled, soundEffects } = useMediaSettings();
  const haptic = useHapticFeedback();
  const { segments: heatmapSegments, recordAttention, reset: resetHeatmap, finalizeCurrentSegment } = useAttentionHeatmap();
  const { recordVideoCompletion } = useAttentionAchievements();

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
        setAttentionLostCount(prev => prev + 1);
        
        // Throttle warning feedback to once per 3 seconds
        const now = Date.now();
        if (now - lastWarningTimeRef.current > 3000) {
          lastWarningTimeRef.current = now;
          if (soundEffects) {
            notificationSoundService.playAttentionWarning();
          }
          haptic.error();
        }
        
        // Trigger focus challenge after multiple attention losses (every 3rd time, max once per 10 seconds)
        if (attentionLostCount > 0 && attentionLostCount % 3 === 2 && now - lastChallengeTriggerRef.current > 10000) {
          lastChallengeTriggerRef.current = now;
          setShowFocusChallenge(true);
          // Pause video during challenge
          setIsPlaying(false);
          if (videoRef.current) {
            videoRef.current.pause();
          }
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

  // Track attention lost time and trigger auto-pause if > threshold %
  useEffect(() => {
    if (!isTracking || videoDuration <= 0) return;

    const now = Date.now();
    const elapsed = now - lastAttentionCheckRef.current;
    lastAttentionCheckRef.current = now;

    const isAttentive = isFaceDetected && attentionScore >= 50;

    if (!isAttentive) {
      attentionLostTimeRef.current += elapsed;
    }

    const totalWatchedTime = currentTime * 1000;
    // Only check after at least 5 seconds of watch time to prevent early triggering
    if (totalWatchedTime > 5000) {
      const lostPercentage = (attentionLostTimeRef.current / totalWatchedTime) * 100;
      
      // Use a much higher threshold (50%) and require significant lost time
      if (lostPercentage > 50 && attentionLostTimeRef.current > 8000 && !isAttentive) {
        handleAttentionLostTooLong();
      }
    }
  }, [isTracking, isFaceDetected, attentionScore, videoDuration, currentTime, attentionThreshold, handleAttentionLostTooLong]);

  // Reset attention lost time when tracking starts fresh
  useEffect(() => {
    if (isTracking) {
      attentionLostTimeRef.current = 0;
      lastAttentionCheckRef.current = Date.now();
    }
  }, [isTracking]);

  // Record attention for heatmap
  useEffect(() => {
    if (isPromoContent && isPlaying && isTracking && eyeTrackingEnabled) {
      recordAttention(progress, attentionScore);
    }
  }, [isPromoContent, isPlaying, isTracking, eyeTrackingEnabled, progress, attentionScore, recordAttention]);

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

  // Handle focus challenge completion
  const handleFocusChallengeComplete = useCallback(() => {
    setShowFocusChallenge(false);
    setAttentionWarning(false);
    setAttentionLostCount(0);
    // Resume video
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
    haptic.success();
  }, [haptic]);

  const handleFocusChallengeDismiss = useCallback(() => {
    setShowFocusChallenge(false);
    // Resume video without resetting counts
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  }, []);

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
    setShowFocusChallenge(false);
    setAttentionLostCount(0);
    setShowPerfectCelebration(false);
    hasCompleted.current = false;
    startTimeRef.current = 0;
    lastWarningTimeRef.current = 0;
    lastChallengeTriggerRef.current = 0;
    attentionLostTimeRef.current = 0;
    lastAttentionCheckRef.current = Date.now();
    resetAttention();
    resetHeatmap();
  }, [src, resetAttention, resetHeatmap]);

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

    // Finalize heatmap data
    finalizeCurrentSegment();

    // Calculate stats for display
    const attentiveTime = (attentionResult.framesDetected / Math.max(attentionResult.totalFrames, 1)) * watchDuration;
    const isEligible = attentionResult.score >= 70 && eyeTrackingEnabled;
    const isPerfectAttention = attentionResult.score >= 95 && eyeTrackingEnabled;
    
    // Record for achievements
    if (eyeTrackingEnabled) {
      recordVideoCompletion(attentionResult.score, watchDuration);
    }
    
    // Trigger perfect attention celebration
    if (isPerfectAttention) {
      setShowPerfectCelebration(true);
    }

    setEndStats({
      score: attentionResult.score,
      totalTime: watchDuration,
      attentiveTime: attentiveTime,
      eligible: isEligible || !eyeTrackingEnabled, // Always eligible if eye tracking disabled
    });
    
    // Delay showing end stats if celebrating perfect attention
    if (isPerfectAttention) {
      setTimeout(() => setShowEndStats(true), 2500);
    } else {
      setShowEndStats(true);
    }

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
  }, [contentId, src, duration, getAttentionResult, onComplete, eyeTrackingEnabled, recordVideoCompletion]);

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

      {/* Eye tracking indicator - top center edge, minimal design */}
      {isPromoContent && (isPlaying || attentionPaused) && eyeTrackingEnabled && (
        <EyeTrackingIndicator
          isTracking={isTracking}
          isFaceDetected={isFaceDetected}
          attentionScore={attentionScore}
          position="top-center"
        />
      )}

      {/* Focus Challenge Mini-Game overlay */}
      {showFocusChallenge && (
        <FocusChallengeMiniGame
          isVisible={showFocusChallenge}
          onComplete={handleFocusChallengeComplete}
          onDismiss={handleFocusChallengeDismiss}
        />
      )}

      {/* Attention warning overlay */}
      {attentionWarning && !attentionPaused && (
        <div className="absolute inset-0 bg-destructive/10 pointer-events-none z-10 animate-pulse" />
      )}

      {/* Attention pause state - subtle indicator without blocking overlay */}
      {attentionPaused && (
        <div 
          className="absolute inset-x-0 top-16 z-30 flex justify-center animate-fade-in"
          onClick={handleResumeFromAttentionPause}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 backdrop-blur-sm border border-red-500/40 cursor-pointer hover:bg-red-500/30 transition-colors">
            <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-5 h-5 stroke-red-500" fill="none" strokeWidth="2">
                <circle cx="20" cy="20" r="14" />
                <circle cx="20" cy="20" r="7" />
              </svg>
              <div className="absolute w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <span className="text-sm text-red-400 font-medium">Tap to resume</span>
          </div>
        </div>
      )}

      {/* Perfect attention celebration */}
      {showPerfectCelebration && (
        <PerfectAttentionCelebration
          isActive={showPerfectCelebration}
          onComplete={() => setShowPerfectCelebration(false)}
        />
      )}

      {/* End stats overlay - shows cumulative attention stats */}
      {showEndStats && endStats && isPromoContent && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md z-40 flex flex-col items-center justify-center gap-4 animate-fade-in overflow-y-auto py-6">
          <div className="text-center space-y-2">
            <div className={cn(
              "w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2",
              endStats.eligible ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              {endStats.eligible ? (
                <Award className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
            <h3 className={cn(
              "text-xl font-bold",
              endStats.eligible ? "text-green-500" : "text-red-500"
            )}>
              {endStats.score >= 95 ? "Perfect Attention!" : endStats.eligible ? "Reward Earned!" : "Reward Not Earned"}
            </h3>
            <p className="text-muted-foreground text-xs px-8">
              {endStats.score >= 95 
                ? "Amazing focus! You're a pro!" 
                : endStats.eligible 
                  ? "Great focus! Your reward is being processed." 
                  : "Try to maintain focus next time."}
            </p>
          </div>

          {/* Attention Heatmap */}
          {eyeTrackingEnabled && heatmapSegments.length > 0 && (
            <div className="w-full max-w-sm px-4">
              <p className="text-xs text-center text-muted-foreground mb-2">Attention Timeline</p>
              <AttentionHeatmap
                segments={heatmapSegments}
                currentProgress={100}
                isVisible={true}
              />
            </div>
          )}

          {/* Stats cards */}
          {eyeTrackingEnabled && (
            <div className="grid grid-cols-3 gap-2 px-4 w-full max-w-sm">
              <div className="bg-muted/50 rounded-xl p-2 text-center">
                <Eye className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-base font-bold">{Math.round(endStats.score)}%</p>
                <p className="text-[9px] text-muted-foreground">Attention</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-2 text-center">
                <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-base font-bold">{Math.round(endStats.attentiveTime)}s</p>
                <p className="text-[9px] text-muted-foreground">Focused</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-2 text-center">
                <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-base font-bold">{Math.round(endStats.totalTime)}s</p>
                <p className="text-[9px] text-muted-foreground">Total</p>
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
            className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
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

      {/* Attention quality progress bar for promos with eye tracking */}
      {type === 'promo' && eyeTrackingEnabled && isPlaying && (
        <AttentionProgressBar
          progress={progress}
          currentAttentionScore={attentionScore}
          isTracking={isTracking}
          className="px-4"
        />
      )}

      {/* Progress bar for promos - thin line at very bottom (fallback when no eye tracking) */}
      {type === 'promo' && (!eyeTrackingEnabled || !isPlaying) && (
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
