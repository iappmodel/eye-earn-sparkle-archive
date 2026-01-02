import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Sparkles, Smile, Sun, Moon, Zap, Star, Heart, Flower2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ARFilter {
  id: string;
  name: string;
  icon: React.ReactNode;
  type: 'beauty' | 'effect' | 'background';
  previewColor?: string;
}

const filters: ARFilter[] = [
  { id: 'none', name: 'None', icon: <RefreshCw className="w-5 h-5" />, type: 'effect' },
  { id: 'beauty', name: 'Beauty', icon: <Sparkles className="w-5 h-5" />, type: 'beauty', previewColor: 'from-pink-500/30' },
  { id: 'glow', name: 'Glow', icon: <Sun className="w-5 h-5" />, type: 'effect', previewColor: 'from-amber-500/30' },
  { id: 'dark', name: 'Dark', icon: <Moon className="w-5 h-5" />, type: 'effect', previewColor: 'from-indigo-900/50' },
  { id: 'neon', name: 'Neon', icon: <Zap className="w-5 h-5" />, type: 'effect', previewColor: 'from-cyan-500/30' },
  { id: 'sparkle', name: 'Sparkle', icon: <Star className="w-5 h-5" />, type: 'effect', previewColor: 'from-purple-500/30' },
  { id: 'hearts', name: 'Hearts', icon: <Heart className="w-5 h-5" />, type: 'effect', previewColor: 'from-rose-500/30' },
  { id: 'floral', name: 'Floral', icon: <Flower2 className="w-5 h-5" />, type: 'background', previewColor: 'from-green-500/30' },
  { id: 'cute', name: 'Cute', icon: <Smile className="w-5 h-5" />, type: 'effect', previewColor: 'from-orange-500/30' },
];

interface ARFiltersCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture?: (imageBlob: Blob) => void;
}

export const ARFiltersCamera: React.FC<ARFiltersCameraProps> = ({ isOpen, onClose, onCapture }) => {
  const [selectedFilter, setSelectedFilter] = useState<ARFilter>(filters[0]);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isOpen, isFrontCamera]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: isFrontCamera ? 'user' : 'environment' },
        audio: false,
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
  };

  const toggleCamera = () => {
    setIsFrontCamera(!isFrontCamera);
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;

    setIsCapturing(true);
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          onCapture?.(blob);
          toast.success('Photo captured!');
        }
        setIsCapturing(false);
      }, 'image/jpeg', 0.9);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md max-h-[25vh] overflow-hidden rounded-2xl border border-border/50 bg-background shadow-xl">
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
        />
        
        {/* Filter Overlay */}
        {selectedFilter.previewColor && (
          <div className={cn(
            "absolute inset-0 bg-gradient-to-b to-transparent pointer-events-none",
            selectedFilter.previewColor
          )} />
        )}

        {/* Sparkle Effects (for sparkle filter) */}
        {selectedFilter.id === 'sparkle' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <Star
                key={i}
                className="absolute text-white animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${Math.random() * 20 + 10}px`,
                  height: `${Math.random() * 20 + 10}px`,
                  opacity: Math.random() * 0.5 + 0.2,
                  animationDelay: `${Math.random() * 2}s`,
                }}
                fill="currentColor"
              />
            ))}
          </div>
        )}

        {/* Hearts Effects */}
        {selectedFilter.id === 'hearts' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(15)].map((_, i) => (
              <Heart
                key={i}
                className="absolute text-rose-500 animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${Math.random() * 30 + 15}px`,
                  height: `${Math.random() * 30 + 15}px`,
                  opacity: Math.random() * 0.6 + 0.3,
                  animationDelay: `${Math.random() * 2}s`,
                }}
                fill="currentColor"
              />
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white bg-black/30">
          <X className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCamera}
            className="text-white bg-black/30"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Filter Name */}
      {selectedFilter.id !== 'none' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full z-10">
          <span className="text-white text-sm font-medium">{selectedFilter.name}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="absolute bottom-28 left-0 right-0 z-10">
        <div className="flex items-center gap-3 px-4 overflow-x-auto scrollbar-hide py-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter)}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-all",
                selectedFilter.id === filter.id
                  ? "bg-white text-black"
                  : "bg-black/30 text-white"
              )}
            >
              {filter.icon}
              <span className="text-[10px]">{filter.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Capture Button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <Button
          onClick={handleCapture}
          disabled={isCapturing}
          className={cn(
            "w-20 h-20 rounded-full border-4 border-white transition-transform",
            isCapturing ? "scale-90" : "hover:scale-105"
          )}
          variant="ghost"
        >
          <div className="w-16 h-16 rounded-full bg-white" />
        </Button>
      </div>
    </div>
  );
};
