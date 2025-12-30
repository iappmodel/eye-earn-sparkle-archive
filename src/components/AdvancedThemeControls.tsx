// Advanced Theme Controls - Custom color picker, font size, spacing
import React, { useState } from 'react';
import { Palette, Type, Move, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUICustomization } from '@/contexts/UICustomizationContext';
import { Slider } from '@/components/ui/slider';

interface AdvancedThemeControlsProps {
  className?: string;
}

// HSL Color picker component
const ColorPicker: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  // Parse HSL value
  const parseHSL = (hsl: string) => {
    const parts = hsl.split(' ');
    return {
      h: parseInt(parts[0]) || 0,
      s: parseInt(parts[1]) || 50,
      l: parseInt(parts[2]) || 50,
    };
  };

  const { h, s, l } = parseHSL(value);

  const updateColor = (updates: Partial<{ h: number; s: number; l: number }>) => {
    const newH = updates.h ?? h;
    const newS = updates.s ?? s;
    const newL = updates.l ?? l;
    onChange(`${newH} ${newS}% ${newL}%`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div 
          className="w-8 h-8 rounded-lg border border-border/50 shadow-sm"
          style={{ backgroundColor: `hsl(${value})` }}
        />
      </div>
      
      {/* Hue */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Hue</span>
          <span>{h}°</span>
        </div>
        <div 
          className="h-3 rounded-full relative"
          style={{
            background: 'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))'
          }}
        >
          <Slider
            value={[h]}
            max={360}
            step={1}
            onValueChange={([v]) => updateColor({ h: v })}
            className="absolute inset-0"
          />
        </div>
      </div>

      {/* Saturation */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Saturation</span>
          <span>{s}%</span>
        </div>
        <Slider
          value={[s]}
          max={100}
          step={1}
          onValueChange={([v]) => updateColor({ s: v })}
          className="[&_[role=slider]]:bg-primary"
        />
      </div>

      {/* Lightness */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Lightness</span>
          <span>{l}%</span>
        </div>
        <Slider
          value={[l]}
          max={100}
          step={1}
          onValueChange={([v]) => updateColor({ l: v })}
          className="[&_[role=slider]]:bg-primary"
        />
      </div>
    </div>
  );
};

export const AdvancedThemeControls: React.FC<AdvancedThemeControlsProps> = ({ className }) => {
  const { 
    themeSettings, 
    setPreset,
    advancedSettings,
    setFontSize,
    setButtonSpacing,
    setButtonPadding,
    resetAdvancedSettings
  } = useUICustomization();
  
  const [activeSection, setActiveSection] = useState<'colors' | 'typography' | 'spacing'>('colors');

  const updateCustomColor = (key: 'primary' | 'accent' | 'glow', value: string) => {
    setPreset('custom', {
      ...themeSettings.colors,
      [key]: value,
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection('colors')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium',
            'border transition-all duration-200',
            activeSection === 'colors'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border/30 bg-muted/30 hover:bg-muted/50'
          )}
        >
          <Palette className="w-4 h-4" />
          Colors
        </button>
        <button
          onClick={() => setActiveSection('typography')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium',
            'border transition-all duration-200',
            activeSection === 'typography'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border/30 bg-muted/30 hover:bg-muted/50'
          )}
        >
          <Type className="w-4 h-4" />
          Size
        </button>
        <button
          onClick={() => setActiveSection('spacing')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium',
            'border transition-all duration-200',
            activeSection === 'spacing'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border/30 bg-muted/30 hover:bg-muted/50'
          )}
        >
          <Move className="w-4 h-4" />
          Spacing
        </button>
      </div>

      {/* Colors Section */}
      {activeSection === 'colors' && (
        <div className="space-y-6 p-4 rounded-2xl bg-muted/20 border border-border/30">
          <ColorPicker
            label="Primary Color"
            value={themeSettings.colors.primary}
            onChange={(v) => updateCustomColor('primary', v)}
          />
          <ColorPicker
            label="Accent Color"
            value={themeSettings.colors.accent}
            onChange={(v) => updateCustomColor('accent', v)}
          />
          <ColorPicker
            label="Glow Color"
            value={themeSettings.colors.glow}
            onChange={(v) => updateCustomColor('glow', v)}
          />
        </div>
      )}

      {/* Typography Section */}
      {activeSection === 'typography' && (
        <div className="space-y-6 p-4 rounded-2xl bg-muted/20 border border-border/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Button Font Size</span>
              <span className="text-sm text-muted-foreground">{advancedSettings.fontSize}px</span>
            </div>
            <Slider
              value={[advancedSettings.fontSize]}
              min={10}
              max={18}
              step={1}
              onValueChange={([v]) => setFontSize(v)}
              className="[&_[role=slider]]:bg-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-card border border-border/30">
            <p className="text-center text-muted-foreground mb-2 text-xs uppercase tracking-wider">Preview</p>
            <div className="flex justify-center">
              <button 
                className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-medium"
                style={{ fontSize: `${advancedSettings.fontSize}px` }}
              >
                Button Text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacing Section */}
      {activeSection === 'spacing' && (
        <div className="space-y-6 p-4 rounded-2xl bg-muted/20 border border-border/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Button Spacing</span>
              <span className="text-sm text-muted-foreground">{advancedSettings.buttonSpacing}px</span>
            </div>
            <Slider
              value={[advancedSettings.buttonSpacing]}
              min={8}
              max={32}
              step={2}
              onValueChange={([v]) => setButtonSpacing(v)}
              className="[&_[role=slider]]:bg-primary"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Button Padding</span>
              <span className="text-sm text-muted-foreground">{advancedSettings.buttonPadding}px</span>
            </div>
            <Slider
              value={[advancedSettings.buttonPadding]}
              min={8}
              max={24}
              step={2}
              onValueChange={([v]) => setButtonPadding(v)}
              className="[&_[role=slider]]:bg-primary"
            />
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-card border border-border/30">
            <p className="text-center text-muted-foreground mb-2 text-xs uppercase tracking-wider">Preview</p>
            <div 
              className="flex flex-col items-center"
              style={{ gap: `${advancedSettings.buttonSpacing}px` }}
            >
              {[1, 2, 3].map((i) => (
                <button 
                  key={i}
                  className="rounded-xl bg-primary/20 border border-primary/30 text-foreground font-medium text-sm"
                  style={{ padding: `${advancedSettings.buttonPadding}px ${advancedSettings.buttonPadding * 1.5}px` }}
                >
                  Button {i}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={resetAdvancedSettings}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
          'border border-border/30 bg-muted/30 hover:bg-muted/50',
          'text-sm font-medium text-muted-foreground hover:text-foreground',
          'transition-all duration-200'
        )}
      >
        <RotateCcw className="w-4 h-4" />
        Reset to Defaults
      </button>
    </div>
  );
};

export default AdvancedThemeControls;
