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
  Plus,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { EyeIndicatorPosition } from './EyeTrackingIndicator';
import {
  ATTENTION_PRESETS,
  loadAttentionPresetFromStorage,
  saveAttentionPresetToStorage,
  type AttentionPresetId,
} from '@/constants/attention';

const STORAGE_KEYS = {
  LOW_DATA_MODE: 'visuai-low-data-mode',
  VIDEO_AUTOPLAY: 'visuai-video-autoplay',
  SOUND_EFFECTS: 'visuai-sound-effects',
  EYE_INDICATOR_POSITION: 'visuai-eye-indicator-position',
  ATTENTION_THRESHOLD: 'visuai-attention-threshold',
  EYE_TRACKING_ENABLED: 'visuai-eye-tracking-enabled',
  /** 0 = use preset; 60-95 = custom required score for reward pass */
  REQUIRED_ATTENTION_OVERRIDE: 'visuai-required-attention-override',
};

const ATTENTION_PRESET_CHANGED = 'visuai-attention-preset-changed';

const FONT_SIZE_OPTIONS = [
  { value: 0.85, label: 'Small' },
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Extra Large' },
];

const EYE_POSITION_OPTIONS: { value: EyeIndicatorPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
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

  const [eyeIndicatorPosition, setEyeIndicatorPosition] = useState<EyeIndicatorPosition>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EYE_INDICATOR_POSITION);
    return (saved as EyeIndicatorPosition) || 'top-center';
  });

  const [attentionThreshold, setAttentionThreshold] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENTION_THRESHOLD);
    return saved ? parseInt(saved, 10) : 10;
  });

  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EYE_TRACKING_ENABLED);
    return saved !== 'false'; // Default to true
  });

  const [attentionPreset, setAttentionPreset] = useState<AttentionPresetId>(() =>
    loadAttentionPresetFromStorage()
  );

  /** 0 = use preset; 60–95 = custom required score for reward eligibility */
  const [requiredAttentionOverride, setRequiredAttentionOverride] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEYS.REQUIRED_ATTENTION_OVERRIDE);
    const n = v ? parseInt(v, 10) : 0;
    return n >= 60 && n <= 95 ? n : 0;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOW_DATA_MODE, String(lowDataMode));
  }, [lowDataMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VIDEO_AUTOPLAY, String(videoAutoplay));
  }, [videoAutoplay]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOUND_EFFECTS, String(soundEffects));
  }, [soundEffects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EYE_INDICATOR_POSITION, eyeIndicatorPosition);
  }, [eyeIndicatorPosition]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTENTION_THRESHOLD, String(attentionThreshold));
  }, [attentionThreshold]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EYE_TRACKING_ENABLED, String(eyeTrackingEnabled));
  }, [eyeTrackingEnabled]);

  useEffect(() => {
    saveAttentionPresetToStorage(attentionPreset);
    window.dispatchEvent(new CustomEvent(ATTENTION_PRESET_CHANGED));
  }, [attentionPreset]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REQUIRED_ATTENTION_OVERRIDE, String(requiredAttentionOverride));
  }, [requiredAttentionOverride]);

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

      {/* Eye Tracking Toggle */}
      <button
        onClick={() => setEyeTrackingEnabled(!eyeTrackingEnabled)}
        className="w-full flex items-center justify-between p-4 rounded-xl neu-inset hover:bg-muted/50 transition-all"
      >
        <div className="flex items-center gap-3">
          {eyeTrackingEnabled ? (
            <Eye className="w-5 h-5 text-primary" />
          ) : (
            <EyeOff className="w-5 h-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <span className="font-medium block">Eye Tracking</span>
            <span className="text-xs text-muted-foreground">
              {eyeTrackingEnabled ? 'Track attention for promo rewards' : 'Disabled - No attention tracking'}
            </span>
          </div>
        </div>
        <div className={cn(
          "w-12 h-7 rounded-full p-1 transition-all",
          eyeTrackingEnabled ? "bg-primary" : "bg-muted"
        )}>
          <div className={cn(
            "w-5 h-5 rounded-full bg-background shadow-md transition-transform",
            eyeTrackingEnabled && "translate-x-5"
          )} />
        </div>
      </button>

      {/* Attention mode preset */}
      <div className={cn("neu-inset rounded-xl p-4 transition-opacity", !eyeTrackingEnabled && "opacity-50 pointer-events-none")}>
        <div className="flex items-center gap-3 mb-4">
          <Eye className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-medium">Attention Mode</h3>
            <p className="text-xs text-muted-foreground">Strict = highest accuracy, Relaxed = more forgiving</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ATTENTION_PRESETS) as AttentionPresetId[]).map((id) => (
            <button
              key={id}
              onClick={() => setAttentionPreset(id)}
              className={cn(
                'px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left',
                attentionPreset === id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="block font-medium">{ATTENTION_PRESETS[id].label}</span>
              <span className="block mt-0.5 opacity-80">{ATTENTION_PRESETS[id].description}</span>
            </button>
          ))}
        </div>
        {/* Optional override: required score for reward pass (otherwise preset defines it) */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">Minimum score to earn reward</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setRequiredAttentionOverride(0)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                requiredAttentionOverride === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              Use preset ({ATTENTION_PRESETS[attentionPreset].requiredAttentionThreshold}%)
            </button>
            <button
              type="button"
              onClick={() => setRequiredAttentionOverride(requiredAttentionOverride || ATTENTION_PRESETS[attentionPreset].requiredAttentionThreshold)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                requiredAttentionOverride > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              Custom
            </button>
            {requiredAttentionOverride > 0 && (
              <>
                <input
                  type="range"
                  min={60}
                  max={95}
                  step={5}
                  value={requiredAttentionOverride}
                  onChange={(e) => setRequiredAttentionOverride(Number(e.target.value))}
                  className="w-24 h-1.5 rounded-full appearance-none bg-muted accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  aria-label="Custom required attention score"
                />
                <span className="text-xs tabular-nums w-8">{requiredAttentionOverride}%</span>
                <button
                  type="button"
                  onClick={() => setRequiredAttentionOverride(0)}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Reset to preset
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Eye Indicator Position */}
      <div className={cn("neu-inset rounded-xl p-4 transition-opacity", !eyeTrackingEnabled && "opacity-50 pointer-events-none")}>
        <div className="flex items-center gap-3 mb-4">
          <Eye className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-medium">Eye Tracking Indicator</h3>
            <p className="text-xs text-muted-foreground">Choose where the indicator appears</p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {EYE_POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEyeIndicatorPosition(opt.value)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                eyeIndicatorPosition === opt.value
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Visual preview */}
        <div className="mt-4 relative h-20 rounded-lg bg-muted/30 border border-border/50">
          <div 
            className={cn(
              'absolute w-4 h-2.5 flex items-center justify-center',
              eyeIndicatorPosition === 'top-left' && 'top-2 left-2',
              eyeIndicatorPosition === 'top-center' && 'top-2 left-1/2 -translate-x-1/2',
              eyeIndicatorPosition === 'top-right' && 'top-2 right-2',
              eyeIndicatorPosition === 'bottom-left' && 'bottom-2 left-2',
              eyeIndicatorPosition === 'bottom-right' && 'bottom-2 right-2'
            )}
          >
            <svg viewBox="0 0 32 20" className="w-full h-full stroke-primary" fill="none" strokeWidth="2">
              <path d="M2 10 Q16 1 30 10" />
              <path d="M2 10 Q16 19 30 10" />
              <circle cx="16" cy="10" r="3" className="fill-primary" />
            </svg>
          </div>
          <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">Preview</p>
        </div>
      </div>

      {/* Attention Threshold - used by promo cards for auto-pause when lost % exceeds this */}
      <div className="neu-inset rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-medium">Auto-Pause Threshold</h3>
            <p className="text-xs text-muted-foreground">
              Pause promo videos when attention is lost for more than this % of watch time (after at least 4 seconds of inattention).
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            type="button"
            onClick={() => setAttentionThreshold(Math.max(5, attentionThreshold - 5))}
            disabled={attentionThreshold <= 5}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0',
              attentionThreshold <= 5
                ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            )}
            aria-label="Decrease threshold"
          >
            <Minus className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex flex-col items-center min-w-0">
            <p className="text-2xl font-bold text-primary tabular-nums">{attentionThreshold}%</p>
            <p className="text-xs text-muted-foreground">of watch time</p>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={attentionThreshold}
              onChange={(e) => setAttentionThreshold(Number(e.target.value))}
              className="w-full mt-2 h-2 rounded-full appearance-none bg-muted accent-primary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
              aria-label="Auto-pause threshold percentage"
            />
          </div>
          
          <button
            type="button"
            onClick={() => setAttentionThreshold(Math.min(50, attentionThreshold + 5))}
            disabled={attentionThreshold >= 50}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0',
              attentionThreshold >= 50
                ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            )}
            aria-label="Increase threshold"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>5% Strict</span>
          <span>Lenient 50%</span>
        </div>
      </div>

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
function loadRequiredAttentionOverride(): number {
  const v = localStorage.getItem(STORAGE_KEYS.REQUIRED_ATTENTION_OVERRIDE);
  const n = v ? parseInt(v, 10) : 0;
  return n >= 60 && n <= 95 ? n : 0;
}

export const useMediaSettings = () => {
  const [settings, setSettings] = useState(() => ({
    lowDataMode: localStorage.getItem(STORAGE_KEYS.LOW_DATA_MODE) === 'true',
    videoAutoplay: localStorage.getItem(STORAGE_KEYS.VIDEO_AUTOPLAY) !== 'false',
    soundEffects: localStorage.getItem(STORAGE_KEYS.SOUND_EFFECTS) !== 'false',
    eyeIndicatorPosition: (localStorage.getItem(STORAGE_KEYS.EYE_INDICATOR_POSITION) as EyeIndicatorPosition) || 'top-center',
    attentionThreshold: parseInt(localStorage.getItem(STORAGE_KEYS.ATTENTION_THRESHOLD) || '10', 10),
    eyeTrackingEnabled: localStorage.getItem(STORAGE_KEYS.EYE_TRACKING_ENABLED) !== 'false',
    attentionPreset: loadAttentionPresetFromStorage(),
    requiredAttentionOverride: loadRequiredAttentionOverride(),
  }));

  useEffect(() => {
    const handleStorage = () => {
      setSettings({
        lowDataMode: localStorage.getItem(STORAGE_KEYS.LOW_DATA_MODE) === 'true',
        videoAutoplay: localStorage.getItem(STORAGE_KEYS.VIDEO_AUTOPLAY) !== 'false',
        soundEffects: localStorage.getItem(STORAGE_KEYS.SOUND_EFFECTS) !== 'false',
        eyeIndicatorPosition: (localStorage.getItem(STORAGE_KEYS.EYE_INDICATOR_POSITION) as EyeIndicatorPosition) || 'top-center',
        attentionThreshold: parseInt(localStorage.getItem(STORAGE_KEYS.ATTENTION_THRESHOLD) || '10', 10),
        eyeTrackingEnabled: localStorage.getItem(STORAGE_KEYS.EYE_TRACKING_ENABLED) !== 'false',
        attentionPreset: loadAttentionPresetFromStorage(),
        requiredAttentionOverride: loadRequiredAttentionOverride(),
      });
    };

    const handlePresetChange = () => {
      setSettings((prev) => ({ ...prev, attentionPreset: loadAttentionPresetFromStorage() }));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(ATTENTION_PRESET_CHANGED, handlePresetChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ATTENTION_PRESET_CHANGED, handlePresetChange);
    };
  }, []);

  return settings;
};

export default MediaSettings;
