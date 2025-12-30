import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Lock, Unlock, Volume2, VolumeX, 
  Eye, EyeOff, Coins, UserPlus, MessageSquare, Share2, Heart, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { BlurSegment, BlurType } from './MediaBlurEditor';
import { motion, AnimatePresence } from 'framer-motion';

interface BlurPreviewPlayerProps {
  mediaUrl: string;
  mediaType: 'video' | 'image';
  segments: BlurSegment[];
  onTimeUpdate?: (time: number) => void;
  isPreviewMode?: boolean; // Viewer perspective vs creator perspective
}

export const BlurPreviewPlayer: React.FC<BlurPreviewPlayerProps> = ({
  mediaUrl,
  mediaType,
  segments,
  onTimeUpdate,
  isPreviewMode = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSegment, setActiveSegment] = useState<BlurSegment | null>(null);
  const [showCAFOverlay, setShowCAFOverlay] = useState(false);
  const [unlockedSegments, setUnlockedSegments] = useState<string[]>([]);

  // Check if current time is within any blur segment
  useEffect(() => {
    const segment = segments.find(s => 
      currentTime >= s.startTime && currentTime <= s.endTime
    );
    
    if (segment && !unlockedSegments.includes(segment.id)) {
      setActiveSegment(segment);
      
      // If CAF is enabled and we're in preview mode, pause and show overlay
      if (segment.cafEnabled && isPreviewMode && isPlaying) {
        videoRef.current?.pause();
        setIsPlaying(false);
        setShowCAFOverlay(true);
      }
      
      // Apply audio muting if needed
      if (videoRef.current) {
        videoRef.current.muted = segment.audioMuted || isMuted;
      }
    } else {
      setActiveSegment(null);
      setShowCAFOverlay(false);
      if (videoRef.current && !isMuted) {
        videoRef.current.muted = false;
      }
    }
  }, [currentTime, segments, unlockedSegments, isPreviewMode, isPlaying, isMuted]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Don't play if CAF overlay is showing
        if (!showCAFOverlay) {
          videoRef.current.play();
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.volume = value[0];
      setVolume(value[0]);
      setIsMuted(value[0] === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleUnlockCAF = () => {
    if (activeSegment) {
      setUnlockedSegments(prev => [...prev, activeSegment.id]);
      setShowCAFOverlay(false);
      
      // Resume playback
      if (videoRef.current) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const getBlurStyle = (segment: BlurSegment): React.CSSProperties => {
    const intensity = segment.blurIntensity / 100;
    
    switch (segment.blurType) {
      case 'glass':
        return { filter: `blur(${12 * intensity}px)` };
      case 'mosaic':
      case 'pixelate':
        return { filter: `blur(${2 * intensity}px)`, imageRendering: 'pixelated' as const };
      case 'xray':
        return { filter: `invert(${intensity})` };
      case 'outlines':
        return { filter: `contrast(${1 + 2 * intensity}) brightness(${1 + 0.5 * intensity})` };
      case 'negative':
        return { filter: `invert(${intensity}) hue-rotate(${180 * intensity}deg)` };
      case 'shadow':
        return { filter: `brightness(${1 - 0.8 * intensity})` };
      case 'whitening':
        return { filter: `brightness(${1 + intensity}) contrast(${1 - 0.5 * intensity})` };
      case 'blackwhite':
        return { filter: `grayscale(${intensity}) blur(${8 * intensity}px)` };
      case 'frosted':
        return { filter: `blur(${20 * intensity}px) saturate(${1 + 0.5 * intensity})` };
      case 'gaussian':
        return { filter: `blur(${25 * intensity}px)` };
      default:
        return { filter: `blur(${10 * intensity}px)` };
    }
  };

  const getCAFIcon = (type: string) => {
    switch (type) {
      case 'payment': return <Coins className="w-6 h-6" />;
      case 'follow': return <UserPlus className="w-6 h-6" />;
      case 'comment': return <MessageSquare className="w-6 h-6" />;
      case 'share': return <Share2 className="w-6 h-6" />;
      case 'like': return <Heart className="w-6 h-6" />;
      case 'subscribe': return <Bell className="w-6 h-6" />;
      default: return <Lock className="w-6 h-6" />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isCurrentlyBlurred = activeSegment && !unlockedSegments.includes(activeSegment.id);
  const isVideoHidden = isCurrentlyBlurred && activeSegment?.videoHidden;

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      {/* Video/Image element */}
      <div className="relative aspect-video">
        {mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="w-full h-full object-contain"
            style={isCurrentlyBlurred && !isVideoHidden ? getBlurStyle(activeSegment!) : undefined}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Media preview"
            className="w-full h-full object-contain"
            style={isCurrentlyBlurred ? getBlurStyle(activeSegment!) : undefined}
          />
        )}

        {/* Video hidden overlay */}
        {isVideoHidden && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
            <div className="text-center text-white">
              <EyeOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm opacity-75">Video hidden</p>
              {!activeSegment?.audioMuted && (
                <p className="text-xs opacity-50 mt-1">Audio still playing</p>
              )}
            </div>
          </div>
        )}

        {/* CAF Indicator Badge */}
        {segments.some(s => s.cafEnabled) && !isPreviewMode && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-amber-500/90 text-white text-xs font-medium flex items-center gap-1">
            <Lock className="w-3 h-3" />
            CAF Content
          </div>
        )}

        {/* CAF Overlay */}
        <AnimatePresence>
          {showCAFOverlay && activeSegment?.cafConfig && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="text-center text-white max-w-xs px-6"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-400/20 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-amber-400" />
                </div>
                
                <h3 className="text-lg font-bold mb-2">Content Locked</h3>
                
                <p className="text-sm opacity-80 mb-6">
                  {activeSegment.cafConfig.description}
                </p>

                <Button 
                  onClick={handleUnlockCAF}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  {getCAFIcon(activeSegment.cafConfig.type)}
                  {activeSegment.cafConfig.buttonText}
                </Button>

                {activeSegment.cafConfig.type === 'payment' && (
                  <p className="text-xs opacity-50 mt-3">
                    Payment will be deducted from your viCoin balance
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play/Pause overlay */}
        {!showCAFOverlay && (
          <button
            onClick={togglePlayPause}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all',
              'bg-black/50 backdrop-blur-sm',
              isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
            )}>
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white ml-1" />
              )}
            </div>
          </button>
        )}

        {/* Active segment indicator */}
        {activeSegment && !showCAFOverlay && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {activeSegment.videoHidden && (
              <div className="px-2 py-1 rounded-full bg-black/50 text-white text-xs flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
              </div>
            )}
            {activeSegment.audioMuted && (
              <div className="px-2 py-1 rounded-full bg-black/50 text-white text-xs flex items-center gap-1">
                <VolumeX className="w-3 h-3" />
              </div>
            )}
            {activeSegment.cafEnabled && !unlockedSegments.includes(activeSegment.id) && (
              <div className="px-2 py-1 rounded-full bg-amber-500/80 text-white text-xs flex items-center gap-1">
                <Lock className="w-3 h-3" />
              </div>
            )}
            {unlockedSegments.includes(activeSegment.id) && (
              <div className="px-2 py-1 rounded-full bg-green-500/80 text-white text-xs flex items-center gap-1">
                <Unlock className="w-3 h-3" />
                Unlocked
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {mediaType === 'video' && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          {/* Progress bar with blur segments */}
          <div className="relative mb-3">
            <Slider
              value={[currentTime]}
              onValueChange={handleSeek}
              max={duration || 100}
              step={0.1}
              className="cursor-pointer"
            />
            {/* Blur segment markers */}
            {segments.map((segment) => {
              const left = (segment.startTime / (duration || 1)) * 100;
              const width = ((segment.endTime - segment.startTime) / (duration || 1)) * 100;
              return (
                <div
                  key={segment.id}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none',
                    segment.cafEnabled 
                      ? 'bg-amber-400/60' 
                      : 'bg-muted-foreground/40'
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <button onClick={togglePlayPause} className="hover:opacity-80 transition-opacity">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <span className="text-xs">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="hover:opacity-80 transition-opacity">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.1}
                className="w-20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlurPreviewPlayer;
