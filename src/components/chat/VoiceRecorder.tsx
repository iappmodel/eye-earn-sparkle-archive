import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, X, Send, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { VOICE_MAX_DURATION_SEC } from '@/hooks/useVoiceRecorder';

interface VoiceRecorderProps {
  isRecording: boolean;
  isPaused?: boolean;
  duration: number;
  /** 0–1 normalized audio level for live waveform */
  audioLevel?: number;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onSend: () => void;
  onPause?: () => void;
  onResume?: () => void;
  disabled?: boolean;
  maxDuration?: number;
}

const WAVEFORM_BARS = 24;

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  isPaused = false,
  duration,
  audioLevel = 0,
  onStart,
  onStop,
  onCancel,
  onSend,
  onPause,
  onResume,
  disabled,
  maxDuration = VOICE_MAX_DURATION_SEC,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [slideOffset, setSlideOffset] = useState(0);
  const [showSlideCancel, setShowSlideCancel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = (duration / maxDuration) * 100;
  const isNearMax = progressPercent >= 90;

  // Live waveform bar heights driven by audio level
  const getBarHeight = (index: number) => {
    if (!isRecording || isPaused) return 20;
    const center = WAVEFORM_BARS / 2;
    const dist = Math.abs(index - center);
    const decay = 1 - dist / center;
    const base = 15 + audioLevel * 60;
    return Math.max(8, base * decay);
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isRecording || isLocked) return;
      touchStartX.current = e.touches[0].clientX;
      setShowSlideCancel(true);
      setSlideOffset(0);
    },
    [isRecording, isLocked]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isRecording || isLocked) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      setSlideOffset(dx);
    },
    [isRecording, isLocked]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isRecording || isLocked) return;
    setShowSlideCancel(false);
    if (slideOffset < -80) {
      onCancel();
    }
    setSlideOffset(0);
  }, [isRecording, isLocked, slideOffset, onCancel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isRecording || isLocked) return;
      touchStartX.current = e.clientX;
      setShowSlideCancel(true);
      setSlideOffset(0);
    },
    [isRecording, isLocked]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isRecording || isLocked) return;
      const dx = e.clientX - touchStartX.current;
      setSlideOffset(dx);
    },
    [isRecording, isLocked]
  );

  const handleMouseUp = useCallback(() => {
    if (!isRecording || isLocked) return;
    setShowSlideCancel(false);
    if (slideOffset < -80) {
      onCancel();
    }
    setSlideOffset(0);
  }, [isRecording, isLocked, slideOffset, onCancel]);

  const handleMouseLeave = useCallback(() => {
    setShowSlideCancel(false);
    setSlideOffset(0);
  }, []);

  const canCancelBySlide = isRecording && !isLocked && onCancel;
  const cancelThreshold = -80;

  if (isRecording) {
    return (
      <TooltipProvider delayDuration={300}>
        <div
          ref={containerRef}
          className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0"
          onTouchStart={canCancelBySlide ? handleTouchStart : undefined}
          onTouchMove={canCancelBySlide ? handleTouchMove : undefined}
          onTouchEnd={canCancelBySlide ? handleTouchEnd : undefined}
          onMouseDown={canCancelBySlide ? handleMouseDown : undefined}
          onMouseMove={canCancelBySlide ? handleMouseMove : undefined}
          onMouseUp={canCancelBySlide ? handleMouseUp : undefined}
          onMouseLeave={canCancelBySlide ? handleMouseLeave : undefined}
        >
          {/* Cancel / Lock toggle */}
          <div className="flex items-center gap-1 shrink-0">
            {isLocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsLocked(false)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Unlock recording"
                  >
                    <Lock className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unlock</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCancel}
                      className="text-destructive hover:text-destructive shrink-0"
                      aria-label="Cancel recording"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsLocked(true)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Lock recording"
                    >
                      <LockOpen className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Lock</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Waveform + duration */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            {showSlideCancel && !isLocked ? (
              <div
                className="flex-1 flex items-center justify-between gap-2 text-sm text-muted-foreground"
                style={{ transform: `translateX(${Math.min(0, slideOffset)}px)` }}
              >
                <span
                  className={cn(
                    'shrink-0 transition-colors',
                    slideOffset < cancelThreshold && 'text-destructive'
                  )}
                >
                  {slideOffset < cancelThreshold ? 'Release to cancel' : 'Slide to cancel'}
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      isPaused ? 'bg-amber-500' : 'bg-destructive animate-pulse'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium tabular-nums shrink-0',
                      isNearMax ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {formatDuration(duration)}
                  </span>
                </div>

                {/* Live waveform */}
                <div className="flex-1 flex items-center justify-center gap-0.5 h-8 min-w-[80px]">
                  {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 min-w-[2px] bg-primary/70 rounded-full transition-all duration-75"
                      style={{
                        height: `${getBarHeight(i)}%`,
                        opacity: isPaused ? 0.6 : 1,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pause/Resume (when supported) */}
          {onPause && onResume && !isLocked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isPaused ? onResume : onPause}
                  className="shrink-0"
                  aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
                >
                  <span className="text-xs font-medium">
                    {isPaused ? 'Resume' : 'Pause'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPaused ? 'Resume' : 'Pause'}</TooltipContent>
            </Tooltip>
          )}

          {/* Stop & Send - both stop recording and send */}
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSend}
                  className="shrink-0"
                  aria-label="Stop and send"
                >
                  <Square className="w-5 h-5 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop & send</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" onClick={onSend} className="shrink-0" aria-label="Send voice message">
                  <Send className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onStart}
            disabled={disabled}
            className="shrink-0"
            aria-label="Record voice message"
          >
            <Mic className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Voice message</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
