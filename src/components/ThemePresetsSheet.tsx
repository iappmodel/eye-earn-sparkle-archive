// Theme Presets Bottom Sheet - Button & UI Customization Panel
import React, { useState } from 'react';
import { 
  X, Palette, Sparkles, Moon, Sun, Zap, 
  Waves, Flame, Leaf, Star, Diamond,
  Circle, Square, ChevronUp, ChevronDown,
  Check, Sliders, Layout, Settings2, Wrench, Grid3X3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUICustomization, ThemeSettings } from '@/contexts/UICustomizationContext';
import { NeuButton } from './NeuButton';
import { ButtonFunctionManager } from './ButtonFunctionManager';
import { LayoutEditor } from './LayoutEditor';
import { PageLayoutEditor } from './PageLayoutEditor';
import { AdvancedThemeControls } from './AdvancedThemeControls';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ThemePresetsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Theme preset definitions
interface ThemePreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  colors: {
    primary: string;
    accent: string;
    glow: string;
  };
  buttonStyle: ThemeSettings['buttonShape'];
  glowIntensity: ThemeSettings['glowIntensity'];
}

const themePresets: ThemePreset[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    icon: <Zap className="w-5 h-5" />,
    description: 'Neon purple & magenta glow',
    colors: { primary: '270 95% 65%', accent: '320 90% 60%', glow: '270 95% 65%' },
    buttonStyle: 'rounded',
    glowIntensity: 'intense',
  },
  {
    id: 'lunar',
    name: 'Lunar',
    icon: <Moon className="w-5 h-5" />,
    description: 'Soft moonlight silver',
    colors: { primary: '220 60% 75%', accent: '240 40% 70%', glow: '220 60% 75%' },
    buttonStyle: 'soft',
    glowIntensity: 'subtle',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    icon: <Waves className="w-5 h-5" />,
    description: 'Deep sea blue & teal',
    colors: { primary: '200 100% 50%', accent: '180 100% 40%', glow: '200 100% 50%' },
    buttonStyle: 'pill',
    glowIntensity: 'medium',
  },
  {
    id: 'solar',
    name: 'Solar',
    icon: <Sun className="w-5 h-5" />,
    description: 'Warm golden energy',
    colors: { primary: '45 100% 55%', accent: '30 100% 50%', glow: '45 100% 55%' },
    buttonStyle: 'rounded',
    glowIntensity: 'medium',
  },
  {
    id: 'ember',
    name: 'Ember',
    icon: <Flame className="w-5 h-5" />,
    description: 'Fire red & orange',
    colors: { primary: '15 100% 55%', accent: '0 85% 55%', glow: '15 100% 55%' },
    buttonStyle: 'sharp',
    glowIntensity: 'intense',
  },
  {
    id: 'forest',
    name: 'Forest',
    icon: <Leaf className="w-5 h-5" />,
    description: 'Natural green & emerald',
    colors: { primary: '150 80% 45%', accent: '120 60% 40%', glow: '150 80% 45%' },
    buttonStyle: 'soft',
    glowIntensity: 'subtle',
  },
  {
    id: 'cosmic',
    name: 'Cosmic',
    icon: <Star className="w-5 h-5" />,
    description: 'Galactic purple & blue',
    colors: { primary: '260 80% 60%', accent: '220 90% 55%', glow: '260 80% 60%' },
    buttonStyle: 'pill',
    glowIntensity: 'intense',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    icon: <Diamond className="w-5 h-5" />,
    description: 'Crystal white & ice',
    colors: { primary: '200 30% 80%', accent: '210 20% 90%', glow: '200 30% 80%' },
    buttonStyle: 'sharp',
    glowIntensity: 'subtle',
  },
];

// Button shape options
const buttonShapes: { id: ThemeSettings['buttonShape']; icon: React.ReactNode; label: string }[] = [
  { id: 'rounded', icon: <Circle className="w-4 h-4" />, label: 'Rounded' },
  { id: 'pill', icon: <div className="w-6 h-3 rounded-full border-2 border-current" />, label: 'Pill' },
  { id: 'sharp', icon: <Square className="w-4 h-4" />, label: 'Sharp' },
  { id: 'soft', icon: <div className="w-4 h-4 rounded-lg border-2 border-current" />, label: 'Soft' },
];

// Glow intensity options
const glowOptions: { id: ThemeSettings['glowIntensity']; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'subtle', label: 'Subtle' },
  { id: 'medium', label: 'Medium' },
  { id: 'intense', label: 'Intense' },
];

export const ThemePresetsSheet: React.FC<ThemePresetsSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    themeSettings, 
    setPreset, 
    setButtonShape, 
    setGlowIntensity 
  } = useUICustomization();
  
  const [sheetHeight, setSheetHeight] = useState<'collapsed' | 'partial' | 'full'>('partial');
  const [activeTab, setActiveTab] = useState('themes');

  // Apply preset
  const applyPreset = (preset: ThemePreset) => {
    setPreset(preset.id, preset.colors);
    setButtonShape(preset.buttonStyle);
    setGlowIntensity(preset.glowIntensity);
  };

  const toggleHeight = () => {
    if (sheetHeight === 'collapsed') setSheetHeight('partial');
    else if (sheetHeight === 'partial') setSheetHeight('full');
    else setSheetHeight('collapsed');
  };

  if (!isOpen) return null;

  const heightClasses = {
    collapsed: 'h-20',
    partial: 'h-[60vh]',
    full: 'h-[90vh]',
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[70]',
          'bg-card/95 backdrop-blur-xl',
          'border-t border-border/50',
          'rounded-t-3xl',
          'transition-all duration-500 ease-out',
          'shadow-[0_-10px_40px_hsl(var(--primary)/0.2)]',
          heightClasses[sheetHeight]
        )}
      >
        {/* Handle bar */}
        <div 
          className="flex justify-center py-3 cursor-pointer"
          onClick={toggleHeight}
        >
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Settings</h2>
              <p className="text-xs text-muted-foreground">Themes, buttons & layout</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleHeight}
              className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              {sheetHeight === 'full' ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronUp className="w-5 h-5" />
              )}
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={cn(
          'px-6 pb-8 overflow-y-auto',
          sheetHeight === 'collapsed' ? 'hidden' : 'block',
          sheetHeight === 'partial' ? 'max-h-[calc(60vh-100px)]' : 'max-h-[calc(90vh-100px)]'
        )}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5 mb-4">
              <TabsTrigger value="themes" className="gap-1 px-2">
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Themes</span>
              </TabsTrigger>
              <TabsTrigger value="pages" className="gap-1 px-2">
                <Grid3X3 className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Pages</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-1 px-2">
                <Wrench className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Custom</span>
              </TabsTrigger>
              <TabsTrigger value="buttons" className="gap-1 px-2">
                <Sliders className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Buttons</span>
              </TabsTrigger>
              <TabsTrigger value="layout" className="gap-1 px-2">
                <Layout className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Layout</span>
              </TabsTrigger>
            </TabsList>

            {/* Themes Tab */}
            <TabsContent value="themes" className="space-y-6">
              {/* Theme Presets Grid */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Presets
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {themePresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'relative flex flex-col items-center gap-2 p-3 rounded-2xl',
                        'border transition-all duration-300',
                        themeSettings.preset === preset.id
                          ? 'border-primary bg-primary/15 shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
                          : 'border-border/30 bg-muted/30 hover:bg-muted/50 hover:border-border/60'
                      )}
                    >
                      {/* Color preview circle */}
                      <div 
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          'transition-all duration-300',
                          themeSettings.preset === preset.id && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                        )}
                        style={{ 
                          background: `linear-gradient(135deg, hsl(${preset.colors.primary}), hsl(${preset.colors.accent}))`,
                          boxShadow: themeSettings.preset === preset.id 
                            ? `0 0 20px hsl(${preset.colors.glow} / 0.5)` 
                            : 'none'
                        }}
                      >
                        <span className="text-white drop-shadow-md">{preset.icon}</span>
                      </div>
                      
                      {/* Name */}
                      <span className={cn(
                        'text-xs font-semibold text-center',
                        themeSettings.preset === preset.id ? 'text-primary' : 'text-foreground'
                      )}>
                        {preset.name}
                      </span>
                      
                      {/* Selected check */}
                      {themeSettings.preset === preset.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Button Shape */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Button Shape
                </h3>
                <div className="flex gap-2">
                  {buttonShapes.map((shape) => (
                    <button
                      key={shape.id}
                      onClick={() => setButtonShape(shape.id)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-2 p-3 rounded-xl',
                        'border transition-all duration-200',
                        themeSettings.buttonShape === shape.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border/30 bg-muted/30 hover:bg-muted/50'
                      )}
                    >
                      <span className={cn(
                        'transition-colors',
                        themeSettings.buttonShape === shape.id ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        {shape.icon}
                      </span>
                      <span className="text-xs font-medium">{shape.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Glow Intensity */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Glow Intensity
                </h3>
                <div className="flex gap-2">
                  {glowOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setGlowIntensity(option.id)}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl text-sm font-medium',
                        'border transition-all duration-200',
                        themeSettings.glowIntensity === option.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/30 bg-muted/30 text-foreground hover:bg-muted/50'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Preview */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Preview
                </h3>
                <div className="neu-card rounded-2xl p-6">
                  <div className="flex items-center justify-center gap-4">
                    <NeuButton size="sm">Small</NeuButton>
                    <NeuButton size="md" variant="accent">Medium</NeuButton>
                    <NeuButton size="lg" variant="gold">Large</NeuButton>
                  </div>
                </div>
              </section>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced">
              <AdvancedThemeControls />
            </TabsContent>

            {/* Pages Tab */}
            <TabsContent value="pages">
              <PageLayoutEditor isOpen={true} onClose={() => {}} />
            </TabsContent>

            {/* Buttons Tab */}
            <TabsContent value="buttons">
              <ButtonFunctionManager isOpen={true} onClose={() => {}} />
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout">
              <LayoutEditor isOpen={true} onClose={() => {}} />
            </TabsContent>
          </Tabs>

          {/* Apply Button */}
          <button
            onClick={onClose}
            className={cn(
              'w-full py-4 mt-6 rounded-2xl font-display font-bold text-lg',
              'bg-gradient-to-r from-primary to-accent',
              'text-primary-foreground',
              'shadow-[0_0_30px_hsl(var(--primary)/0.4)]',
              'hover:shadow-[0_0_50px_hsl(var(--primary)/0.6)]',
              'transition-all duration-300',
              'active:scale-[0.98]'
            )}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};

export default ThemePresetsSheet;
