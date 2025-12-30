import { useEffect, useRef, useCallback, useState } from 'react';

interface VideoStreamingOptions {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  onReady?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
  enableHLS?: boolean;
}

interface VideoStreamingResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  isReady: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedProgress: number;
  quality: 'auto' | 'low' | 'medium' | 'high';
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setQuality: (quality: 'auto' | 'low' | 'medium' | 'high') => void;
  toggleMute: () => void;
  isMuted: boolean;
}

// Check if source is HLS
function isHLSSource(src: string): boolean {
  return src.endsWith('.m3u8') || src.includes('.m3u8?');
}

// Check if browser supports HLS natively
function supportsHLSNatively(): boolean {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

export function useVideoStreaming({
  src,
  autoPlay = false,
  muted = true,
  loop = false,
  preload = 'metadata',
  onReady,
  onError,
  onProgress,
  onEnded,
  enableHLS = true,
}: VideoStreamingOptions): VideoStreamingResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [quality, setQualityState] = useState<'auto' | 'low' | 'medium' | 'high'>('auto');
  const [isMuted, setIsMuted] = useState(muted);

  // Initialize HLS.js for HLS streams
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHLS = isHLSSource(src);
    
    if (isHLS && enableHLS && !supportsHLSNatively()) {
      // Dynamic import HLS.js only when needed
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          console.warn('[useVideoStreaming] HLS.js not supported');
          video.src = src;
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000, // 60MB
          maxBufferHole: 0.5,
          startLevel: -1, // Auto quality
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsReady(true);
          onReady?.();
          if (autoPlay) {
            video.play().catch(console.error);
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                onError?.(new Error(`HLS fatal error: ${data.details}`));
                break;
            }
          }
        });

        hlsRef.current = hls;
      }).catch((err) => {
        console.warn('[useVideoStreaming] Failed to load HLS.js:', err);
        video.src = src;
      });
    } else {
      // Native playback or native HLS support
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, enableHLS, autoPlay, onReady, onError]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (!hlsRef.current) {
        setIsReady(true);
        onReady?.();
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (duration > 0) {
        onProgress?.(video.currentTime / duration * 100);
      }
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBufferedProgress((bufferedEnd / video.duration) * 100);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handleError = () => {
      onError?.(new Error(`Video error: ${video.error?.message || 'Unknown error'}`));
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [duration, onProgress, onEnded, onError, onReady]);

  // Sync muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sync loop state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = loop;
    }
  }, [loop]);

  const play = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
    } catch (err) {
      console.error('[useVideoStreaming] Play failed:', err);
    }
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  }, [duration]);

  const setQuality = useCallback((newQuality: 'auto' | 'low' | 'medium' | 'high') => {
    setQualityState(newQuality);
    
    if (hlsRef.current) {
      const hls = hlsRef.current;
      const levels = hls.levels || [];
      
      if (newQuality === 'auto') {
        hls.currentLevel = -1;
      } else {
        const qualityMap: Record<string, number> = {
          low: 0,
          medium: Math.floor(levels.length / 2),
          high: levels.length - 1,
        };
        hls.currentLevel = qualityMap[newQuality];
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return {
    videoRef,
    isReady,
    isBuffering,
    isPlaying,
    currentTime,
    duration,
    bufferedProgress,
    quality,
    play,
    pause,
    seek,
    setQuality,
    toggleMute,
    isMuted,
  };
}

// Utility to preload video chunks
export function preloadVideoChunks(urls: string[], priority: 'high' | 'low' = 'low'): void {
  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = url;
    if (priority === 'high') {
      link.setAttribute('fetchpriority', 'high');
    }
    document.head.appendChild(link);
  });
}
