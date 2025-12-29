import React, { useState, forwardRef, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Wand2, Sparkles, Play, Pause, Undo, Redo, 
  Layers, Sliders, Palette, Smile, Zap, Crown, Star, 
  Lock, Check, ChevronRight, RefreshCw, Download, Share2,
  Scissors, Copy, Trash2, RotateCcw, Sun, Contrast, Droplet,
  Eye, Heart, Users, Video, Image as ImageIcon, Music,
  Cpu, Brain, Clapperboard, Timer, Gauge, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

type EditorMode = 'manual' | 'ai' | 'hybrid';
type EditingTool = 'trim' | 'filters' | 'beauty' | 'effects' | 'audio' | 'text' | 'stickers' | 'speed';

interface Filter {
  id: string;
  name: string;
  preview: string;
  isPremium: boolean;
  category: 'basic' | 'cinematic' | 'vintage' | 'artistic';
}

interface BeautyTool {
  id: string;
  name: string;
  icon: React.ReactNode;
  isPremium: boolean;
  value: number;
}

interface Effect {
  id: string;
  name: string;
  icon: React.ReactNode;
  isPremium: boolean;
  category: 'transitions' | 'overlays' | 'particles' | 'glitch';
}

interface StyleTemplate {
  id: string;
  name: string;
  thumbnail: string;
  isPremium: boolean;
  description: string;
}

interface AIHighlight {
  id: string;
  startTime: number;
  endTime: number;
  score: number;
  reason: string;
  selected: boolean;
}

const filters: Filter[] = [
  { id: 'none', name: 'Original', preview: 'linear-gradient(135deg, #333 0%, #666 100%)', isPremium: false, category: 'basic' },
  { id: 'bright', name: 'Bright', preview: 'linear-gradient(135deg, #fff5e6 0%, #ffd699 100%)', isPremium: false, category: 'basic' },
  { id: 'vivid', name: 'Vivid', preview: 'linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%)', isPremium: false, category: 'basic' },
  { id: 'mono', name: 'Mono', preview: 'linear-gradient(135deg, #2d2d2d 0%, #8a8a8a 100%)', isPremium: false, category: 'basic' },
  { id: 'warm', name: 'Warm', preview: 'linear-gradient(135deg, #ff9a56 0%, #ffcd56 100%)', isPremium: false, category: 'basic' },
  { id: 'cool', name: 'Cool', preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', isPremium: false, category: 'basic' },
  { id: 'cinematic', name: 'Cinematic', preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', isPremium: true, category: 'cinematic' },
  { id: 'film-noir', name: 'Film Noir', preview: 'linear-gradient(135deg, #0f0f0f 0%, #3d3d3d 100%)', isPremium: true, category: 'cinematic' },
  { id: 'teal-orange', name: 'Teal & Orange', preview: 'linear-gradient(135deg, #008b8b 0%, #ff6347 100%)', isPremium: true, category: 'cinematic' },
  { id: 'vintage', name: 'Vintage', preview: 'linear-gradient(135deg, #d4a574 0%, #8b7355 100%)', isPremium: true, category: 'vintage' },
  { id: 'retro', name: 'Retro 80s', preview: 'linear-gradient(135deg, #ff00ff 0%, #00ffff 100%)', isPremium: true, category: 'vintage' },
  { id: 'sepia', name: 'Sepia Dream', preview: 'linear-gradient(135deg, #704214 0%, #c4a35a 100%)', isPremium: true, category: 'vintage' },
  { id: 'neon', name: 'Neon Glow', preview: 'linear-gradient(135deg, #ff00ff 0%, #00ff00 100%)', isPremium: true, category: 'artistic' },
  { id: 'dreamy', name: 'Dreamy', preview: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', isPremium: true, category: 'artistic' },
  { id: 'cyberpunk', name: 'Cyberpunk', preview: 'linear-gradient(135deg, #ff0080 0%, #7928ca 100%)', isPremium: true, category: 'artistic' },
];

const beautyTools: BeautyTool[] = [
  { id: 'smooth', name: 'Skin Smooth', icon: <Droplet className="w-5 h-5" />, isPremium: false, value: 0 },
  { id: 'brighten', name: 'Brighten Face', icon: <Sun className="w-5 h-5" />, isPremium: false, value: 0 },
  { id: 'sharpen', name: 'Sharpen', icon: <Contrast className="w-5 h-5" />, isPremium: false, value: 0 },
  { id: 'teeth', name: 'Whiten Teeth', icon: <Smile className="w-5 h-5" />, isPremium: true, value: 0 },
  { id: 'eyes', name: 'Eye Brightener', icon: <Eye className="w-5 h-5" />, isPremium: true, value: 0 },
  { id: 'slim-face', name: 'Slim Face', icon: <Users className="w-5 h-5" />, isPremium: true, value: 0 },
  { id: 'contour', name: 'Auto Contour', icon: <Layers className="w-5 h-5" />, isPremium: true, value: 0 },
  { id: 'blemish', name: 'Blemish Remove', icon: <Target className="w-5 h-5" />, isPremium: true, value: 0 },
];

const effects: Effect[] = [
  { id: 'fade', name: 'Fade', icon: <Layers className="w-5 h-5" />, isPremium: false, category: 'transitions' },
  { id: 'slide', name: 'Slide', icon: <ChevronRight className="w-5 h-5" />, isPremium: false, category: 'transitions' },
  { id: 'zoom', name: 'Zoom', icon: <Target className="w-5 h-5" />, isPremium: false, category: 'transitions' },
  { id: 'wipe', name: 'Wipe', icon: <RefreshCw className="w-5 h-5" />, isPremium: true, category: 'transitions' },
  { id: 'bokeh', name: 'Bokeh', icon: <Sparkles className="w-5 h-5" />, isPremium: true, category: 'overlays' },
  { id: 'lens-flare', name: 'Lens Flare', icon: <Sun className="w-5 h-5" />, isPremium: true, category: 'overlays' },
  { id: 'rain', name: 'Rain', icon: <Droplet className="w-5 h-5" />, isPremium: true, category: 'overlays' },
  { id: 'confetti', name: 'Confetti', icon: <Sparkles className="w-5 h-5" />, isPremium: false, category: 'particles' },
  { id: 'hearts', name: 'Hearts', icon: <Heart className="w-5 h-5" />, isPremium: false, category: 'particles' },
  { id: 'sparkle', name: 'Sparkle', icon: <Star className="w-5 h-5" />, isPremium: true, category: 'particles' },
  { id: 'glitch', name: 'Glitch', icon: <Zap className="w-5 h-5" />, isPremium: true, category: 'glitch' },
  { id: 'vhs', name: 'VHS', icon: <Video className="w-5 h-5" />, isPremium: true, category: 'glitch' },
  { id: 'rgb-split', name: 'RGB Split', icon: <Palette className="w-5 h-5" />, isPremium: true, category: 'glitch' },
];

const styleTemplates: StyleTemplate[] = [
  { id: 'trending', name: 'Trending Style', thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', isPremium: false, description: 'Most popular editing style this week' },
  { id: 'viral', name: 'Viral Edit', thumbnail: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', isPremium: false, description: 'Fast cuts, trending music, dynamic effects' },
  { id: 'aesthetic', name: 'Aesthetic', thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', isPremium: false, description: 'Soft, dreamy, Instagram-worthy' },
  { id: 'cinematic-pro', name: 'Cinematic Pro', thumbnail: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', isPremium: true, description: 'Movie-quality color grading and transitions' },
  { id: 'influencer', name: 'Influencer Pack', thumbnail: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)', isPremium: true, description: 'Professional beauty and lighting presets' },
  { id: 'music-video', name: 'Music Video', thumbnail: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', isPremium: true, description: 'Rhythm-synced effects and transitions' },
  { id: 'documentary', name: 'Documentary', thumbnail: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)', isPremium: true, description: 'Clean, professional, storytelling focus' },
  { id: 'retro-wave', name: 'Retro Wave', thumbnail: 'linear-gradient(135deg, #ff00ff 0%, #00ffff 100%)', isPremium: true, description: '80s synthwave aesthetic' },
];

const editingTools: { id: EditingTool; icon: React.ReactNode; label: string }[] = [
  { id: 'trim', icon: <Scissors className="w-5 h-5" />, label: 'Trim' },
  { id: 'filters', icon: <Palette className="w-5 h-5" />, label: 'Filters' },
  { id: 'beauty', icon: <Smile className="w-5 h-5" />, label: 'Beauty' },
  { id: 'effects', icon: <Sparkles className="w-5 h-5" />, label: 'Effects' },
  { id: 'audio', icon: <Music className="w-5 h-5" />, label: 'Audio' },
  { id: 'text', icon: <span className="text-lg font-bold">T</span>, label: 'Text' },
  { id: 'stickers', icon: <Smile className="w-5 h-5" />, label: 'Stickers' },
  { id: 'speed', icon: <Gauge className="w-5 h-5" />, label: 'Speed' },
];

const Studio = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const isPremium = tier === 'pro' || tier === 'creator';
  
  // Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>('hybrid');
  const [activeTool, setActiveTool] = useState<EditingTool>('filters');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(30); // seconds
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  
  // Filter state
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [filterIntensity, setFilterIntensity] = useState([100]);
  
  // Beauty state
  const [beautyValues, setBeautyValues] = useState<Record<string, number>>({});
  
  // Effects state
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  
  // AI state
  const [aiHighlights, setAiHighlights] = useState<AIHighlight[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [referenceVideos, setReferenceVideos] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  
  // Playback
  const [speed, setSpeed] = useState([1]);
  
  // History for undo/redo
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleBack = () => {
    navigate('/create');
  };

  const handleUndo = () => {
    if (canUndo) {
      setHistoryIndex(prev => prev - 1);
      toast.success('Undone');
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      setHistoryIndex(prev => prev + 1);
      toast.success('Redone');
    }
  };

  const handleSelectFilter = (filterId: string) => {
    const filter = filters.find(f => f.id === filterId);
    if (filter?.isPremium && !isPremium) {
      toast.error('Premium filter', {
        description: 'Upgrade to Pro or Creator plan to unlock this filter.',
        action: { label: 'Upgrade', onClick: () => navigate('/settings/subscription') }
      });
      return;
    }
    setSelectedFilter(filterId);
  };

  const handleBeautyChange = (toolId: string, value: number) => {
    const tool = beautyTools.find(t => t.id === toolId);
    if (tool?.isPremium && !isPremium) {
      toast.error('Premium beauty tool', {
        description: 'Upgrade to unlock advanced beauty features.',
        action: { label: 'Upgrade', onClick: () => navigate('/settings/subscription') }
      });
      return;
    }
    setBeautyValues(prev => ({ ...prev, [toolId]: value }));
  };

  const handleToggleEffect = (effectId: string) => {
    const effect = effects.find(e => e.id === effectId);
    if (effect?.isPremium && !isPremium) {
      toast.error('Premium effect', {
        description: 'Upgrade to unlock this effect.',
        action: { label: 'Upgrade', onClick: () => navigate('/settings/subscription') }
      });
      return;
    }
    setSelectedEffects(prev => 
      prev.includes(effectId) 
        ? prev.filter(id => id !== effectId)
        : [...prev, effectId]
    );
  };

  const handleAIAnalyze = async () => {
    setAiAnalyzing(true);
    toast.info('AI is analyzing your video...', { description: 'This may take a moment.' });
    
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate mock highlights
    const mockHighlights: AIHighlight[] = [
      { id: '1', startTime: 2, endTime: 8, score: 95, reason: 'High engagement moment - peak action', selected: true },
      { id: '2', startTime: 12, endTime: 18, score: 88, reason: 'Emotional highlight - smile detected', selected: true },
      { id: '3', startTime: 22, endTime: 28, score: 82, reason: 'Visual interest - dynamic movement', selected: false },
    ];
    
    setAiHighlights(mockHighlights);
    setAiSuggestions([
      'Add trending audio "Summer Vibes" to boost engagement',
      'Apply "Cinematic" color grade for professional look',
      'Trim intro by 2 seconds for faster hook',
      'Add text overlay at 0:05 for context',
    ]);
    
    setAiAnalyzing(false);
    toast.success('AI analysis complete!', { description: `Found ${mockHighlights.length} highlight moments.` });
  };

  const handleSelectStyle = (styleId: string) => {
    const style = styleTemplates.find(s => s.id === styleId);
    if (style?.isPremium && !isPremium) {
      toast.error('Premium style template', {
        description: 'Upgrade to use this professional style.',
        action: { label: 'Upgrade', onClick: () => navigate('/settings/subscription') }
      });
      return;
    }
    setSelectedStyle(styleId);
    toast.success(`Applied "${style?.name}" style`);
  };

  const handleApplyAIEdit = async () => {
    setIsProcessing(true);
    toast.info('Applying AI-powered edits...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsProcessing(false);
    toast.success('AI edits applied!', { description: 'Your video is now enhanced.' });
  };

  const handleExport = () => {
    toast.success('Exporting video...', {
      description: 'Your creation will be ready in a moment.',
    });
    setTimeout(() => {
      navigate('/create');
    }, 1500);
  };

  const toggleHighlight = (id: string) => {
    setAiHighlights(prev => 
      prev.map(h => h.id === id ? { ...h, selected: !h.selected } : h)
    );
  };

  const renderToolPanel = () => {
    switch (activeTool) {
      case 'filters':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filters</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Intensity</span>
                <Slider 
                  value={filterIntensity} 
                  onValueChange={setFilterIntensity}
                  max={100}
                  step={1}
                  className="w-24"
                />
                <span className="text-sm w-8">{filterIntensity[0]}%</span>
              </div>
            </div>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="cinematic">Cinematic</TabsTrigger>
                <TabsTrigger value="vintage">Vintage</TabsTrigger>
                <TabsTrigger value="artistic">Artistic</TabsTrigger>
              </TabsList>
              
              {['basic', 'cinematic', 'vintage', 'artistic'].map((category) => (
                <TabsContent key={category} value={category} className="mt-3">
                  <div className="grid grid-cols-3 gap-2">
                    {filters.filter(f => f.category === category).map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => handleSelectFilter(filter.id)}
                        className={cn(
                          'relative aspect-square rounded-xl overflow-hidden transition-all',
                          'hover:scale-105 active:scale-95',
                          selectedFilter === filter.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                        )}
                      >
                        <div 
                          className="absolute inset-0"
                          style={{ background: filter.preview }}
                        />
                        {filter.isPremium && !isPremium && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                            <Crown className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                          <span className="text-xs text-white font-medium">{filter.name}</span>
                        </div>
                        {selectedFilter === filter.id && (
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        );
        
      case 'beauty':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Beauty Tools</h3>
              <Button variant="ghost" size="sm" onClick={() => setBeautyValues({})}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reset
              </Button>
            </div>
            
            <div className="space-y-4">
              {beautyTools.map((tool) => (
                <div key={tool.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        tool.isPremium && !isPremium 
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                      )}>
                        {tool.icon}
                      </div>
                      <span className="text-sm font-medium">{tool.name}</span>
                      {tool.isPremium && !isPremium && (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground w-8 text-right">
                      {beautyValues[tool.id] || 0}
                    </span>
                  </div>
                  <Slider
                    value={[beautyValues[tool.id] || 0]}
                    onValueChange={([value]) => handleBeautyChange(tool.id, value)}
                    max={100}
                    step={1}
                    disabled={tool.isPremium && !isPremium}
                    className={cn(tool.isPremium && !isPremium && 'opacity-50')}
                  />
                </div>
              ))}
            </div>
            
            {/* AI Beauty Enhancement */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">AI Auto-Enhance</h4>
                  <p className="text-xs text-muted-foreground">Let AI optimize your appearance</p>
                </div>
              </div>
              <Button 
                className="w-full" 
                variant="secondary"
                onClick={() => {
                  if (!isPremium) {
                    toast.error('Premium feature', { description: 'Upgrade to use AI auto-enhance.' });
                    return;
                  }
                  setBeautyValues({
                    smooth: 35,
                    brighten: 20,
                    sharpen: 15,
                    teeth: 25,
                    eyes: 30,
                  });
                  toast.success('AI beauty enhancement applied!');
                }}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Apply AI Enhancement
                {!isPremium && <Crown className="w-4 h-4 ml-2 text-amber-500" />}
              </Button>
            </div>
          </div>
        );
        
      case 'effects':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Effects & Transitions</h3>
            
            <Tabs defaultValue="transitions" className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="transitions">Transitions</TabsTrigger>
                <TabsTrigger value="overlays">Overlays</TabsTrigger>
                <TabsTrigger value="particles">Particles</TabsTrigger>
                <TabsTrigger value="glitch">Glitch</TabsTrigger>
              </TabsList>
              
              {['transitions', 'overlays', 'particles', 'glitch'].map((category) => (
                <TabsContent key={category} value={category} className="mt-3">
                  <div className="grid grid-cols-3 gap-2">
                    {effects.filter(e => e.category === category).map((effect) => (
                      <button
                        key={effect.id}
                        onClick={() => handleToggleEffect(effect.id)}
                        className={cn(
                          'relative p-3 rounded-xl transition-all',
                          'hover:bg-muted/80 active:scale-95',
                          selectedEffects.includes(effect.id)
                            ? 'bg-primary/20 border border-primary/50'
                            : 'bg-muted/50 border border-transparent',
                          effect.isPremium && !isPremium && 'opacity-60'
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            selectedEffects.includes(effect.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted-foreground/20 text-muted-foreground'
                          )}>
                            {effect.icon}
                          </div>
                          <span className="text-xs font-medium">{effect.name}</span>
                        </div>
                        {effect.isPremium && !isPremium && (
                          <div className="absolute top-1 right-1">
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                        )}
                        {selectedEffects.includes(effect.id) && (
                          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        );
        
      case 'speed':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold">Speed Control</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Playback Speed</span>
                <span className="text-lg font-bold">{speed[0]}x</span>
              </div>
              
              <Slider
                value={speed}
                onValueChange={setSpeed}
                min={0.25}
                max={4}
                step={0.25}
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.25x</span>
                <span>1x</span>
                <span>2x</span>
                <span>4x</span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[0.5, 1, 1.5, 2].map((s) => (
                  <Button
                    key={s}
                    variant={speed[0] === s ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setSpeed([s])}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
              
              {/* Smooth Slow-Mo */}
              <div className="p-4 rounded-xl bg-muted/50 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-primary" />
                    <span className="font-medium">AI Smooth Slow-Mo</span>
                  </div>
                  {!isPremium && <Crown className="w-4 h-4 text-amber-500" />}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  AI-powered frame interpolation for ultra-smooth slow motion
                </p>
                <Switch disabled={!isPremium} />
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <p>Select a tool to get started</p>
          </div>
        );
    }
  };

  return (
    <div ref={ref} className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-primary" />
            Studio
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleUndo}
              disabled={!canUndo}
              className="w-8 h-8"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRedo}
              disabled={!canRedo}
              className="w-8 h-8"
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Editor Mode Tabs */}
      <div className="px-4 py-2 border-b border-border/30">
        <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as EditorMode)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="manual" className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> Manual
            </TabsTrigger>
            <TabsTrigger value="hybrid" className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4" /> Hybrid
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5">
              <Brain className="w-4 h-4" /> AI Editor
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-[9/16] max-h-[50vh] bg-black/80 mx-4 mt-4 rounded-xl overflow-hidden">
        {/* Placeholder for video */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Video Preview</p>
          </div>
        </div>
        
        {/* Play overlay */}
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </div>
        </button>
        
        {/* Processing overlay */}
        {(isProcessing || aiAnalyzing) && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <RefreshCw className="w-10 h-10 text-primary animate-spin mb-3" />
            <p className="text-white font-medium">
              {aiAnalyzing ? 'AI Analyzing...' : 'Processing...'}
            </p>
          </div>
        )}
        
        {/* Filter preview */}
        {selectedFilter !== 'none' && (
          <div 
            className="absolute inset-0 mix-blend-overlay opacity-50"
            style={{ background: filters.find(f => f.id === selectedFilter)?.preview }}
          />
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10">
            {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')}
          </span>
          <div className="flex-1 relative h-8 bg-muted/30 rounded-lg overflow-hidden">
            {/* Progress */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-primary/30"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            {/* AI Highlights */}
            {aiHighlights.map((h) => (
              <button
                key={h.id}
                onClick={() => toggleHighlight(h.id)}
                className={cn(
                  'absolute top-1 bottom-1 rounded transition-all',
                  h.selected 
                    ? 'bg-green-500/50 border border-green-500' 
                    : 'bg-amber-500/30 border border-amber-500/50'
                )}
                style={{
                  left: `${(h.startTime / duration) * 100}%`,
                  width: `${((h.endTime - h.startTime) / duration) * 100}%`,
                }}
                title={h.reason}
              />
            ))}
            {/* Playhead */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right">
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* AI Mode Panel */}
      {editorMode === 'ai' && (
        <div className="px-4 py-3 space-y-4 border-t border-border/30">
          {/* AI Analyze Button */}
          <Button 
            onClick={handleAIAnalyze} 
            disabled={aiAnalyzing}
            className="w-full"
            variant="secondary"
          >
            <Brain className="w-4 h-4 mr-2" />
            {aiAnalyzing ? 'Analyzing...' : 'Analyze Video with AI'}
          </Button>
          
          {/* AI Highlights */}
          {aiHighlights.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">AI Detected Highlights</h4>
              {aiHighlights.map((h) => (
                <button
                  key={h.id}
                  onClick={() => toggleHighlight(h.id)}
                  className={cn(
                    'w-full p-3 rounded-lg text-left transition-all',
                    h.selected 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-muted/50 border border-transparent'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {Math.floor(h.startTime / 60)}:{(h.startTime % 60).toString().padStart(2, '0')} - 
                      {Math.floor(h.endTime / 60)}:{(h.endTime % 60).toString().padStart(2, '0')}
                    </span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      h.score >= 90 ? 'bg-green-500/20 text-green-400' :
                      h.score >= 80 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {h.score}% match
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{h.reason}</p>
                </button>
              ))}
            </div>
          )}
          
          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">AI Suggestions</h4>
              {aiSuggestions.map((suggestion, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 text-sm"
                >
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Style Templates */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Style Templates</h4>
            <div className="grid grid-cols-2 gap-2">
              {styleTemplates.slice(0, 4).map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleSelectStyle(style.id)}
                  className={cn(
                    'relative p-3 rounded-xl text-left transition-all',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    selectedStyle === style.id
                      ? 'ring-2 ring-primary'
                      : 'ring-1 ring-border/50'
                  )}
                >
                  <div 
                    className="absolute inset-0 rounded-xl opacity-20"
                    style={{ background: style.thumbnail }}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{style.name}</span>
                      {style.isPremium && !isPremium && (
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {style.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full">
              View All Styles <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {/* Apply AI Edits */}
          {(aiHighlights.some(h => h.selected) || selectedStyle) && (
            <Button 
              onClick={handleApplyAIEdit}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-primary to-accent"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Apply AI Edits
            </Button>
          )}
        </div>
      )}

      {/* Manual/Hybrid Tool Panel */}
      {(editorMode === 'manual' || editorMode === 'hybrid') && (
        <div className="flex-1 flex flex-col border-t border-border/30">
          {/* Tool Tabs */}
          <div className="px-2 py-2 overflow-x-auto">
            <div className="flex gap-1">
              {editingTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]',
                    activeTool === tool.id
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {tool.icon}
                  <span className="text-[10px] font-medium">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Tool Content */}
          <div className="flex-1 px-4 py-3 overflow-y-auto max-h-[40vh]">
            {renderToolPanel()}
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="sticky bottom-0 p-4 glass-dark border-t border-border/50 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => navigate('/create')}>
          <RefreshCw className="w-4 h-4 mr-2" /> Start Over
        </Button>
        <Button className="flex-1" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>
    </div>
  );
});

Studio.displayName = 'Studio';

export default Studio;
