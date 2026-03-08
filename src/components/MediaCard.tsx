import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX, Eye, Clock, Award, XCircle } from 'lucide-react';
import { RewardBadge } from './RewardBadge';
import { EyeTrackingIndicator } from './EyeTrackingIndicator';
import { AttentionProgressBar } from './AttentionProgressBar';
import { FocusChallengeMiniGame } from './FocusChallengeMiniGame';
import { PerfectAttentionCelebration } from './PerfectAttentionCelebration';
import { AttentionHeatmap, useAttentionHeatmap } from './AttentionHeatmap';

import { useAttentionAchievements } from './AttentionAchievements';
import { useEyeTracking } from '@/hooks/useEyeTracking';
import { useVideoMute } from '@/contexts/VideoMuteContext';
import { useMediaSettings } from './MediaSettings';
import { isIOS, dispatchCameraUserStart } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { notificationSoundService } from '@/services/notificationSound.service';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MediaCardProps {
  type: 'video' | 'image' | 'promo';
  src: string;
  videoSrc?: string;
  duration?: number;
  reward?: { amount: number; type: 'vicoin' | 'icoin' };
  onComplete?: (attentionValidated: boolean, attentionScore?: number, watchDuration?: number, attentionSessionId?: string) => void;
  onProgress?: (progress: number) => void;
  onSkip?: () => void;
  /** Called when user exits promo before completion (swipe away, etc.) */
  onEarlyExit?: () => void;
  isActive?: boolean;
  contentId?: string;
  /** Optional demo flag to prefer landscape framing for video playback. */
  preferLandscapePlayback?: boolean;
  /** Current viewport orientation; used for orientation-aware video framing. */
  isLandscapeViewport?: boolean;
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
  onEarlyExit,
  isActive = true,
  contentId,
  preferLandscapePlayback = false,
  isLandscapeViewport = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const { isMuted, toggleMute: contextToggleMute } = useVideoMute();
  const [showRewardBadge, setShowRewardBadge] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [attentionWarning, setAttentionWarning] = useState(false);
  const [attentionPaused, setAttentionPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration);
  const [showEndStats, setShowEndStats] = useState(false);
  const [endStats, setEndStats] = useState<{
    score: number;
    totalTime: number;
    attentiveTime: number;
    eligible: boolean;
    bestStreakSec?: number;
    sessionStats?: { minScore: number; maxScore: number; avgScore: number; sampleCount: number };
  } | null>(null);
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

  const { attentionThreshold, eyeTrackingEnabled, soundEffects, attentionPreset, requiredAttentionOverride } = useMediaSettings();
  const haptic = useHapticFeedback();
  const { user } = useAuth();
  const { segments: heatmapSegments, recordAttention, reset: resetHeatmap, finalizeCurrentSegment } = useAttentionHeatmap();
  const { recordVideoCompletion } = useAttentionAchievements();

  /** Minimum ms of lost attention before auto-pause can trigger (avoids pausing on brief glitches). */
  const MIN_ATTENTION_LOST_MS = 4000;
  /** Score (0–100) above which user counts as "attentive" for lost-time accumulation. */
  const ATTENTIVE_SCORE_CUTOFF = 50;

  // Eye tracking for promo content (uses preset's requiredAttentionThreshold so Strict/Normal/Relaxed apply)
  const isPromoContent = type === 'promo' && !!reward;
  const {
    isTracking,
    isFaceDetected,
    attentionScore,
    attentionStreakSec,
    totalAttentiveMs,
    sessionStats,
    lastFlags,
    visionStatus,
    needsUserGesture,
    resetAttention,
    retryTracking,
    startPromoAttention,
    stopPromoAttention,
    getAttentionResult,
  } = useEyeTracking({
    enabled: isPromoContent && isActive && isPlaying && eyeTrackingEnabled,
    preset: attentionPreset,
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
    // Use custom override from Media Settings if set, otherwise preset (strict 90, normal 85, relaxed 75)
    ...(requiredAttentionOverride > 0 ? { requiredAttentionThreshold: requiredAttentionOverride } : {}),
  });

  const [attentionLostPercent, setAttentionLostPercent] = useState<number | null>(null);

  // Handle auto-pause when attention lost exceeds user's threshold (from Media Settings)
  const handleAttentionLostTooLong = useCallback(() => {
    if (isPromoContent && isPlaying && !attentionPaused) {
      setAttentionPaused(true);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isPromoContent, isPlaying, attentionPaused]);

  // Track attention lost time and trigger auto-pause when lost % > settings threshold
  useEffect(() => {
    if (!isTracking || videoDuration <= 0) return;

    const now = Date.now();
    const elapsed = now - lastAttentionCheckRef.current;
    lastAttentionCheckRef.current = now;

    const isAttentive = isFaceDetected && attentionScore >= ATTENTIVE_SCORE_CUTOFF;

    if (!isAttentive) {
      attentionLostTimeRef.current += elapsed;
    }

    const totalWatchedTime = (videoRef.current?.currentTime ?? currentTime) * 1000;
    const lostPercentage = totalWatchedTime > 0 ? (attentionLostTimeRef.current / totalWatchedTime) * 100 : 0;

    // Expose for UI (approaching-threshold warning)
    setAttentionLostPercent(totalWatchedTime >= 3000 ? lostPercentage : null);

    // Only consider auto-pause after minimum watch time and minimum lost duration
    if (totalWatchedTime > 5000 && attentionLostTimeRef.current > MIN_ATTENTION_LOST_MS) {
      if (lostPercentage > attentionThreshold && !isAttentive) {
        handleAttentionLostTooLong();
      }
    }
  }, [isTracking, isFaceDetected, attentionScore, videoDuration, currentTime, attentionThreshold, handleAttentionLostTooLong]);

  // Reset attention lost time and display when tracking starts fresh
  useEffect(() => {
    if (isTracking) {
      attentionLostTimeRef.current = 0;
      lastAttentionCheckRef.current = Date.now();
    } else {
      setAttentionLostPercent(null);
    }
  }, [isTracking]);

  // Record attention for heatmap
  useEffect(() => {
    if (isPromoContent && isPlaying && isTracking && eyeTrackingEnabled) {
      recordAttention(progress, attentionScore);
    }
  }, [isPromoContent, isPlaying, isTracking, eyeTrackingEnabled, progress, attentionScore, recordAttention]);

  // Resume from attention pause (reset lost-percent display)
  const handleResumeFromAttentionPause = useCallback(() => {
    if (attentionPaused) {
      setAttentionPaused(false);
      setAttentionWarning(false);
      setAttentionLostPercent(null);
      attentionLostTimeRef.current = 0;
      lastAttentionCheckRef.current = Date.now();
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
      if (isPromoContent && eyeTrackingEnabled) {
        dispatchCameraUserStart();
      }
    }
  }, [attentionPaused, isPromoContent, eyeTrackingEnabled]);

  // Handle focus challenge completion
  const handleFocusChallengeComplete = useCallback(() => {
    setShowFocusChallenge(false);
    setAttentionWarning(false);
    setAttentionLostCount(0);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
    if (isPromoContent && eyeTrackingEnabled) {
      dispatchCameraUserStart();
    }
    haptic.success();
  }, [haptic, isPromoContent, eyeTrackingEnabled]);

  const handleFocusChallengeDismiss = useCallback(() => {
    setShowFocusChallenge(false);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
    if (isPromoContent && eyeTrackingEnabled) {
      dispatchCameraUserStart();
    }
  }, [isPromoContent, eyeTrackingEnabled]);

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

  // Early exit: user left promo before completion (unmount / navigate away)
  const onEarlyExitRef = useRef(onEarlyExit);
  onEarlyExitRef.current = onEarlyExit;
  useEffect(() => {
    if (type !== 'promo' || !reward) return;
    return () => {
      if (!hasCompleted.current && onEarlyExitRef.current) {
        onEarlyExitRef.current();
      }
    };
  }, [type, reward]);

  // Validate attention and complete
  const handlePromoComplete = useCallback(async () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;

    stopPromoAttention();
    const rawWatchDuration = (Date.now() - startTimeRef.current) / 1000;
    // Clamp watchDuration to at most 1.4x totalDuration to stay within backend validation bounds
    const watchDuration = duration > 0 ? Math.min(rawWatchDuration, duration * 1.4) : rawWatchDuration;
    const attentionResult = getAttentionResult();

    logger.log('[MediaCard] Promo complete, validating attention...', attentionResult);

    // Finalize heatmap data
    finalizeCurrentSegment();

    // Use time-weighted attentiveMs for display; eligibility requires passed (score + cashEligible)
    const attentiveTime = attentionResult.totalMs > 0 ? attentionResult.attentiveMs / 1000 : 0;
    const isEligible = attentionResult.passed && eyeTrackingEnabled;
    const isPerfectAttention = attentionResult.score >= 95 && eyeTrackingEnabled && attentionResult.cashEligible;
    
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
      bestStreakSec: Math.round(attentionStreakSec),
      sessionStats: sessionStats,
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
      // Only validate with backend if user is authenticated
      if (!user) {
        logger.log('[MediaCard] User not authenticated, skipping backend validation');
        onComplete?.(isEligible, attentionResult.score, watchDuration);
        return;
      }

      // Resolve the content ID, skip backend validation if it's not a valid UUID
      const resolvedContentId = contentId || src;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(resolvedContentId)) {
        logger.log('[MediaCard] contentId is not a UUID, skipping backend validation:', resolvedContentId);
        onComplete?.(isEligible, attentionResult.score, watchDuration);
        return;
      }

      // Validate with backend: server recomputes score from samples only (client score not authoritative).
      const { data, error } = await supabase.functions.invoke('validate-attention', {
        body: {
          contentId: resolvedContentId,
          attentionScore: attentionResult.score,
          attentiveMs: attentionResult.attentiveMs,
          totalMs: attentionResult.totalMs,
          source: attentionResult.source,
          sourceConfidence: attentionResult.sourceConfidence,
          watchDuration,
          totalDuration: duration,
          framesDetected: attentionResult.framesDetected,
          totalFrames: attentionResult.totalFrames,
          samples: attentionResult.samples,
        },
      });

      if (error) {
        logger.error('[MediaCard] Validation error:', error);
        onComplete?.(false, attentionResult.score);
        return;
      }

      logger.log('[MediaCard] Validation result:', data);

      if (data?.validated) {
        onComplete?.(true, attentionResult.score, watchDuration, data.attentionSessionId ?? undefined);
      } else {
        onComplete?.(false, attentionResult.score);
      }
    } catch (err) {
      logger.error('[MediaCard] Validation failed:', err);
      onComplete?.(false, attentionResult.score);
    }
  }, [contentId, src, duration, getAttentionResult, onComplete, eyeTrackingEnabled, recordVideoCompletion, user, stopPromoAttention, attentionStreakSec, finalizeCurrentSegment, haptic, sessionStats, soundEffects]);

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

  // Video element progress tracking — throttle state updates to ~4/s so we don't rerender every frame.
  const lastTimeUpdateTs = useRef(0);
  const VIDEO_PROGRESS_THROTTLE_MS = 250;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdateTs.current < VIDEO_PROGRESS_THROTTLE_MS) return;
      lastTimeUpdateTs.current = now;
      const t = video.currentTime;
      const d = video.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const newProgress = (t / d) * 100;
      setProgress(newProgress);
      setCurrentTime(t);
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

  // Auto-start promo/video content. On iOS with eye tracking, require tap first (no gesture for getUserMedia otherwise).
  const shouldRequireTapOnIOS = type === 'promo' && isActive && eyeTrackingEnabled && isIOS();
  const useLandscapeFraming = Boolean(videoSrc) && (preferLandscapePlayback || isLandscapeViewport);
  const showRotateHint = Boolean(videoSrc) && !isLandscapeViewport && !preferLandscapePlayback;
  useEffect(() => {
    if ((type === 'promo' || type === 'video') && isActive && !shouldRequireTapOnIOS) {
      const timer = setTimeout(() => {
        setIsPlaying(true);
        startTimeRef.current = Date.now();
        if (videoRef.current) {
          videoRef.current.play().catch(console.error);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [type, isActive, shouldRequireTapOnIOS]);

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
    // iOS requires getUserMedia from user gesture – dispatch so camera starts in same event turn
    if (isPromoContent && eyeTrackingEnabled) {
      dispatchCameraUserStart();
    }
  }, [resetControlsTimeout, isPromoContent, eyeTrackingEnabled]);

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
      handlePlay(); // handlePlay already dispatches cameraUserStart
    }
  }, [isPlaying, handlePlay, handlePause]);

  const toggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    contextToggleMute();
    resetControlsTimeout();
  }, [contextToggleMute, resetControlsTimeout]);


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
        <div
          className={cn(
            'absolute inset-0 bg-black',
            useLandscapeFraming && 'flex items-center justify-center'
          )}
        >
          <video
            ref={videoRef}
            className={cn(
              'w-full h-full',
              useLandscapeFraming ? 'object-contain' : 'object-cover'
            )}
            src={videoSrc}
            poster={src}
            muted={isMuted}
            playsInline
            loop={type !== 'promo'}
          />
        </div>
      ) : (
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
          style={{ backgroundImage: `url(${src})` }}
        />
      )}

      {showRotateHint && (
        <div className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-black/55 border border-white/20 text-[11px] text-slate-100 tracking-wide">
          Rotate for landscape playback
        </div>
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
          attentionStreakSec={attentionStreakSec}
          visionStatus={visionStatus}
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

      {/* Approaching auto-pause threshold - warn when lost % is close to settings threshold */}
      {isPromoContent && isPlaying && !attentionPaused && attentionLostPercent != null && attentionThreshold > 0 && attentionLostPercent >= attentionThreshold * 0.5 && attentionLostPercent < attentionThreshold && (
        <div className="absolute inset-x-0 top-14 z-20 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-medium">
            Attention lost: {Math.round(attentionLostPercent)}% of video — auto-pause at {attentionThreshold}%
          </div>
        </div>
      )}

      {/* Attention pause state - uses slider threshold; show lost % and tap to resume */}
      {attentionPaused && (
        <div 
          className="absolute inset-x-0 top-16 z-30 flex justify-center animate-fade-in"
          onClick={handleResumeFromAttentionPause}
        >
          <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl bg-red-500/20 backdrop-blur-sm border border-red-500/40 cursor-pointer hover:bg-red-500/30 transition-colors max-w-[90%]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 40 40" className="w-5 h-5 stroke-red-500" fill="none" strokeWidth="2">
                  <circle cx="20" cy="20" r="14" />
                  <circle cx="20" cy="20" r="7" />
                </svg>
              </div>
              <span className="text-sm text-red-400 font-medium">Video paused</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Looking away exceeded your auto-pause limit ({attentionThreshold}%). Tap to resume.
            </p>
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
            <div className="space-y-2 px-4 w-full max-w-sm">
              <div className="grid grid-cols-3 gap-2">
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
              {(endStats.bestStreakSec != null && endStats.bestStreakSec > 0) || endStats.sessionStats?.sampleCount ? (
                <div className="grid grid-cols-2 gap-2 text-center">
                  {endStats.bestStreakSec != null && endStats.bestStreakSec > 0 && (
                    <div className="bg-muted/30 rounded-lg px-2 py-1.5">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400">{endStats.bestStreakSec}s</p>
                      <p className="text-[9px] text-muted-foreground">Best focus streak</p>
                    </div>
                  )}
                  {endStats.sessionStats && endStats.sessionStats.sampleCount > 0 && (
                    <div className="bg-muted/30 rounded-lg px-2 py-1.5">
                      <p className="text-xs font-bold">
                        {endStats.sessionStats.minScore}–{endStats.sessionStats.maxScore}%
                      </p>
                      <p className="text-[9px] text-muted-foreground">Score range (avg {endStats.sessionStats.avgScore}%)</p>
                    </div>
                  )}
                </div>
              ) : null}
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

      {/* Tap to enable camera - iOS requires user gesture for getUserMedia */}
      {isPromoContent && isPlaying && eyeTrackingEnabled && needsUserGesture && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            dispatchCameraUserStart();
            retryTracking();
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-30 bg-background/80 backdrop-blur-sm"
        >
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Eye className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground px-4 text-center">
            Tap to enable attention tracking
          </p>
          <p className="text-xs text-muted-foreground px-4 text-center max-w-[220px]">
            Your browser requires a tap to access the camera
          </p>
        </button>
      )}

      {/* Initial play button overlay - shown before playing starts */}
      {!isPlaying && type !== 'image' && !showControls && !attentionPaused && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
        >
          <div className="w-24 h-24 rounded-full neu-button flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
            <Play className="w-10 h-10 text-foreground ml-1" />
          </div>
          {shouldRequireTapOnIOS && (
            <p className="text-xs text-muted-foreground px-4 text-center max-w-[200px]">
              Tap to start (enables camera for attention tracking)
            </p>
          )}
        </button>
      )}

      {/* Accessible way to open playback controls when playing and controls hidden (keyboard/screen reader) */}
      {type !== 'image' && isPlaying && !showControls && !attentionPaused && (
        <button
          type="button"
          onClick={() => {
            setShowControls(true);
            resetControlsTimeout();
          }}
          className="absolute bottom-4 right-4 z-10 w-10 h-10 rounded-full bg-background/70 backdrop-blur-md flex items-center justify-center border border-border/50 hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Show playback controls"
        >
          <Volume2 className="w-5 h-5 text-foreground" aria-hidden />
        </button>
      )}

      {/* Tap-to-reveal playback controls - centered on screen; also reachable via "Show playback controls" button */}
      {showControls && type !== 'image' && (
        <div
          className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in"
          role="group"
          aria-label="Playback controls"
        >
          <div className="flex flex-col items-center gap-4">
            {/* Mute - top */}
            <button
              type="button"
              onClick={toggleMute}
              className="w-12 h-12 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center transition-all hover:bg-background/80 active:scale-95 shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-foreground" aria-hidden />
              ) : (
                <Volume2 className="w-5 h-5 text-foreground" aria-hidden />
              )}
            </button>

            {/* Play/Pause - bottom, larger */}
            <button
              type="button"
              onClick={togglePlayPause}
              className="w-16 h-16 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center transition-all hover:bg-background/80 active:scale-95 shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 text-foreground" aria-hidden />
              ) : (
                <Play className="w-7 h-7 text-foreground ml-1" aria-hidden />
              )}
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
