import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Smile, Eye, Droplet, Sun, Contrast, Target, Users, Layers,
  Sparkles, Heart, CircleDot, Move, Maximize2, Minimize2,
  Wand2, RotateCcw, Pipette, Palette, Brush
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ComparisonSlider } from './ComparisonSlider';

interface BeautyTool {
  id: string;
  name: string;
  icon: React.ReactNode;
  isPremium: boolean;
  description?: string;
  min?: number;
  max?: number;
  defaultValue?: number;
}

interface BeautyCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  tools: BeautyTool[];
}

const beautyCategories: BeautyCategory[] = [
  {
    id: 'face',
    name: 'Face',
    icon: <Users className="w-4 h-4" />,
    tools: [
      { id: 'face-slim', name: 'Slim Face', icon: <Minimize2 className="w-5 h-5" />, isPremium: false, description: 'Make face appear slimmer' },
      { id: 'face-width', name: 'Face Width', icon: <Maximize2 className="w-5 h-5" />, isPremium: false, description: 'Adjust face width', min: -50, max: 50 },
      { id: 'jawline', name: 'Jawline', icon: <Move className="w-5 h-5" />, isPremium: true, description: 'Sharpen and define jawline' },
      { id: 'chin', name: 'Chin', icon: <CircleDot className="w-5 h-5" />, isPremium: true, description: 'Reshape chin', min: -50, max: 50 },
      { id: 'forehead', name: 'Forehead', icon: <Move className="w-5 h-5" />, isPremium: true, description: 'Adjust forehead size', min: -50, max: 50 },
      { id: 'cheekbones', name: 'Cheekbones', icon: <Sparkles className="w-5 h-5" />, isPremium: true, description: 'Enhance cheekbones' },
      { id: 'face-contour', name: 'Contour', icon: <Layers className="w-5 h-5" />, isPremium: true, description: 'Add natural contour shadows' },
      { id: 'face-symmetry', name: 'Symmetry', icon: <Move className="w-5 h-5" />, isPremium: true, description: 'Balance facial features' },
    ]
  },
  {
    id: 'eyes',
    name: 'Eyes',
    icon: <Eye className="w-4 h-4" />,
    tools: [
      { id: 'eye-brighten', name: 'Brighten', icon: <Sun className="w-5 h-5" />, isPremium: false, description: 'Brighten eye area' },
      { id: 'eye-enlarge', name: 'Enlarge', icon: <Maximize2 className="w-5 h-5" />, isPremium: false, description: 'Subtly enlarge eyes' },
      { id: 'eye-whiten', name: 'Whiten', icon: <Droplet className="w-5 h-5" />, isPremium: true, description: 'Whiten sclera' },
      { id: 'eye-color', name: 'Eye Color', icon: <Palette className="w-5 h-5" />, isPremium: true, description: 'Change or enhance eye color' },
      { id: 'eye-sparkle', name: 'Sparkle', icon: <Sparkles className="w-5 h-5" />, isPremium: true, description: 'Add catchlight sparkle' },
      { id: 'dark-circles', name: 'Dark Circles', icon: <Target className="w-5 h-5" />, isPremium: true, description: 'Reduce under-eye darkness' },
      { id: 'eyebrow-shape', name: 'Eyebrows', icon: <Move className="w-5 h-5" />, isPremium: true, description: 'Shape and fill eyebrows' },
      { id: 'eyelash', name: 'Lashes', icon: <Brush className="w-5 h-5" />, isPremium: true, description: 'Enhance eyelashes' },
    ]
  },
  {
    id: 'mouth',
    name: 'Mouth',
    icon: <Smile className="w-4 h-4" />,
    tools: [
      { id: 'teeth-whiten', name: 'Whiten Teeth', icon: <Smile className="w-5 h-5" />, isPremium: false, description: 'Brighten and whiten teeth' },
      { id: 'lip-color', name: 'Lip Color', icon: <Palette className="w-5 h-5" />, isPremium: true, description: 'Enhance or change lip color' },
      { id: 'lip-fullness', name: 'Lip Fullness', icon: <Heart className="w-5 h-5" />, isPremium: true, description: 'Add natural volume to lips' },
      { id: 'lip-shape', name: 'Lip Shape', icon: <Move className="w-5 h-5" />, isPremium: true, description: 'Reshape lip contour' },
      { id: 'smile-enhance', name: 'Smile', icon: <Smile className="w-5 h-5" />, isPremium: true, description: 'Enhance smile naturally' },
      { id: 'lip-gloss', name: 'Lip Gloss', icon: <Sparkles className="w-5 h-5" />, isPremium: true, description: 'Add glossy shine effect' },
    ]
  },
  {
    id: 'skin',
    name: 'Skin',
    icon: <Droplet className="w-4 h-4" />,
    tools: [
      { id: 'skin-smooth', name: 'Smooth', icon: <Droplet className="w-5 h-5" />, isPremium: false, description: 'Smooth skin texture' },
      { id: 'skin-tone', name: 'Even Tone', icon: <Pipette className="w-5 h-5" />, isPremium: false, description: 'Even out skin tone' },
      { id: 'blemish', name: 'Blemish Fix', icon: <Target className="w-5 h-5" />, isPremium: false, description: 'Remove spots and blemishes' },
      { id: 'skin-glow', name: 'Glow', icon: <Sun className="w-5 h-5" />, isPremium: true, description: 'Add healthy radiant glow' },
      { id: 'skin-matte', name: 'Matte', icon: <Contrast className="w-5 h-5" />, isPremium: true, description: 'Reduce shine and oil' },
      { id: 'pore-reduce', name: 'Pores', icon: <CircleDot className="w-5 h-5" />, isPremium: true, description: 'Minimize visible pores' },
      { id: 'wrinkle-reduce', name: 'Wrinkles', icon: <Layers className="w-5 h-5" />, isPremium: true, description: 'Soften fine lines' },
      { id: 'freckle-enhance', name: 'Freckles', icon: <Sparkles className="w-5 h-5" />, isPremium: true, description: 'Enhance or add freckles' },
    ]
  },
  {
    id: 'nose',
    name: 'Nose',
    icon: <CircleDot className="w-4 h-4" />,
    tools: [
      { id: 'nose-slim', name: 'Slim Nose', icon: <Minimize2 className="w-5 h-5" />, isPremium: true, description: 'Make nose appear slimmer' },
      { id: 'nose-length', name: 'Length', icon: <Move className="w-5 h-5" />, isPremium: true, description: 'Adjust nose length', min: -50, max: 50 },
      { id: 'nose-bridge', name: 'Bridge', icon: <Layers className="w-5 h-5" />, isPremium: true, description: 'Refine nose bridge' },
      { id: 'nose-tip', name: 'Tip', icon: <CircleDot className="w-5 h-5" />, isPremium: true, description: 'Reshape nose tip' },
      { id: 'nose-width', name: 'Width', icon: <Maximize2 className="w-5 h-5" />, isPremium: true, description: 'Adjust nose width', min: -50, max: 50 },
    ]
  },
  {
    id: 'makeup',
    name: 'Makeup',
    icon: <Brush className="w-4 h-4" />,
    tools: [
      { id: 'blush', name: 'Blush', icon: <Heart className="w-5 h-5" />, isPremium: true, description: 'Add natural blush' },
      { id: 'bronzer', name: 'Bronzer', icon: <Sun className="w-5 h-5" />, isPremium: true, description: 'Add warm bronze glow' },
      { id: 'highlighter', name: 'Highlight', icon: <Sparkles className="w-5 h-5" />, isPremium: true, description: 'Add face highlights' },
      { id: 'eyeshadow', name: 'Eyeshadow', icon: <Palette className="w-5 h-5" />, isPremium: true, description: 'Apply eyeshadow look' },
      { id: 'eyeliner', name: 'Eyeliner', icon: <Brush className="w-5 h-5" />, isPremium: true, description: 'Add eyeliner effect' },
      { id: 'mascara', name: 'Mascara', icon: <Brush className="w-5 h-5" />, isPremium: true, description: 'Enhance lash volume' },
      { id: 'lipstick', name: 'Lipstick', icon: <Palette className="w-5 h-5" />, isPremium: true, description: 'Apply lipstick color' },
      { id: 'foundation', name: 'Foundation', icon: <Droplet className="w-5 h-5" />, isPremium: true, description: 'Even skin with foundation' },
    ]
  },
];

// Preset looks
const presetLooks = [
  { id: 'natural', name: 'Natural', description: 'Subtle enhancement', values: { 'skin-smooth': 25, 'skin-tone': 15, 'eye-brighten': 20 } },
  { id: 'glamour', name: 'Glamour', description: 'Red carpet ready', values: { 'skin-smooth': 40, 'skin-glow': 30, 'eye-enlarge': 15, 'lip-fullness': 20, 'face-contour': 25 } },
  { id: 'selfie', name: 'Selfie Ready', description: 'Perfect for social', values: { 'skin-smooth': 35, 'blemish': 30, 'teeth-whiten': 25, 'eye-brighten': 25 } },
  { id: 'soft-glow', name: 'Soft Glow', description: 'Dreamy look', values: { 'skin-smooth': 30, 'skin-glow': 40, 'eye-sparkle': 20, 'lip-gloss': 15 } },
  { id: 'bold', name: 'Bold', description: 'Statement look', values: { 'face-contour': 35, 'cheekbones': 30, 'jawline': 25, 'eye-enlarge': 20 } },
];

interface FacetuneBeautyEditorProps {
  isPremium?: boolean;
  onValuesChange?: (values: Record<string, number>) => void;
}

export const FacetuneBeautyEditor: React.FC<FacetuneBeautyEditorProps> = ({
  onValuesChange
}) => {
  const isPremium = true; // All features unlocked
  const [beautyValues, setBeautyValues] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState('face');
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleValueChange = (toolId: string, value: number, tool: BeautyTool) => {
    const newValues = { ...beautyValues, [toolId]: value };
    setBeautyValues(newValues);
    onValuesChange?.(newValues);
  };

  const handleReset = () => {
    setBeautyValues({});
    onValuesChange?.({});
    toast.success('Beauty settings reset');
  };

  const applyPreset = (preset: typeof presetLooks[0]) => {
    setBeautyValues(preset.values);
    onValuesChange?.(preset.values);
    toast.success(`Applied "${preset.name}" look`);
  };

  const handleAIEnhance = () => {
    const aiValues = {
      'skin-smooth': 30,
      'skin-tone': 20,
      'skin-glow': 25,
      'blemish': 35,
      'eye-brighten': 25,
      'eye-enlarge': 10,
      'teeth-whiten': 20,
      'face-slim': 15,
      'face-contour': 20,
      'dark-circles': 30,
    };
    
    setBeautyValues(aiValues);
    onValuesChange?.(aiValues);
    setAutoEnhance(true);
    toast.success('AI beauty enhancement applied!', {
      description: 'Optimized for natural-looking results'
    });
  };

  const currentCategory = beautyCategories.find(c => c.id === activeCategory);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Beauty Studio
        </h3>
        <div className="flex items-center gap-2">
          <ComparisonSlider 
            isActive={false}
            onToggle={() => setShowComparison(!showComparison)}
            standalone
          />
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Before/After Comparison */}
      {showComparison && (
        <ComparisonSlider
          isActive={true}
          onToggle={() => setShowComparison(false)}
          standalone
        />
      )}

      {/* AI Auto-Enhance */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 border border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">AI Auto-Enhance</h4>
              <p className="text-xs text-muted-foreground">Smart optimization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={autoEnhance} 
              onCheckedChange={(checked) => {
                if (checked) {
                  handleAIEnhance();
                } else {
                  handleReset();
                  setAutoEnhance(false);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Preset Looks */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">Quick Looks</h4>
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {presetLooks.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={cn(
                  'flex-shrink-0 px-3 py-2 rounded-lg text-left transition-all',
                  'bg-muted/50 hover:bg-muted border border-transparent',
                  'hover:border-primary/30 active:scale-95'
                )}
              >
                <span className="text-xs font-medium block">{preset.name}</span>
                <span className="text-[10px] text-muted-foreground">{preset.description}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
        <TabsList className="w-full h-auto flex-wrap gap-1 bg-transparent p-0">
          {beautyCategories.map((cat) => (
            <TabsTrigger
              key={cat.id}
              value={cat.id}
              className={cn(
                'flex-1 min-w-[60px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
                'px-2 py-1.5 rounded-lg text-xs'
              )}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {beautyCategories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="mt-4">
            <ScrollArea className="h-[280px] pr-2">
              <div className="space-y-4">
                {category.tools.map((tool) => {
                  const min = tool.min ?? 0;
                  const max = tool.max ?? 100;
                  const value = beautyValues[tool.id] ?? tool.defaultValue ?? (min < 0 ? 0 : 0);
                  const isLocked = false; // All features unlocked

                  return (
                    <div key={tool.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                            isLocked 
                              ? 'bg-muted text-muted-foreground'
                              : value !== 0 
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-primary/10 text-primary'
                          )}>
                            {tool.icon}
                          </div>
                          <div>
                            <span className="text-sm font-medium flex items-center gap-1">
                              {tool.name}
                            </span>
                            {tool.description && (
                              <span className="text-[10px] text-muted-foreground block">
                                {tool.description}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={cn(
                          'text-sm w-10 text-right tabular-nums',
                          value !== 0 ? 'text-primary font-medium' : 'text-muted-foreground'
                        )}>
                          {value > 0 && min >= 0 ? value : value}
                        </span>
                      </div>
                      <Slider
                        value={[value]}
                        onValueChange={([v]) => handleValueChange(tool.id, v, tool)}
                        min={min}
                        max={max}
                        step={1}
                        disabled={isLocked}
                        className={cn(
                          'transition-opacity',
                          isLocked && 'opacity-40 cursor-not-allowed'
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      {/* Active Adjustments Summary */}
      {Object.keys(beautyValues).filter(k => beautyValues[k] !== 0).length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {Object.keys(beautyValues).filter(k => beautyValues[k] !== 0).length} adjustments active
          </p>
        </div>
      )}
    </div>
  );
};
