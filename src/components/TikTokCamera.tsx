import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Camera, RefreshCw, Zap, Music2, Timer, 
  Sparkles, Smile, Palette, Layers, Image as ImageIcon,
  Video, Upload, ChevronUp, ChevronDown, Settings,
  Sun, Moon, Wand2, Heart, Star, Flower2, Ghost,
  Glasses, PartyPopper, Crown, Flame, Snowflake, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { shouldDisableHeavyComponents } from '@/lib/crashGuard';
type RecordingMode = 'photo' | 'video' | '15s' | '60s' | '3m' | 'live';
type CameraTab = 'effects' | 'filters' | 'beauty' | 'timer';

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
  category: 'trending' | 'new' | 'beauty' | 'funny' | 'interactive';
}

interface FilterPreset {
  id: string;
  name: string;
  preview: string;
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
  { id: 'glow', name: 'Glow', icon: <Sun className="w-5 h-5" />, category: 'beauty' },
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
  { id: 'normal', name: 'Normal', preview: '#666666' },
  { id: 'portrait', name: 'Portrait', preview: '#FFE4C4' },
  { id: 'landscape', name: 'Landscape', preview: '#87CEEB' },
  { id: 'food', name: 'Food', preview: '#FFA07A' },
  { id: 'vibe', name: 'Vibe', preview: '#DDA0DD' },
  { id: 'b&w', name: 'B&W', preview: '#808080' },
  { id: 'vintage', name: 'Vintage', preview: '#D2691E' },
  { id: 'warm', name: 'Warm', preview: '#FF7F50' },
  { id: 'cool', name: 'Cool', preview: '#4169E1' },
  { id: 'drama', name: 'Drama', preview: '#2F4F4F' },
];

const timerOptions = [0, 3, 10];

export const TikTokCamera: React.FC<TikTokCameraProps> = ({ 
  isOpen, 
  onClose, 
  onCapture,
  contentType = 'post'
}) => {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('15s');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState<Effect>(effects[0]);
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>(filterPresets[0]);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<CameraTab | null>(null);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [beautyLevel, setBeautyLevel] = useState(50);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      resetState();
    }
    return () => stopCamera();
  }, [isOpen, isFrontCamera]);

  const resetState = () => {
    setIsRecording(false);
    setRecordingProgress(0);
    setActiveTab(null);
    setCountdown(null);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: recordingMode !== 'photo',
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const toggleCamera = () => {
    setIsFrontCamera(!isFrontCamera);
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
    // Apply flash to track if supported
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && 'applyConstraints' in videoTrack) {
        try {
          (videoTrack as any).applyConstraints({
            advanced: [{ torch: !flashEnabled }]
          });
        } catch (e) {
          console.log('Flash not supported');
        }
      }
    }
  };

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
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        onCapture?.(blob, 'video');
        toast.success('Video recorded!');
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      const maxDuration = getMaxDuration();
      const startTime = Date.now();

      recordingIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = (elapsed / maxDuration) * 100;
        setRecordingProgress(Math.min(progress, 100));

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 50);

    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Could not start recording');
    }
  }, [recordingMode, onCapture]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingProgress(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1080;
    canvas.height = videoRef.current.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Mirror if front camera
      if (isFrontCamera) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          onCapture?.(blob, 'photo');
          toast.success('Photo captured!');
        }
      }, 'image/jpeg', 0.95);
    }
  }, [isFrontCamera, onCapture]);

  const handleCapturePress = () => {
    if (timerSeconds > 0 && !isRecording) {
      // Start countdown
      setCountdown(timerSeconds);
      let remaining = timerSeconds;
      const countdownInterval = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownInterval);
          setCountdown(null);
          if (recordingMode === 'photo') {
            capturePhoto();
          } else {
            startRecording();
          }
        }
      }, 1000);
    } else if (recordingMode === 'photo') {
      capturePhoto();
    } else if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const cycleTimer = () => {
    const currentIndex = timerOptions.indexOf(timerSeconds);
    const nextIndex = (currentIndex + 1) % timerOptions.length;
    setTimerSeconds(timerOptions[nextIndex]);
    toast.info(timerOptions[nextIndex] === 0 ? 'Timer off' : `Timer: ${timerOptions[nextIndex]}s`);
  };

  if (!isOpen) return null;

  // Crash guard: show safe-mode fallback if heavy components are disabled
  if (shouldDisableHeavyComponents()) {
    return (
      <div className="fixed bottom-4 right-4 z-[100] w-80 max-h-[25vh] bg-card border border-border rounded-2xl shadow-xl p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold text-sm">Camera Paused</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Camera is temporarily disabled to stabilize the app. Try again in a few seconds.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Camera View */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover",
            isFrontCamera && "scale-x-[-1]"
          )}
          style={{
            filter: selectedFilter.id !== 'normal' 
              ? `saturate(${selectedFilter.id === 'vibe' ? 1.3 : 1}) 
                 contrast(${selectedFilter.id === 'drama' ? 1.2 : 1})
                 brightness(${selectedFilter.id === 'warm' ? 1.1 : selectedFilter.id === 'cool' ? 0.95 : 1})
                 sepia(${selectedFilter.id === 'vintage' ? 0.3 : 0})
                 grayscale(${selectedFilter.id === 'b&w' ? 1 : 0})`
              : 'none'
          }}
        />
        
        {/* Effect Overlays */}
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
                  height: `${Math.random() * 30 + 20}px`,
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
                  height: `${Math.random() * 15 + 8}px`,
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
      </div>

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <span className="text-white text-9xl font-bold animate-pulse">{countdown}</span>
        </div>
      )}

      {/* Recording Progress Bar */}
      {isRecording && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-20">
          <div 
            className="h-full bg-red-500 transition-all duration-100"
            style={{ width: `${recordingProgress}%` }}
          />
        </div>
      )}

      {/* Top Controls - White Theme */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
        >
          <X className="w-5 h-5 text-black" />
        </button>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab(activeTab === 'effects' ? null : 'effects')}
            className="px-4 py-2 rounded-full bg-white/90 flex items-center gap-2 shadow-lg"
          >
            <Wand2 className="w-4 h-4 text-black" />
            <span className="text-black text-sm font-medium">Effects</span>
          </button>
        </div>
      </div>

      {/* Right Side Controls - White Theme */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10">
        {/* Flip Camera */}
        <button 
          onClick={toggleCamera}
          className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
        >
          <RefreshCw className="w-5 h-5 text-black" />
        </button>
        
        {/* Speed/Timer */}
        <button 
          onClick={cycleTimer}
          className="w-12 h-12 rounded-full bg-white/90 flex flex-col items-center justify-center shadow-lg"
        >
          <Timer className="w-4 h-4 text-black" />
          {timerSeconds > 0 && (
            <span className="text-[10px] text-black font-bold">{timerSeconds}s</span>
          )}
        </button>
        
        {/* Flash */}
        <button 
          onClick={toggleFlash}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-lg",
            flashEnabled ? "bg-yellow-400" : "bg-white/90"
          )}
        >
          <Zap className={cn("w-5 h-5", flashEnabled ? "text-white" : "text-black")} />
        </button>
        
        {/* Filters */}
        <button 
          onClick={() => setActiveTab(activeTab === 'filters' ? null : 'filters')}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-lg",
            activeTab === 'filters' ? "bg-primary" : "bg-white/90"
          )}
        >
          <Palette className={cn("w-5 h-5", activeTab === 'filters' ? "text-white" : "text-black")} />
        </button>
        
        {/* Beauty */}
        <button 
          onClick={() => setActiveTab(activeTab === 'beauty' ? null : 'beauty')}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-lg",
            activeTab === 'beauty' ? "bg-primary" : "bg-white/90"
          )}
        >
          <Sparkles className={cn("w-5 h-5", activeTab === 'beauty' ? "text-white" : "text-black")} />
        </button>
        
        {/* Music */}
        <button 
          onClick={() => toast.info('Add sounds in editor')}
          className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
        >
          <Music2 className="w-5 h-5 text-black" />
        </button>
      </div>

      {/* Left Side - Upload */}
      <div className="absolute left-4 bottom-32 z-10">
        <button 
          onClick={() => {
            onClose();
            toast.info('Upload from gallery');
          }}
          className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center shadow-lg overflow-hidden border-2 border-white"
        >
          <Upload className="w-5 h-5 text-black" />
        </button>
      </div>

      {/* Bottom Recording Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-8 z-10">
        {/* Mode Selector */}
        <div className="flex justify-center gap-6 mb-6">
          {recordingModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setRecordingMode(mode.id)}
              className="relative px-1 py-1"
            >
              <span className={cn(
                "text-sm font-semibold transition-all",
                recordingMode === mode.id ? "text-white" : "text-white/60"
              )}>
                {mode.label}
              </span>
              {recordingMode === mode.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Capture Button */}
        <div className="flex justify-center">
          <button
            onClick={handleCapturePress}
            disabled={countdown !== null}
            className={cn(
              "w-20 h-20 rounded-full border-4 border-white transition-all duration-200 flex items-center justify-center",
              isRecording ? "bg-transparent" : "bg-transparent",
              countdown !== null && "opacity-50"
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

      {/* Effects Panel - White Theme */}
      {activeTab === 'effects' && (
        <div className="absolute bottom-32 left-0 right-0 z-20 animate-slide-up">
          <div className="mx-4 p-4 rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-black font-semibold">Effects</span>
              <button onClick={() => setActiveTab(null)}>
                <ChevronDown className="w-5 h-5 text-black" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {effects.map((effect) => (
                <button
                  key={effect.id}
                  onClick={() => setSelectedEffect(effect)}
                  className={cn(
                    "flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-all",
                    selectedEffect.id === effect.id
                      ? "bg-black text-white"
                      : "bg-gray-100 text-black"
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

      {/* Filters Panel - White Theme */}
      {activeTab === 'filters' && (
        <div className="absolute bottom-32 left-0 right-0 z-20 animate-slide-up">
          <div className="mx-4 p-4 rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-black font-semibold">Filters</span>
              <button onClick={() => setActiveTab(null)}>
                <ChevronDown className="w-5 h-5 text-black" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {filterPresets.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter)}
                  className={cn(
                    "flex flex-col items-center gap-1 min-w-[60px] transition-all",
                    selectedFilter.id === filter.id && "scale-110"
                  )}
                >
                  <div 
                    className={cn(
                      "w-14 h-14 rounded-xl border-2 transition-all",
                      selectedFilter.id === filter.id ? "border-black" : "border-transparent"
                    )}
                    style={{ backgroundColor: filter.preview }}
                  />
                  <span className="text-[10px] text-black">{filter.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Beauty Panel - White Theme */}
      {activeTab === 'beauty' && (
        <div className="absolute bottom-32 left-0 right-0 z-20 animate-slide-up">
          <div className="mx-4 p-4 rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-black font-semibold">Beauty</span>
              <button onClick={() => setActiveTab(null)}>
                <ChevronDown className="w-5 h-5 text-black" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-black min-w-[60px]">Smooth</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={beautyLevel}
                  onChange={(e) => setBeautyLevel(Number(e.target.value))}
                  className="flex-1 accent-black"
                />
                <span className="text-sm text-black min-w-[30px]">{beautyLevel}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['Natural', 'Smooth', 'Dramatic', 'Glam'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      const values: Record<string, number> = { Natural: 25, Smooth: 50, Dramatic: 75, Glam: 100 };
                      setBeautyLevel(values[preset]);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      beautyLevel === { Natural: 25, Smooth: 50, Dramatic: 75, Glam: 100 }[preset]
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Effect/Filter Display */}
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
