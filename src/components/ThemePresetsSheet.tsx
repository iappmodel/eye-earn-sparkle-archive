// Theme Presets Bottom Sheet - Button & UI Customization Panel
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Palette, Sparkles, Moon, Sun, Zap,
  Waves, Flame, Leaf, Star, Diamond, Monitor,
  Circle, Square, ChevronUp, ChevronDown,
  Check, Sliders, Layout, Settings2, Wrench, Grid3X3,
  Search, RotateCcw, Download, Upload, Plus, Trash2,
  Contrast
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUICustomization, ThemeSettings, ColorMode, CustomThemePreset } from '@/contexts/UICustomizationContext';
import { NeuButton } from './NeuButton';
import { ButtonFunctionManager } from './ButtonFunctionManager';
import { LayoutEditor } from './LayoutEditor';
import { PageLayoutEditor } from './PageLayoutEditor';
import { AdvancedThemeControls } from './AdvancedThemeControls';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ThemePresetsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export type PresetCategory = 'neon' | 'nature' | 'minimal' | 'accessibility';

// Theme preset definitions (built-in)
interface ThemePreset {
  id: string;
  name: string;
  category: PresetCategory;
  icon: React.ReactNode;
  description: string;
  colors: { primary: string; accent: string; glow: string };
  buttonStyle: ThemeSettings['buttonShape'];
  glowIntensity: ThemeSettings['glowIntensity'];
}

const themePresets: ThemePreset[] = [
  { id: 'midnight', name: 'Midnight', category: 'minimal', icon: <Moon className="w-5 h-5" />, description: 'Dark premium blue + gold', colors: { primary: '210 96% 62%', accent: '42 96% 56%', glow: '195 96% 62%' }, buttonStyle: 'rounded', glowIntensity: 'medium' },
  { id: 'glass', name: 'Glass', category: 'minimal', icon: <Sparkles className="w-5 h-5" />, description: 'Liquid glass translucency', colors: { primary: '210 100% 62%', accent: '260 85% 70%', glow: '180 100% 55%' }, buttonStyle: 'soft', glowIntensity: 'subtle' },
  { id: 'cyberpunk', name: 'Cyberpunk', category: 'neon', icon: <Zap className="w-5 h-5" />, description: 'Neon purple & magenta', colors: { primary: '270 95% 65%', accent: '320 90% 60%', glow: '270 95% 65%' }, buttonStyle: 'rounded', glowIntensity: 'intense' },
  { id: 'aura', name: 'Aura', category: 'minimal', icon: <Sun className="w-5 h-5" />, description: 'White neumorphic soft', colors: { primary: '220 25% 55%', accent: '180 25% 60%', glow: '220 25% 55%' }, buttonStyle: 'soft', glowIntensity: 'subtle' },
  { id: 'lunar', name: 'Lunar', category: 'minimal', icon: <Moon className="w-5 h-5" />, description: 'Soft moonlight silver', colors: { primary: '220 60% 75%', accent: '240 40% 70%', glow: '220 60% 75%' }, buttonStyle: 'soft', glowIntensity: 'subtle' },
  { id: 'ocean', name: 'Ocean', category: 'nature', icon: <Waves className="w-5 h-5" />, description: 'Deep sea blue & teal', colors: { primary: '200 100% 50%', accent: '180 100% 40%', glow: '200 100% 50%' }, buttonStyle: 'pill', glowIntensity: 'medium' },
  { id: 'solar', name: 'Solar', category: 'nature', icon: <Sun className="w-5 h-5" />, description: 'Warm golden energy', colors: { primary: '45 100% 55%', accent: '30 100% 50%', glow: '45 100% 55%' }, buttonStyle: 'rounded', glowIntensity: 'medium' },
  { id: 'ember', name: 'Ember', category: 'nature', icon: <Flame className="w-5 h-5" />, description: 'Fire red & orange', colors: { primary: '15 100% 55%', accent: '0 85% 55%', glow: '15 100% 55%' }, buttonStyle: 'sharp', glowIntensity: 'intense' },
  { id: 'forest', name: 'Forest', category: 'nature', icon: <Leaf className="w-5 h-5" />, description: 'Natural green & emerald', colors: { primary: '150 80% 45%', accent: '120 60% 40%', glow: '150 80% 45%' }, buttonStyle: 'soft', glowIntensity: 'subtle' },
  { id: 'cosmic', name: 'Cosmic', category: 'neon', icon: <Star className="w-5 h-5" />, description: 'Galactic purple & blue', colors: { primary: '260 80% 60%', accent: '220 90% 55%', glow: '260 80% 60%' }, buttonStyle: 'pill', glowIntensity: 'intense' },
  { id: 'diamond', name: 'Diamond', category: 'minimal', icon: <Diamond className="w-5 h-5" />, description: 'Crystal white & ice', colors: { primary: '200 30% 80%', accent: '210 20% 90%', glow: '200 30% 80%' }, buttonStyle: 'sharp', glowIntensity: 'subtle' },
  { id: 'high-contrast', name: 'High contrast', category: 'accessibility', icon: <Contrast className="w-5 h-5" />, description: 'Accessible high contrast', colors: { primary: '0 0% 100%', accent: '45 100% 50%', glow: '0 0% 90%' }, buttonStyle: 'sharp', glowIntensity: 'none' },
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

const CATEGORY_LABELS: Record<PresetCategory, string> = {
  neon: 'Neon',
  nature: 'Nature',
  minimal: 'Minimal',
  accessibility: 'Accessibility',
};

export const ThemePresetsSheet: React.FC<ThemePresetsSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    themeSettings,
    colorMode,
    customPresets,
    recentPresetIds,
    setPreset,
    setButtonShape,
    setGlowIntensity,
    setColorMode,
    resetThemeToDefault,
    saveCustomPreset,
    removeCustomPreset,
    getPresetById,
    exportThemeOnly,
    importThemeOnly,
  } = useUICustomization();

  const [sheetHeight, setSheetHeight] = useState<'collapsed' | 'partial' | 'full'>('partial');
  const [activeTab, setActiveTab] = useState('themes');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PresetCategory | 'all'>('all');
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [customPresetName, setCustomPresetName] = useState('');
  const [importPasteOpen, setImportPasteOpen] = useState(false);
  const [importPasteValue, setImportPasteValue] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Focus trap when open
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return;
    const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    first?.focus();
    sheetRef.current.addEventListener('keydown', onKeyDown);
    return () => sheetRef.current?.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeTab]);

  const applyPreset = useCallback((preset: ThemePreset | CustomThemePreset) => {
    const colors = 'colors' in preset ? preset.colors : preset.colors;
    const buttonStyle = 'buttonStyle' in preset ? preset.buttonStyle : preset.buttonShape;
    const glowIntensity = 'glowIntensity' in preset ? preset.glowIntensity : preset.glowIntensity;
    const id = 'id' in preset ? preset.id : preset.id;
    setPreset(id, colors);
    setButtonShape(buttonStyle);
    setGlowIntensity(glowIntensity);
  }, [setPreset, setButtonShape, setGlowIntensity]);

  const applyCustomPreset = useCallback((preset: CustomThemePreset) => {
    setPreset(preset.id, preset.colors);
    setButtonShape(preset.buttonShape);
    setGlowIntensity(preset.glowIntensity);
  }, [setPreset, setButtonShape, setGlowIntensity]);

  const toggleHeight = () => {
    if (sheetHeight === 'collapsed') setSheetHeight('partial');
    else if (sheetHeight === 'partial') setSheetHeight('full');
    else setSheetHeight('collapsed');
  };

  // Filter presets by search and category
  const filteredPresets = themePresets.filter((p) => {
    const matchSearch = !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const recentPresets = recentPresetIds
    .map((id) => themePresets.find((p) => p.id === id) || getPresetById(id))
    .filter(Boolean) as (ThemePreset | CustomThemePreset)[];

  const handleSaveCustomPreset = () => {
    const name = customPresetName.trim() || 'My theme';
    saveCustomPreset(name);
    setCustomPresetName('');
    setShowSavePresetModal(false);
    toast.success('Theme saved as "' + name + '"');
  };

  const handleExportTheme = () => {
    const json = exportThemeOnly();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theme-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Theme exported');
  };

  const handleImportTheme = () => {
    const ok = importThemeOnly(importPasteValue);
    if (ok) {
      setImportPasteValue('');
      setImportPasteOpen(false);
      toast.success('Theme imported');
    } else {
      toast.error('Invalid theme file');
    }
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
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Theme and layout settings"
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
              {/* Color mode: Light / Dark / System */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Appearance
                </h3>
                <div className="flex gap-2 p-1 rounded-xl bg-muted/30 border border-border/30">
                  {([
                    { id: 'light' as ColorMode, icon: Sun, label: 'Light' },
                    { id: 'dark' as ColorMode, icon: Moon, label: 'Dark' },
                    { id: 'system' as ColorMode, icon: Monitor, label: 'System' },
                  ]).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setColorMode(id)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                        colorMode === id
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search presets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl bg-muted/20 border-border/30"
                />
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  All
                </button>
                {(Object.keys(CATEGORY_LABELS) as PresetCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              {/* Recently used */}
              {recentPresets.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Recently used
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {recentPresets.slice(0, 6).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={cn(
                          'relative flex-shrink-0 flex flex-col items-center gap-1.5 p-2.5 rounded-xl min-w-[72px]',
                          'border transition-all duration-300',
                          themeSettings.preset === preset.id
                            ? 'border-primary bg-primary/15'
                            : 'border-border/30 bg-muted/30 hover:bg-muted/50'
                        )}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white drop-shadow-md"
                          style={{
                            background: `linear-gradient(135deg, hsl(${preset.colors.primary}), hsl(${preset.colors.accent}))`,
                          }}
                        >
                          {'icon' in preset ? preset.icon : <Palette className="w-4 h-4" />}
                        </div>
                        <span className="text-[10px] font-medium truncate w-full text-center">
                          {'name' in preset ? preset.name : (preset as CustomThemePreset).name}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Presets by category */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Presets
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {filteredPresets.map((preset) => (
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
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          'transition-all duration-300',
                          themeSettings.preset === preset.id && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                        )}
                        style={{
                          background: `linear-gradient(135deg, hsl(${preset.colors.primary}), hsl(${preset.colors.accent}))`,
                          boxShadow: themeSettings.preset === preset.id ? `0 0 20px hsl(${preset.colors.glow} / 0.5)` : 'none',
                        }}
                      >
                        <span className="text-white drop-shadow-md">{preset.icon}</span>
                      </div>
                      <span className={cn('text-xs font-semibold text-center', themeSettings.preset === preset.id ? 'text-primary' : 'text-foreground')}>
                        {preset.name}
                      </span>
                      {themeSettings.preset === preset.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {filteredPresets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No presets match your search.</p>
                )}
              </section>

              {/* Custom presets */}
              {customPresets.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    My themes
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {customPresets.map((preset) => (
                      <div key={preset.id} className="relative group">
                        <button
                          onClick={() => applyCustomPreset(preset)}
                          className={cn(
                            'w-full relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-300',
                            themeSettings.preset === preset.id
                              ? 'border-primary bg-primary/15'
                              : 'border-border/30 bg-muted/30 hover:bg-muted/50'
                          )}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, hsl(${preset.colors.primary}), hsl(${preset.colors.accent}))`,
                            }}
                          >
                            <Palette className="w-5 h-5 text-white drop-shadow-md" />
                          </div>
                          <span className="text-xs font-semibold text-center truncate w-full">{preset.name}</span>
                          {themeSettings.preset === preset.id && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => { removeCustomPreset(preset.id); toast.success('Theme removed'); }}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          aria-label="Remove theme"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Save current as custom + Export / Import */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowSavePresetModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-medium text-sm hover:bg-primary/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Save current theme
                </button>
                <button
                  onClick={handleExportTheme}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm hover:bg-muted transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => setImportPasteOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-foreground text-sm hover:bg-muted transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
                <button
                  onClick={() => { resetThemeToDefault(); toast.success('Theme reset to default'); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground text-sm hover:bg-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to default
                </button>
              </div>

              {/* Save preset modal */}
              {showSavePresetModal && (
                <>
                  <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm" onClick={() => setShowSavePresetModal(false)} />
                  <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-[90%] max-w-sm rounded-2xl bg-card border border-border shadow-xl p-6">
                    <h4 className="font-semibold mb-2">Save theme as</h4>
                    <Input
                      placeholder="Theme name"
                      value={customPresetName}
                      onChange={(e) => setCustomPresetName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomPreset()}
                      className="mb-4 rounded-xl"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowSavePresetModal(false)} className="flex-1 py-2 rounded-xl border border-border bg-muted/50">Cancel</button>
                      <button onClick={handleSaveCustomPreset} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-medium">Save</button>
                    </div>
                  </div>
                </>
              )}

              {/* Import paste modal */}
              {importPasteOpen && (
                <>
                  <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm" onClick={() => { setImportPasteOpen(false); setImportPasteValue(''); }} />
                  <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-[90%] max-w-sm rounded-2xl bg-card border border-border shadow-xl p-6">
                    <h4 className="font-semibold mb-2">Import theme (paste JSON)</h4>
                    <textarea
                      placeholder='{"type":"theme", "themeSettings": {...}}'
                      value={importPasteValue}
                      onChange={(e) => setImportPasteValue(e.target.value)}
                      className="w-full h-24 rounded-xl border border-border bg-muted/20 p-3 text-sm font-mono resize-none"
                    />
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => { setImportPasteOpen(false); setImportPasteValue(''); }} className="flex-1 py-2 rounded-xl border border-border bg-muted/50">Cancel</button>
                      <button onClick={handleImportTheme} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-medium">Import</button>
                    </div>
                  </div>
                </>
              )}

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

              {/* Live preview */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Live preview
                </h3>
                <div
                  className="rounded-2xl p-6 border border-border/50 bg-muted/20 shadow-inner"
                  style={{
                    background: `linear-gradient(135deg, hsl(${themeSettings.colors.primary}/0.08), hsl(${themeSettings.colors.accent}/0.05))`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <NeuButton size="sm">Small</NeuButton>
                    <NeuButton size="md" variant="accent">Medium</NeuButton>
                    <NeuButton size="lg" variant="gold">Large</NeuButton>
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    Buttons update with your theme
                  </p>
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
