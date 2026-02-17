import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Loader2, AlertCircle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

interface VoiceMessageProps {
  src: string;
  duration?: number;
  className?: string;
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({ src, duration: propDuration, className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration ?? 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const totalDuration = duration > 0 ? duration : currentTime;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (propDuration == null && audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      } else if (propDuration != null) {
        setDuration(propDuration);
      }
      setLoading(false);
    };

    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      const d = audio.duration;
      setCurrentTime(t);
      if (d && isFinite(d)) {
        setProgress((t / d) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError('Could not load audio');
      setLoading(false);
    };

    const handleCanPlay = () => setLoading(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [src, propDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setError('Playback failed'));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const v = value[0] ?? 0;
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const newTime = (v / 100) * audio.duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(v);
  }, []);

  const cyclePlaybackSpeed = useCallback(() => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackRate as (typeof PLAYBACK_SPEEDS)[number]);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackRate(next);
  }, [playbackRate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={cn('flex items-center gap-3 min-w-[180px]', className)}>
        <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-destructive">Voice message unavailable</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center gap-3 min-w-[180px] max-w-[280px]', className)}>
        <audio ref={audioRef} src={src} preload="metadata" />

        <button
          type="button"
          onClick={togglePlay}
          disabled={loading}
          className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors disabled:opacity-50"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-primary" />
          ) : (
            <Play className="w-5 h-5 text-primary ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {/* Seekable progress bar */}
          <div className="flex items-center gap-2">
            <Slider
              value={[progress]}
              onValueChange={handleSeek}
              max={100}
              step={0.5}
              className="flex-1 py-2"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={cyclePlaybackSpeed}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground shrink-0 px-1.5 py-0.5 rounded"
                  aria-label={`Playback speed: ${playbackRate}x`}
                >
                  {playbackRate}x
                </button>
              </TooltipTrigger>
              <TooltipContent>Playback speed (tap to change)</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
