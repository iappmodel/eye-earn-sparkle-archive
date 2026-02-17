import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, RefreshCw, Zap, Music2, Timer, Sparkles, Smile, Palette, Layers,
  ChevronDown, Wand2, Heart, Star, Flower2, Ghost,
  Glasses, PartyPopper, Crown, Flame, Snowflake, Grid3X3, Square,
  ImagePlus, Maximize2, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type RecordingMode = 'photo' | 'video' | '15s' | '60s' | '3m';
type CameraTab = 'effects' | 'filters' | 'beauty' | 'more';
type GridMode = 'none' | 'thirds' | 'square';
type ResolutionPreset = '720p' | '1080p' | 'max';

interface TikTokCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture?: (blob: Blob, type: 'photo' | 'video') => void;
  contentType?: 'post' | 'story' | 'promotion' | 'campaign';
}

interface Effect {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
}

interface FilterPreset {
  id: string;
  name: string;
  preview: string;
  /** CSS filter applied to preview and capture */
  cssFilter: string;
}

const recordingModes: { id: RecordingMode; label: string }[] = [
  { id: '15s', label: '15s' },
  { id: '60s', label: '60s' },
  { id: '3m', label: '3m' },
  { id: 'photo', label: 'Photo' },
];

const effects: Effect[] = [
  { id: 'none', name: 'None', icon: <X className="w-5 h-5" />, category: 'trending' },
  { id: 'beauty-max', name: 'Beauty+', icon: <Sparkles className="w-5 h-5" />, category: 'beauty' },
  { id: 'glow', name: 'Glow', icon: <Star className="w-5 h-5" />, category: 'beauty' },
  { id: 'smooth', name: 'Smooth', icon: <Smile className="w-5 h-5" />, category: 'beauty' },
  { id: 'contour', name: 'Contour', icon: <Layers className="w-5 h-5" />, category: 'beauty' },
  { id: 'anime', name: 'Anime', icon: <Star className="w-5 h-5" />, category: 'funny' },
  { id: 'ghost', name: 'Ghost', icon: <Ghost className="w-5 h-5" />, category: 'funny' },
  { id: 'crown', name: 'Crown', icon: <Crown className="w-5 h-5" />, category: 'interactive' },
  { id: 'hearts', name: 'Hearts', icon: <Heart className="w-5 h-5" />, category: 'interactive' },
  { id: 'fire', name: 'Fire', icon: <Flame className="w-5 h-5" />, category: 'trending' },
  { id: 'snow', name: 'Snow', icon: <Snowflake className="w-5 h-5" />, category: 'trending' },
  { id: 'party', name: 'Party', icon: <PartyPopper className="w-5 h-5" />, category: 'interactive' },
  { id: 'glasses', name: 'Glasses', icon: <Glasses className="w-5 h-5" />, category: 'funny' },
  { id: 'flower', name: 'Flower', icon: <Flower2 className="w-5 h-5" />, category: 'beauty' },
];

const filterPresets: FilterPreset[] = [
  { id: 'normal', name: 'Normal', preview: '#888', cssFilter: 'none' },
  { id: 'portrait', name: 'Portrait', preview: '#FFE4C4', cssFilter: 'saturate(1.1) contrast(0.95) brightness(1.05)' },
  { id: 'landscape', name: 'Landscape', preview: '#87CEEB', cssFilter: 'saturate(1.2) contrast(1.1)' },
  { id: 'food', name: 'Food', preview: '#FFA07A', cssFilter: 'saturate(1.3) contrast(1.05) sepia(0.08)' },
  { id: 'vibe', name: 'Vibe', preview: '#DDA0DD', cssFilter: 'saturate(1.4) hue-rotate(-10deg) contrast(1.05)' },
  { id: 'b&w', name: 'B&W', preview: '#555', cssFilter: 'grayscale(1) contrast(1.1)' },
  { id: 'vintage', name: 'Vintage', preview: '#D2691E', cssFilter: 'sepia(0.35) contrast(1.1) saturate(0.9)' },
  { id: 'warm', name: 'Warm', preview: '#FF7F50', cssFilter: 'sepia(0.15) saturate(1.2) brightness(1.08)' },
  { id: 'cool', name: 'Cool', preview: '#4169E1', cssFilter: 'saturate(0.9) brightness(0.97) hue-rotate(10deg)' },
  { id: 'drama', name: 'Drama', preview: '#2F4F4F', cssFilter: 'contrast(1.25) saturate(0.85) brightness(0.95)' },
  { id: 'cinema', name: 'Cinema', preview: '#1a1a1a', cssFilter: 'contrast(1.15) saturate(0.7) brightness(0.9)' },
  { id: 'vivid', name: 'Vivid', preview: '#ff1493', cssFilter: 'saturate(1.5) contrast(1.1)' },
];

const timerOptions = [0, 3, 5, 10];
const speedOptions = [0.5, 1, 2, 3] as const;
const resolutionOptions: { id: ResolutionPreset; label: string; width: number; height: number }[] = [
  { id: '720p', label: '720p', width: 720, height: 1280 },
  { id: '1080p', label: '1080p', width: 1080, height: 1920 },
  { id: 'max', label: 'Max', width: 4096, height: 4096 },
];

function getMediaRecorderOptions(): { mimeType: string; videoBitsPerSecond?: number } | undefined {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
    return { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 5_000_000 };
  }
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
    return { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 2_500_000 };
  }
  if (MediaRecorder.isTypeSupported('video/webm')) {
    return { mimeType: 'video/webm', videoBitsPerSecond: 2_500_000 };
  }
  return undefined;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Apply beauty (smooth + whiten) to canvas; call after drawImage. */
function applyBeautyToContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  smooth: number,
  whiten: number
) {
  if (smooth <= 0 && whiten <= 0) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const whitenAmount = whiten / 100;
  const smoothAmount = smooth / 100; // 0..1 for soft contrast/brightness
  for (let i = 0; i < data.length; i += 4) {
    if (whitenAmount > 0) {
      data[i] = Math.min(255, data[i] + whitenAmount * 18);
      data[i + 1] = Math.min(255, data[i + 1] + whitenAmount * 18);
      data[i + 2] = Math.min(255, data[i + 2] + whitenAmount * 18);
    }
    if (smoothAmount > 0) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mid = (r + g + b) / 3;
      const blend = 1 - smoothAmount * 0.4;
      data[i] = Math.round(r * blend + mid * (1 - blend));
      data[i + 1] = Math.round(g * blend + mid * (1 - blend));
      data[i + 2] = Math.round(b * blend + mid * (1 - blend));
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export const TikTokCamera: React.FC<TikTokCameraProps> = ({
  isOpen,
  onClose,
  onCapture,
  contentType = 'post',
}) => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('15s');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState<Effect>(effects[0]);
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>(filterPresets[0]);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<CameraTab | null>(null);
  const [beautySmooth, setBeautySmooth] = useState(40);
  const [beautyWhiten, setBeautyWhiten] = useState(20);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gridMode, setGridMode] = useState<GridMode>('none');
  const [resolution, setResolution] = useState<ResolutionPreset>('1080p');
  const [speedIndex, setSpeedIndex] = useState(1); // 1x
  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusRipple, setFocusRipple] = useState<{ x: number; y: number } | null>(null);
  const [longPressRecording, setLongPressRecording] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideoMode = recordingMode !== 'photo';
  const resPreset = resolutionOptions.find((r) => r.id === resolution) ?? resolutionOptions[1];
  const speed = speedOptions[speedIndex];

  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: Math.min(resPreset.width, 1920) },
          height: { ideal: Math.min(resPreset.height, 1920) },
        },
        audio: isVideoMode,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      // Apply zoom if supported
      const videoTrack = stream.getVideoTracks()[0];
      const caps = videoTrack.getCapabilities?.() as { zoom?: { min: number; max: number } } | undefined;
      if (caps?.zoom && zoomLevel > 1) {
        const maxZoom = Math.min(caps.zoom.max, 4);
        videoTrack.applyConstraints?.({ advanced: [{ zoom: Math.min(zoomLevel, maxZoom) }] } as MediaTrackConstraints).catch(() => {});
      }
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Could not access camera. Check permissions.');
    }
  }, [isOpen, isFrontCamera, resolution, isVideoMode, resPreset, zoomLevel]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setRecordingProgress(0);
      setRecordingElapsed(0);
      setActiveTab(null);
      setCountdown(null);
      setFocusRipple(null);
    }
    return () => stopCamera();
  }, [isOpen, isFrontCamera, startCamera, stopCamera]);

  // Flash/torch: apply when flashEnabled changes
  useEffect(() => {
    if (!streamRef.current || !flashEnabled) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    const caps = videoTrack.getCapabilities?.() as { torch?: boolean } | undefined;
    if (caps?.torch) {
      videoTrack.applyConstraints?.({ advanced: [{ torch: true }] } as MediaTrackConstraints).catch(() => {});
    }
    return () => {
      if (videoTrack && caps?.torch) {
        videoTrack.applyConstraints?.({ advanced: [{ torch: false }] } as MediaTrackConstraints).catch(() => {});
      }
    };
  }, [flashEnabled, streamRef.current]);

  const toggleCamera = () => setIsFrontCamera((p) => !p);
  const toggleFlash = () => setFlashEnabled((p) => !p);

  const getMaxDuration = (): number => {
    switch (recordingMode) {
      case '15s': return 15;
      case '60s': return 60;
      case '3m': return 180;
      default: return 60;
    }
  };

  const startRecording = useCallback(() => {
    if (!streamRef.current || recordingMode === 'photo') return;
    recordedChunksRef.current = [];
    const options = getMediaRecorderOptions();
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || 'video/webm' });
        onCapture?.(blob, 'video');
        toast.success('Video saved!');
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      const maxDuration = getMaxDuration();
      recordingIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingElapsed(elapsed);
        setRecordingProgress((elapsed / maxDuration) * 100);
        if (elapsed >= maxDuration) stopRecording();
      }, 100);
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Could not start recording');
    }
  }, [recordingMode, onCapture]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordingProgress(0);
    setRecordingElapsed(0);
    setLongPressRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const w = v.videoWidth || 1080;
    const h = v.videoHeight || 1920;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (isFrontCamera) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (selectedFilter.id !== 'normal') {
      ctx.filter = selectedFilter.cssFilter;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    }
    applyBeautyToContext(ctx, w, h, beautySmooth, beautyWhiten);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture?.(blob, 'photo');
          toast.success('Photo captured!');
        }
      },
      'image/jpeg',
      0.95
    );
  }, [isFrontCamera, selectedFilter, beautySmooth, beautyWhiten, onCapture]);

  const handleTapToFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFocusRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setFocusRipple(null), 600);
  };

  const handleCapturePress = () => {
    if (countdown !== null) return;
    if (timerSeconds > 0 && !isRecording) {
      setCountdown(timerSeconds);
      let remaining = timerSeconds;
      const id = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(id);
          setCountdown(null);
          if (recordingMode === 'photo') capturePhoto();
          else startRecording();
        }
      }, 1000);
      return;
    }
    if (recordingMode === 'photo') {
      capturePhoto();
    } else if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handlePointerDown = () => {
    if (recordingMode === 'photo') return;
    longPressTimerRef.current = window.setTimeout(() => {
      setLongPressRecording(true);
      if (!isRecording) startRecording();
    }, 300);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressRecording && isRecording) {
      stopRecording();
    }
  };

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cycleTimer = () => {
    const idx = timerOptions.indexOf(timerSeconds);
    const next = timerOptions[(idx + 1) % timerOptions.length];
    setTimerSeconds(next);
    toast.info(next === 0 ? 'Timer off' : `Timer: ${next}s`);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    onCapture?.(file as Blob, isVideo ? 'video' : 'photo');
    onClose();
    toast.success(isVideo ? 'Video selected' : 'Photo selected');
    e.target.value = '';
  };

  const cycleZoom = useCallback(() => {
    setZoomLevel((z) => {
      const next = z >= 4 ? 1 : z + 1;
      const track = streamRef.current?.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as { zoom?: { min: number; max: number } } | undefined;
      if (track && caps?.zoom) {
        const val = Math.min(next, caps.zoom.max);
        track.applyConstraints?.({ advanced: [{ zoom: val }] } as MediaTrackConstraints).catch(() => {});
      }
      return next;
    });
  }, []);

  if (!isOpen) return null;

  const videoFilterStyle =
    selectedFilter.id === 'normal'
      ? undefined
      : { filter: selectedFilter.cssFilter };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      {/* Camera view */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        onMouseDown={handleTapToFocus}
        onClick={handleTapToFocus}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn('w-full h-full object-cover', isFrontCamera && 'scale-x-[-1]')}
          style={videoFilterStyle}
        />

        {/* Grid overlay */}
        {gridMode === 'thirds' && (
          <div className="absolute inset-0 pointer-events-none flex">
            <div className="flex-1 border-r border-white/30" />
            <div className="flex-1 border-r border-white/30" />
            <div className="flex-1" />
          </div>
        )}
        {gridMode === 'thirds' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col">
            <div className="flex-1 border-b border-white/30" />
            <div className="flex-1 border-b border-white/30" />
            <div className="flex-1" />
          </div>
        )}
        {gridMode === 'square' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-full border-2 border-white/40" style={{ aspectRatio: '1' }} />
          </div>
        )}

        {/* Effect overlays */}
        {selectedEffect.id === 'hearts' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <Heart
                key={i}
                className="absolute text-rose-400 animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${Math.random() * 30 + 20}px`,
                  height: 'auto',
                  opacity: Math.random() * 0.6 + 0.3,
                  animationDelay: `${Math.random() * 2}s`,
                }}
                fill="currentColor"
              />
            ))}
          </div>
        )}
        {selectedEffect.id === 'snow' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <Snowflake
                key={i}
                className="absolute text-white/60 animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${Math.random() * 15 + 8}px`,
                  height: 'auto',
                  animationDelay: `${Math.random() * 3}s`,
                }}
              />
            ))}
          </div>
        )}
        {selectedEffect.id === 'crown' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none">
            <Crown className="w-20 h-20 text-yellow-400 drop-shadow-lg" fill="currentColor" />
          </div>
        )}

        {/* Tap-to-focus ripple */}
        {focusRipple && (
          <div
            className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 pointer-events-none animate-ping"
            style={{ left: focusRipple.x, top: focusRipple.y }}
          />
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <span className="text-white text-9xl font-bold animate-pulse tabular-nums">{countdown}</span>
          </div>
        )}

        {/* Recording UI */}
        {isRecording && (
          <>
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-20">
              <div
                className="h-full bg-red-500 transition-all duration-100"
                style={{ width: `${recordingProgress}%` }}
              />
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 px-3 py-1.5 rounded-full bg-black/60">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono tabular-nums">{formatDuration(recordingElapsed)}</span>
              <span className="text-white/70 text-xs">/ {formatDuration(getMaxDuration())}</span>
            </div>
          </>
        )}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
          aria-label="Close camera"
        >
          <X className="w-5 h-5 text-black" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'effects' ? null : 'effects')}
            className={cn(
              'px-4 py-2 rounded-full flex items-center gap-2 shadow-lg',
              activeTab === 'effects' ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-black'
            )}
          >
            <Wand2 className="w-4 h-4" />
            <span className="text-sm font-medium">Effects</span>
          </button>
        </div>
      </div>

      {/* Right controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
        <button
          type="button"
          onClick={toggleCamera}
          className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
          aria-label="Flip camera"
        >
          <RefreshCw className="w-5 h-5 text-black" />
        </button>
        <button
          type="button"
          onClick={cycleTimer}
          className="w-12 h-12 rounded-full bg-white/90 flex flex-col items-center justify-center shadow-lg"
        >
          <Timer className="w-4 h-4 text-black" />
          {timerSeconds > 0 && (
            <span className="text-[10px] text-black font-bold tabular-nums">{timerSeconds}s</span>
          )}
        </button>
        <button
          type="button"
          onClick={toggleFlash}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
            flashEnabled ? 'bg-yellow-400' : 'bg-white/90'
          )}
          aria-label={flashEnabled ? 'Flash on' : 'Flash off'}
        >
          <Zap className={cn('w-5 h-5', flashEnabled ? 'text-white' : 'text-black')} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'filters' ? null : 'filters')}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
            activeTab === 'filters' ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-black'
          )}
        >
          <Palette className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'beauty' ? null : 'beauty')}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
            activeTab === 'beauty' ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-black'
          )}
        >
          <Sparkles className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'more' ? null : 'more')}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
            activeTab === 'more' ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-black'
          )}
        >
          <Settings className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => toast.info('Add sounds in editor')}
          className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
        >
          <Music2 className="w-5 h-5 text-black" />
        </button>
      </div>

      {/* Left: Gallery + Grid */}
      <div className="absolute left-4 bottom-32 flex flex-col gap-3 z-10">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleGallerySelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center shadow-lg"
          aria-label="Upload from gallery"
        >
          <ImagePlus className="w-5 h-5 text-black" />
        </button>
        <button
          type="button"
          onClick={() => setGridMode((g) => (g === 'none' ? 'thirds' : g === 'thirds' ? 'square' : 'none'))}
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shadow-lg',
            gridMode === 'none' ? 'bg-white/90 text-black' : 'bg-primary text-primary-foreground'
          )}
          aria-label={`Grid: ${gridMode === 'none' ? 'off' : gridMode === 'thirds' ? 'rule of thirds' : 'square'}`}
        >
          {gridMode === 'square' ? <Square className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
        </button>
      </div>

      {/* Bottom: mode + capture */}
      <div className="absolute bottom-0 left-0 right-0 z-10" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex justify-center gap-6 mb-4">
          {recordingModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setRecordingMode(mode.id)}
              className="relative px-1 py-1"
            >
              <span
                className={cn(
                  'text-sm font-semibold transition-all',
                  recordingMode === mode.id ? 'text-white' : 'text-white/60'
                )}
              >
                {mode.label}
              </span>
              {recordingMode === mode.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={(e) => {
              if (longPressRecording) e.preventDefault();
              else handleCapturePress();
            }}
            disabled={countdown !== null}
            className={cn(
              'w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all duration-200',
              countdown !== null && 'opacity-50'
            )}
          >
            {recordingMode === 'photo' ? (
              <div className="w-16 h-16 rounded-full bg-white" />
            ) : isRecording ? (
              <div className="w-8 h-8 rounded-sm bg-red-500" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </div>

      {/* Panels */}
      {activeTab === 'effects' && (
        <div className="absolute bottom-32 left-0 right-0 z-20 animate-in slide-in-from-bottom-4 duration-200">
          <div className="mx-4 p-4 rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-black font-semibold">Effects</span>
              <button type="button" onClick={() => setActiveTab(null)}>
                <ChevronDown className="w-5 h-5 text-black" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {effects.map((effect) => (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => setSelectedEffect(effect)}
                  className={cn(
                    'flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-all',
                    selectedEffect.id === effect.id ? 'bg-black text-white' : 'bg-gray-100 text-black'
                  )}
                >
                  {effect.icon}
                  <span className="text-[10px]">{effect.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'filters' && (
        <div className="absolute bottom-32 left-0 right-0 z-20 animate-in slide-in-from-bottom-4 duration-200">
          <div className="mx-4 p-4 rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-black font-semibold">Filters</span>
              <button type="button" onClick={() => setActiveTab(null)}>
                <ChevronDown className="w-5 h-5 text-black" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {filterPresets.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedFilter(filter)}
                  className={cn(
                    'flex flex-col items-center gap-1 min-w-[60px] transition-all',
                    selectedFilter.id === filter.id && 'scale-110'
                  )}
                >
                  <div
                    className={cn(
                      'w-14 h-14 rounded-xl border-2 transition-all',
                      selectedFilter.id === filter.id ? 'border-black' : 'border-transparent'
                    )}
                    style={{ backgroundColor: filter.preview, filter: filter.cssFilter }}
                  />
                  <span className="text-[10px] text-black">{filter.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'beauty' && (
        <div className="absolute bottom-32 left-0 right-0 z-20 animate-in slide-in-from-bottom-4 duration-200">
          <div className="mx-4 p-4 rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-black font-semibold">Beauty</span>
              <button type="button" onClick={() => setActiveTab(null)}>
                <ChevronDown className="w-5 h-5 text-black" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-black min-w-[70px]">Smooth</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={beautySmooth}
                  onChange={(e) => setBeautySmooth(Number(e.target.value))}
                  className="flex-1 h-2 accent-black rounded-lg"
                />
                <span className="text-sm text-black tabular-nums w-8">{beautySmooth}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-black min-w-[70px]">Whiten</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={beautyWhiten}
                  onChange={(e) => setBeautyWhiten(Number(e.target.value))}
                  className="flex-1 h-2 accent-black rounded-lg"
                />
                <span className="text-sm text-black tabular-nums w-8">{beautyWhiten}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Natural', smooth: 20, whiten: 10 },
                  { label: 'Smooth', smooth: 50, whiten: 20 },
                  { label: 'Dramatic', smooth: 70, whiten: 35 },
                  { label: 'Glam', smooth: 90, whiten: 50 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setBeautySmooth(preset.smooth);
                      setBeautyWhiten(preset.whiten);
                    }}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-medium transition-all',
                      beautySmooth === preset.smooth && beautyWhiten === preset.whiten
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-black'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'more' && (
        <div className="absolute bottom-32 left-0 right-0 z-20 animate-in slide-in-from-bottom-4 duration-200">
          <div className="mx-4 p-4 rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-black font-semibold">More</span>
              <button type="button" onClick={() => setActiveTab(null)}>
                <ChevronDown className="w-5 h-5 text-black" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-black/70 mb-1">Resolution</p>
                <div className="flex gap-2">
                  {resolutionOptions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResolution(r.id)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium',
                        resolution === r.id ? 'bg-black text-white' : 'bg-gray-100 text-black'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {isVideoMode && (
                <div>
                  <p className="text-xs text-black/70 mb-1">Speed</p>
                  <div className="flex gap-2 items-center">
                    {speedOptions.map((s, i) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeedIndex(i)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium',
                          speedIndex === i ? 'bg-black text-white' : 'bg-gray-100 text-black'
                        )}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-black/70 mb-1">Zoom</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cycleZoom}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-black"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-black font-mono">{zoomLevel}x</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current effect/filter label */}
      {(selectedEffect.id !== 'none' || selectedFilter.id !== 'normal') && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-2 rounded-full bg-white/90 shadow-lg">
            <span className="text-black text-sm font-medium">
              {selectedEffect.id !== 'none' && selectedEffect.name}
              {selectedEffect.id !== 'none' && selectedFilter.id !== 'normal' && ' + '}
              {selectedFilter.id !== 'normal' && selectedFilter.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
