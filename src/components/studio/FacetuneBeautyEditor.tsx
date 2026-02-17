import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Smile, Eye, Droplet, Sun, Contrast, Target, Users, Layers,
  Sparkles, Heart, CircleDot, Move, Maximize2, Minimize2,
  Wand2, RotateCcw, Pipette, Palette, Brush, Undo2, Redo2,
  Save, Download, Upload, Search, X, SplitSquareHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ComparisonSlider } from './ComparisonSlider';

const MAX_UNDO = 20;
const CUSTOM_PRESETS_KEY = 'facetune-beauty-custom-presets';

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

type PresetLook = { id: string; name: string; description: string; values: Record<string, number> };

const presetLooks: PresetLook[] = [
  { id: 'natural', name: 'Natural', description: 'Subtle enhancement', values: { 'skin-smooth': 25, 'skin-tone': 15, 'eye-brighten': 20 } },
  { id: 'glamour', name: 'Glamour', description: 'Red carpet ready', values: { 'skin-smooth': 40, 'skin-glow': 30, 'eye-enlarge': 15, 'lip-fullness': 20, 'face-contour': 25 } },
  { id: 'selfie', name: 'Selfie Ready', description: 'Perfect for social', values: { 'skin-smooth': 35, 'blemish': 30, 'teeth-whiten': 25, 'eye-brighten': 25 } },
  { id: 'soft-glow', name: 'Soft Glow', description: 'Dreamy look', values: { 'skin-smooth': 30, 'skin-glow': 40, 'eye-sparkle': 20, 'lip-gloss': 15 } },
  { id: 'bold', name: 'Bold', description: 'Statement look', values: { 'face-contour': 35, 'cheekbones': 30, 'jawline': 25, 'eye-enlarge': 20 } },
  { id: 'editorial', name: 'Editorial', description: 'Magazine style', values: { 'skin-matte': 35, 'face-contour': 40, 'cheekbones': 35, 'highlighter': 25, 'eye-brighten': 20 } },
  { id: 'no-makeup', name: 'No-Makeup', description: 'Fresh & natural', values: { 'skin-smooth': 20, 'skin-tone': 25, 'blemish': 20, 'dark-circles': 25 } },
  { id: 'golden-hour', name: 'Golden Hour', description: 'Warm glow', values: { 'skin-glow': 45, 'skin-smooth': 25, 'bronzer': 30, 'highlighter': 25, 'lip-color': 15 } },
  { id: 'professional', name: 'Professional', description: 'Polished look', values: { 'skin-smooth': 30, 'skin-tone': 20, 'teeth-whiten': 20, 'eye-brighten': 25, 'face-contour': 15 } },
  { id: 'sunset-glow', name: 'Sunset Glow', description: 'Warm & radiant', values: { 'skin-glow': 50, 'blush': 25, 'highlighter': 30, 'lip-gloss': 20 } },
];

type AIStrength = 'subtle' | 'natural' | 'strong';
type GlobalIntensity = 'light' | 'medium' | 'strong';

const AI_PRESETS: Record<AIStrength, Record<string, number>> = {
  subtle: {
    'skin-smooth': 15, 'skin-tone': 10, 'skin-glow': 15, 'blemish': 20,
    'eye-brighten': 15, 'eye-enlarge': 5, 'teeth-whiten': 10, 'face-contour': 10, 'dark-circles': 15,
  },
  natural: {
    'skin-smooth': 30, 'skin-tone': 20, 'skin-glow': 25, 'blemish': 35,
    'eye-brighten': 25, 'eye-enlarge': 10, 'teeth-whiten': 20, 'face-slim': 15, 'face-contour': 20, 'dark-circles': 30,
  },
  strong: {
    'skin-smooth': 50, 'skin-tone': 35, 'skin-glow': 45, 'blemish': 55,
    'eye-brighten': 40, 'eye-enlarge': 20, 'teeth-whiten': 35, 'face-slim': 25, 'face-contour': 35,
    'cheekbones': 25, 'jawline': 20, 'dark-circles': 45, 'lip-fullness': 15,
  },
};

const INTENSITY_MULTIPLIER: Record<GlobalIntensity, number> = {
  light: 0.6,
  medium: 1,
  strong: 1.4,
};

interface CustomPreset {
  id: string;
  name: string;
  values: Record<string, number>;
  createdAt: number;
}

function loadCustomPresets(): CustomPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomPresets(presets: CustomPreset[]) {
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

function applyIntensity(values: Record<string, number>, intensity: GlobalIntensity): Record<string, number> {
  const mult = INTENSITY_MULTIPLIER[intensity];
  if (mult === 1) return values;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    const min = k.includes('width') || k.includes('length') || k.includes('chin') || k.includes('forehead') ? -50 : 0;
    const max = 100;
    out[k] = Math.round(Math.max(min, Math.min(max, num * mult)));
  }
  return out;
}

export interface FacetuneBeautyEditorProps {
  isPremium?: boolean;
  initialValues?: Record<string, number>;
  onValuesChange?: (values: Record<string, number>) => void;
  /** Optional: show before/after images in comparison (URLs) */
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
}

export const FacetuneBeautyEditor: React.FC<FacetuneBeautyEditorProps> = ({
  initialValues,
  onValuesChange,
  beforeImageUrl,
  afterImageUrl,
}) => {
  const isPremium = true;
  const [beautyValues, setBeautyValues] = useState<Record<string, number>>(initialValues ?? {});
  const [activeCategory, setActiveCategory] = useState('face');
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [globalIntensity, setGlobalIntensity] = useState<GlobalIntensity>('medium');
  const [aiStrength, setAiStrength] = useState<AIStrength>('natural');
  const [toolSearch, setToolSearch] = useState('');
  const [undoStack, setUndoStack] = useState<Record<string, number>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, number>[]>([]);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(loadCustomPresets);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const toolRefsMap = useRef<Record<string, HTMLDivElement | null>>({});

  const pushUndo = useCallback((prev: Record<string, number>) => {
    setUndoStack((s) => {
      const next = [...s, { ...prev }].slice(-MAX_UNDO);
      return next;
    });
    setRedoStack([]);
  }, []);

  const emitValues = useCallback((values: Record<string, number>) => {
    const scaled = applyIntensity(values, globalIntensity);
    onValuesChange?.(scaled);
  }, [globalIntensity, onValuesChange]);

  const handleValueChange = useCallback((toolId: string, value: number, _tool: BeautyTool) => {
    const prev = beautyValues;
    pushUndo(prev);
    const newValues = { ...beautyValues, [toolId]: value };
    setBeautyValues(newValues);
    emitValues(newValues);
  }, [beautyValues, pushUndo, emitValues]);

  const handleReset = useCallback(() => {
    pushUndo(beautyValues);
    setBeautyValues({});
    emitValues({});
    setAutoEnhance(false);
    toast.success('Beauty settings reset');
  }, [beautyValues, pushUndo, emitValues]);

  const handleResetTool = useCallback((toolId: string) => {
    const prev = beautyValues;
    if (prev[toolId] == null) return;
    pushUndo(prev);
    const newValues = { ...beautyValues };
    delete newValues[toolId];
    setBeautyValues(newValues);
    emitValues(newValues);
    toast.success('Tool reset');
  }, [beautyValues, pushUndo, emitValues]);

  const handleResetCategory = useCallback((categoryId: string) => {
    const cat = beautyCategories.find((c) => c.id === categoryId);
    if (!cat) return;
    const prev = beautyValues;
    const keys = new Set(cat.tools.map((t) => t.id));
    const hasAny = cat.tools.some((t) => prev[t.id] != null && prev[t.id] !== 0);
    if (!hasAny) return;
    pushUndo(prev);
    const newValues = { ...beautyValues };
    keys.forEach((k) => delete newValues[k]);
    setBeautyValues(newValues);
    emitValues(newValues);
    toast.success(`${cat.name} reset`);
  }, [beautyValues, pushUndo, emitValues]);

  const applyPreset = useCallback((preset: PresetLook) => {
    pushUndo(beautyValues);
    setBeautyValues(preset.values);
    emitValues(preset.values);
    toast.success(`Applied "${preset.name}"`);
  }, [beautyValues, pushUndo, emitValues]);

  const handleAIEnhance = useCallback((strength?: AIStrength) => {
    const values = AI_PRESETS[strength ?? aiStrength];
    pushUndo(beautyValues);
    setBeautyValues(values);
    emitValues(values);
    setAutoEnhance(true);
    toast.success('AI beauty enhancement applied!', {
      description: `Strength: ${(strength ?? aiStrength).charAt(0).toUpperCase() + (strength ?? aiStrength).slice(1)}`
    });
  }, [beautyValues, aiStrength, pushUndo, emitValues]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, beautyValues]);
    setUndoStack((u) => u.slice(0, -1));
    setBeautyValues(prev);
    emitValues(prev);
    toast.success('Undo');
  }, [undoStack, beautyValues, emitValues]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, beautyValues]);
    setRedoStack((r) => r.slice(0, -1));
    setBeautyValues(next);
    emitValues(next);
    toast.success('Redo');
  }, [redoStack, beautyValues, emitValues]);

  const handleSavePreset = useCallback(() => {
    const name = savePresetName.trim() || 'My Look';
    const preset: CustomPreset = {
      id: `custom-${Date.now()}`,
      name,
      values: { ...beautyValues },
      createdAt: Date.now(),
    };
    const next = [...customPresets, preset];
    setCustomPresets(next);
    saveCustomPresets(next);
    setSavePresetOpen(false);
    setSavePresetName('');
    toast.success(`Saved "${name}"`);
  }, [beautyValues, customPresets, savePresetName]);

  const handleLoadCustomPreset = useCallback((preset: CustomPreset) => {
    pushUndo(beautyValues);
    setBeautyValues(preset.values);
    emitValues(preset.values);
    toast.success(`Applied "${preset.name}"`);
  }, [beautyValues, pushUndo, emitValues]);

  const handleDeleteCustomPreset = useCallback((id: string) => {
    const next = customPresets.filter((p) => p.id !== id);
    setCustomPresets(next);
    saveCustomPresets(next);
    toast.success('Preset removed');
  }, [customPresets]);

  const handleExport = useCallback(() => {
    const json = JSON.stringify({ beautyValues, exportedAt: new Date().toISOString() }, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      toast.success('Preset copied to clipboard');
    }).catch(() => {
      toast.error('Could not copy');
    });
  }, [beautyValues]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const data = JSON.parse(text);
        const values = data.beautyValues ?? data.values ?? data;
        if (typeof values !== 'object' || values === null) {
          toast.error('Invalid preset file');
          return;
        }
        const normalized: Record<string, number> = {};
        for (const [k, v] of Object.entries(values)) {
          if (typeof v === 'number' && Number.isFinite(v)) normalized[k] = v;
        }
        pushUndo(beautyValues);
        setBeautyValues(normalized);
        emitValues(normalized);
        toast.success('Preset imported');
      } catch {
        toast.error('Invalid preset file');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }, [beautyValues, pushUndo, emitValues]);

  const goToTool = useCallback((toolId: string) => {
    const cat = beautyCategories.find((c) => c.tools.some((t) => t.id === toolId));
    if (cat) setActiveCategory(cat.id);
    setTimeout(() => {
      const el = toolRefsMap.current[toolId];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }, []);

  const activeCount = Object.keys(beautyValues).filter((k) => beautyValues[k] !== 0).length;
  const activeTools = beautyCategories.flatMap((c) =>
    c.tools.filter((t) => (beautyValues[t.id] ?? 0) !== 0).map((t) => ({ ...t, categoryId: c.id }))
  );

  const filteredCategories = toolSearch.trim()
    ? beautyCategories.map((cat) => ({
        ...cat,
        tools: cat.tools.filter(
          (t) =>
            t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
            t.description?.toLowerCase().includes(toolSearch.toLowerCase())
        ),
      })).filter((cat) => cat.tools.length > 0)
    : beautyCategories;

  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0 && Object.keys(beautyValues).length === 0) {
      setBeautyValues(initialValues);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Header + Undo/Redo + Compare + Reset */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Beauty Studio
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <ComparisonSlider
            isActive={false}
            onToggle={() => setShowComparison(!showComparison)}
            standalone
          />
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        </div>
      </div>

      {showComparison && (
        <ComparisonSlider
          isActive
          onToggle={() => setShowComparison(false)}
          standalone
          beforeImageUrl={beforeImageUrl ?? undefined}
          afterImageUrl={afterImageUrl ?? undefined}
        />
      )}

      {/* Global intensity */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Intensity</span>
        <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 flex-1">
          {(['light', 'medium', 'strong'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setGlobalIntensity(key)}
              className={cn(
                'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                globalIntensity === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* AI Auto-Enhance with strength */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 border border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shrink-0">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">AI Auto-Enhance</h4>
              <p className="text-xs text-muted-foreground">Smart optimization</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-md border border-border bg-background/50 p-0.5">
              {(['subtle', 'natural', 'strong'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setAiStrength(key); handleAIEnhance(key); }}
                  className={cn(
                    'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                    aiStrength === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
            <Switch
              checked={autoEnhance}
              onCheckedChange={(checked) => {
                if (checked) handleAIEnhance();
                else {
                  handleReset();
                  setAutoEnhance(false);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Preset Looks + Custom + Export/Import */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted-foreground">Quick Looks</h4>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setSavePresetOpen(true)}>
              <Save className="w-3.5 h-3.5" /> Save
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => importInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Import
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {presetLooks.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={cn(
                  'flex-shrink-0 px-3 py-2 rounded-lg text-left transition-all',
                  'bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/30 active:scale-95'
                )}
              >
                <span className="text-xs font-medium block">{preset.name}</span>
                <span className="text-[10px] text-muted-foreground">{preset.description}</span>
              </button>
            ))}
            {customPresets.map((preset) => (
              <div key={preset.id} className="flex-shrink-0 flex items-stretch gap-0 rounded-lg border border-border overflow-hidden bg-muted/50">
                <button
                  onClick={() => handleLoadCustomPreset(preset)}
                  className="px-3 py-2 text-left hover:bg-muted transition-colors"
                >
                  <span className="text-xs font-medium block">{preset.name}</span>
                  <span className="text-[10px] text-muted-foreground">Custom</span>
                </button>
                <button
                  onClick={() => handleDeleteCustomPreset(preset.id)}
                  className="px-1.5 flex items-center text-muted-foreground hover:text-destructive hover:bg-muted"
                  title="Delete preset"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Active adjustments chips */}
      {activeTools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-muted-foreground self-center mr-1">Active:</span>
          {activeTools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goToTool(t.id)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
                'bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25'
              )}
            >
              {t.name}
              <span className="text-[10px] opacity-80">{beautyValues[t.id]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tool search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search tools..."
          value={toolSearch}
          onChange={(e) => setToolSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
        <TabsList className="w-full h-auto flex-wrap gap-1 bg-transparent p-0">
          {filteredCategories.map((cat) => (
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

        {filteredCategories.map((category) => {
          const hasActiveInCategory = category.tools.some((t) => (beautyValues[t.id] ?? 0) !== 0);
          return (
            <TabsContent key={category.id} value={category.id} className="mt-4">
              {category.tools.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleResetCategory(category.id)}
                    disabled={!hasActiveInCategory}
                  >
                    Reset {category.name}
                  </Button>
                </div>
              )}
              <ScrollArea className="h-[260px] pr-2">
                <div className="space-y-4">
                  {category.tools.map((tool) => {
                    const min = tool.min ?? 0;
                    const max = tool.max ?? 100;
                    const value = beautyValues[tool.id] ?? tool.defaultValue ?? (min < 0 ? 0 : 0);
                    const isLocked = false;
                    const hasValue = value !== 0;

                    return (
                      <div
                        key={tool.id}
                        ref={(el) => { toolRefsMap.current[tool.id] = el; }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                                isLocked ? 'bg-muted text-muted-foreground' : hasValue ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                              )}
                            >
                              {tool.icon}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium flex items-center gap-1">{tool.name}</span>
                              {tool.description && (
                                <span className="text-[10px] text-muted-foreground block truncate">{tool.description}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={cn('text-sm w-8 text-right tabular-nums', hasValue ? 'text-primary font-medium' : 'text-muted-foreground')}>
                              {value}
                            </span>
                            {hasValue && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleResetTool(tool.id)}
                                title="Reset this tool"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Slider
                          value={[value]}
                          onValueChange={([v]) => handleValueChange(tool.id, v, tool)}
                          min={min}
                          max={max}
                          step={1}
                          disabled={isLocked}
                          className={cn('transition-opacity', isLocked && 'opacity-40 cursor-not-allowed')}
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          );
        })}
      </Tabs>

      {activeCount > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">{activeCount} adjustment{activeCount !== 1 ? 's' : ''} active</p>
        </div>
      )}

      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Preset name"
            value={savePresetName}
            onChange={(e) => setSavePresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePresetOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePreset}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
