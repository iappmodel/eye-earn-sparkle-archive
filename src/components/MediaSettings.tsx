// Media & Accessibility Settings Component
import React, { useState, useEffect } from 'react';
import { 
  Type, 
  Wifi, 
  WifiOff, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Minus,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';

const STORAGE_KEYS = {
  LOW_DATA_MODE: 'visuai-low-data-mode',
  VIDEO_AUTOPLAY: 'visuai-video-autoplay',
  SOUND_EFFECTS: 'visuai-sound-effects',
};

const FONT_SIZE_OPTIONS = [
  { value: 0.85, label: 'Small' },
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Extra Large' },
];

export const MediaSettings: React.FC = () => {
  const { fontSize, setFontSize } = useAccessibility();
  
  const [lowDataMode, setLowDataMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.LOW_DATA_MODE) === 'true';
  });
  
  const [videoAutoplay, setVideoAutoplay] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VIDEO_AUTOPLAY);
    return saved !== 'false'; // Default to true
  });
  
  const [soundEffects, setSoundEffects] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SOUND_EFFECTS);
    return saved !== 'false'; // Default to true
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOW_DATA_MODE, String(lowDataMode));
  }, [lowDataMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VIDEO_AUTOPLAY, String(videoAutoplay));
  }, [videoAutoplay]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOUND_EFFECTS, String(soundEffects));
  }, [soundEffects]);

  const currentFontIndex = FONT_SIZE_OPTIONS.findIndex(opt => opt.value === fontSize);
  const currentFontLabel = FONT_SIZE_OPTIONS.find(opt => opt.value === fontSize)?.label || 'Default';

  const decreaseFontSize = () => {
    const newIndex = Math.max(0, currentFontIndex - 1);
    setFontSize(FONT_SIZE_OPTIONS[newIndex].value);
  };

  const increaseFontSize = () => {
    const newIndex = Math.min(FONT_SIZE_OPTIONS.length - 1, currentFontIndex + 1);
    setFontSize(FONT_SIZE_OPTIONS[newIndex].value);
  };

  return (
    <div className="space-y-4">
      {/* Font Size Control */}
      <div className="neu-inset rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <Type className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-medium">Font Size</h3>
            <p className="text-xs text-muted-foreground">Adjust text size for readability</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={decreaseFontSize}
            disabled={currentFontIndex === 0}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
              currentFontIndex === 0
                ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            )}
          >
            <Minus className="w-5 h-5" />
          </button>
          
          <div className="flex-1 mx-4">
            <div className="flex justify-between mb-2">
              {FONT_SIZE_OPTIONS.map((opt, i) => (
                <div
                  key={opt.value}
                  className={cn(
                    'w-3 h-3 rounded-full transition-all',
                    i <= currentFontIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <p className="text-center text-sm font-medium">{currentFontLabel}</p>
          </div>
          
          <button
            onClick={increaseFontSize}
            disabled={currentFontIndex === FONT_SIZE_OPTIONS.length - 1}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
              currentFontIndex === FONT_SIZE_OPTIONS.length - 1
                ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            )}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        {/* Preview */}
        <div className="mt-4 p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Preview:</p>
          <p style={{ fontSize: `${fontSize}rem` }}>The quick brown fox jumps over the lazy dog.</p>
        </div>
      </div>

      {/* Low Data Mode */}
      <button
        onClick={() => setLowDataMode(!lowDataMode)}
        className="w-full flex items-center justify-between p-4 rounded-xl neu-inset hover:bg-muted/50 transition-all"
      >
        <div className="flex items-center gap-3">
          {lowDataMode ? (
            <WifiOff className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Wifi className="w-5 h-5 text-primary" />
          )}
          <div className="text-left">
            <span className="font-medium block">Low Data Mode</span>
            <span className="text-xs text-muted-foreground">
              {lowDataMode ? 'Enabled - Reduces data usage' : 'Disabled - Full quality'}
            </span>
          </div>
        </div>
        <div className={cn(
          "w-12 h-7 rounded-full p-1 transition-all",
          lowDataMode ? "bg-primary" : "bg-muted"
        )}>
          <div className={cn(
            "w-5 h-5 rounded-full bg-background shadow-md transition-transform",
            lowDataMode && "translate-x-5"
          )} />
        </div>
      </button>

      {/* Video Autoplay */}
      <button
        onClick={() => setVideoAutoplay(!videoAutoplay)}
        className="w-full flex items-center justify-between p-4 rounded-xl neu-inset hover:bg-muted/50 transition-all"
      >
        <div className="flex items-center gap-3">
          {videoAutoplay ? (
            <Play className="w-5 h-5 text-primary" />
          ) : (
            <Pause className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <span className="font-medium block">Video Autoplay</span>
            <span className="text-xs text-muted-foreground">
              {videoAutoplay ? 'Videos play automatically' : 'Tap to play videos'}
            </span>
          </div>
        </div>
        <div className={cn(
          "w-12 h-7 rounded-full p-1 transition-all",
          videoAutoplay ? "bg-primary" : "bg-muted"
        )}>
          <div className={cn(
            "w-5 h-5 rounded-full bg-background shadow-md transition-transform",
            videoAutoplay && "translate-x-5"
          )} />
        </div>
      </button>

      {/* Sound Effects */}
      <button
        onClick={() => setSoundEffects(!soundEffects)}
        className="w-full flex items-center justify-between p-4 rounded-xl neu-inset hover:bg-muted/50 transition-all"
      >
        <div className="flex items-center gap-3">
          {soundEffects ? (
            <Volume2 className="w-5 h-5 text-primary" />
          ) : (
            <VolumeX className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <span className="font-medium block">Sound Effects</span>
            <span className="text-xs text-muted-foreground">
              {soundEffects ? 'App sounds enabled' : 'App sounds muted'}
            </span>
          </div>
        </div>
        <div className={cn(
          "w-12 h-7 rounded-full p-1 transition-all",
          soundEffects ? "bg-primary" : "bg-muted"
        )}>
          <div className={cn(
            "w-5 h-5 rounded-full bg-background shadow-md transition-transform",
            soundEffects && "translate-x-5"
          )} />
        </div>
      </button>
    </div>
  );
};

// Export hooks for use in other components
export const useMediaSettings = () => {
  const [settings, setSettings] = useState({
    lowDataMode: localStorage.getItem(STORAGE_KEYS.LOW_DATA_MODE) === 'true',
    videoAutoplay: localStorage.getItem(STORAGE_KEYS.VIDEO_AUTOPLAY) !== 'false',
    soundEffects: localStorage.getItem(STORAGE_KEYS.SOUND_EFFECTS) !== 'false',
  });

  useEffect(() => {
    const handleStorage = () => {
      setSettings({
        lowDataMode: localStorage.getItem(STORAGE_KEYS.LOW_DATA_MODE) === 'true',
        videoAutoplay: localStorage.getItem(STORAGE_KEYS.VIDEO_AUTOPLAY) !== 'false',
        soundEffects: localStorage.getItem(STORAGE_KEYS.SOUND_EFFECTS) !== 'false',
      });
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return settings;
};

export default MediaSettings;
