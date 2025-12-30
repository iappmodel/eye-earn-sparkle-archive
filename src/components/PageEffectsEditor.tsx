// Per-page CSS effects editor with blur, saturation, contrast controls
import React from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { 
  Droplets, Sun, Contrast, Sparkles, RotateCcw, Gauge
} from 'lucide-react';
import { PageEffects } from '@/contexts/UICustomizationContext';

interface PageEffectsEditorProps {
  effects?: PageEffects;
  transitionSpeed?: number;
  globalAnimationSpeed: number;
  onChange: (effects: PageEffects) => void;
  onTransitionSpeedChange: (speed: number) => void;
}

const defaultEffects: PageEffects = {
  blur: 0,
  saturation: 100,
  contrast: 100,
  brightness: 100,
};

export const PageEffectsEditor: React.FC<PageEffectsEditorProps> = ({
  effects = defaultEffects,
  transitionSpeed,
  globalAnimationSpeed,
  onChange,
  onTransitionSpeedChange,
}) => {
  const handleChange = (key: keyof PageEffects, value: number) => {
    onChange({ ...defaultEffects, ...effects, [key]: value });
  };

  const resetEffects = () => {
    onChange(defaultEffects);
  };

  // Calculate effective speed (use page-specific or global)
  const effectiveSpeed = transitionSpeed || globalAnimationSpeed;
  const usesGlobal = !transitionSpeed || transitionSpeed === 1;

  // Generate preview filter style
  const previewFilter = `
    blur(${effects?.blur || 0}px) 
    saturate(${effects?.saturation || 100}%) 
    contrast(${effects?.contrast || 100}%)
    brightness(${effects?.brightness || 100}%)
  `.trim();

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="relative rounded-xl overflow-hidden border border-border/30">
        <div 
          className="h-24 bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center"
          style={{ filter: previewFilter }}
        >
          <div className="text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-1 text-foreground/70" />
            <span className="text-xs text-foreground/70">Preview</span>
          </div>
        </div>
        <div className="absolute bottom-1 right-1 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm">
          <code className="text-[8px] text-white/70 font-mono">
            {`blur:${effects?.blur || 0} sat:${effects?.saturation || 100}%`}
          </code>
        </div>
      </div>

      {/* Transition Speed */}
      <div className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Transition Speed</span>
          </div>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full",
            usesGlobal ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"
          )}>
            {usesGlobal ? 'Global' : `${effectiveSpeed.toFixed(1)}x`}
          </span>
        </div>
        
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
            <span>0.5x Slow</span>
            <span>2x Fast</span>
          </div>
          <Slider
            value={[transitionSpeed || 1]}
            min={0.5}
            max={2}
            step={0.1}
            onValueChange={([val]) => onTransitionSpeedChange(val)}
            className="w-full"
          />
        </div>
        
        <button
          onClick={() => onTransitionSpeedChange(1)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to global ({globalAnimationSpeed.toFixed(1)}x)
        </button>
      </div>

      {/* Effects Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Visual Effects</span>
          <button
            onClick={resetEffects}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Blur */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-muted-foreground">Blur</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{effects?.blur || 0}px</span>
          </div>
          <Slider
            value={[effects?.blur || 0]}
            min={0}
            max={20}
            step={1}
            onValueChange={([val]) => handleChange('blur', val)}
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-[10px] text-muted-foreground">Saturation</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{effects?.saturation || 100}%</span>
          </div>
          <Slider
            value={[effects?.saturation || 100]}
            min={0}
            max={200}
            step={5}
            onValueChange={([val]) => handleChange('saturation', val)}
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Contrast className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[10px] text-muted-foreground">Contrast</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{effects?.contrast || 100}%</span>
          </div>
          <Slider
            value={[effects?.contrast || 100]}
            min={50}
            max={150}
            step={5}
            onValueChange={([val]) => handleChange('contrast', val)}
          />
        </div>

        {/* Brightness */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] text-muted-foreground">Brightness</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{effects?.brightness || 100}%</span>
          </div>
          <Slider
            value={[effects?.brightness || 100]}
            min={50}
            max={150}
            step={5}
            onValueChange={([val]) => handleChange('brightness', val)}
          />
        </div>
      </div>
    </div>
  );
};

export default PageEffectsEditor;
