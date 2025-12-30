import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Wand2, Check, Play, Zap, Heart, Film, Sparkles,
  Mountain, Music, Clapperboard, Flame, Droplets, Wind, Sun,
  Moon, Star, Ghost, Skull, Laugh, PartyPopper, Medal, Brain,
  RefreshCw, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface AIStyle {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: 'dynamic' | 'emotional' | 'cinematic' | 'special';
  isPremium: boolean;
  intensity: 'low' | 'medium' | 'high';
  color: string;
  effects: string[];
}

const aiStyles: AIStyle[] = [
  // Dynamic styles
  { id: 'dynamics', name: 'Dynamics', icon: <Zap className="w-5 h-5" />, description: 'High-energy cuts synced to beat', category: 'dynamic', isPremium: false, intensity: 'high', color: 'from-orange-500 to-red-500', effects: ['Speed ramps', 'Beat sync', 'Flash transitions'] },
  { id: 'sports', name: 'Sports', icon: <Medal className="w-5 h-5" />, description: 'Action replays & slow-mo highlights', category: 'dynamic', isPremium: false, intensity: 'high', color: 'from-blue-500 to-cyan-500', effects: ['Slow motion', 'Freeze frames', 'Score overlays'] },
  { id: 'action', name: 'Action', icon: <Flame className="w-5 h-5" />, description: 'Explosive effects & quick cuts', category: 'dynamic', isPremium: false, intensity: 'high', color: 'from-red-600 to-orange-500', effects: ['Shake effects', 'Fast cuts', 'Impact flashes'] },
  { id: 'skippy', name: 'Skippy', icon: <Play className="w-5 h-5" />, description: 'Jump cuts & snappy rhythm', category: 'dynamic', isPremium: false, intensity: 'medium', color: 'from-purple-500 to-pink-500', effects: ['Jump cuts', 'Speed variations', 'Rhythmic pauses'] },
  { id: 'hype', name: 'Hype', icon: <PartyPopper className="w-5 h-5" />, description: 'Festival vibes with strobe effects', category: 'dynamic', isPremium: true, intensity: 'high', color: 'from-yellow-400 to-pink-500', effects: ['Strobe', 'Color pulses', 'Party overlays'] },
  
  // Emotional styles
  { id: 'romantic', name: 'Romantic', icon: <Heart className="w-5 h-5" />, description: 'Soft transitions & warm tones', category: 'emotional', isPremium: false, intensity: 'low', color: 'from-pink-400 to-rose-500', effects: ['Soft blur', 'Warm grades', 'Gentle fades'] },
  { id: 'spiritual', name: 'Spiritual', icon: <Sun className="w-5 h-5" />, description: 'Ethereal glows & peaceful pacing', category: 'emotional', isPremium: false, intensity: 'low', color: 'from-amber-400 to-yellow-300', effects: ['Light leaks', 'Soft glows', 'Meditative pace'] },
  { id: 'melancholy', name: 'Melancholy', icon: <Droplets className="w-5 h-5" />, description: 'Moody blues & reflective moments', category: 'emotional', isPremium: false, intensity: 'low', color: 'from-blue-600 to-indigo-700', effects: ['Desaturated', 'Rain overlays', 'Slow dissolves'] },
  { id: 'dreamy', name: 'Dreamy', icon: <Moon className="w-5 h-5" />, description: 'Soft focus & floating transitions', category: 'emotional', isPremium: true, intensity: 'low', color: 'from-violet-400 to-purple-500', effects: ['Gaussian blur', 'Floating motion', 'Soft vignette'] },
  { id: 'nostalgic', name: 'Nostalgic', icon: <Film className="w-5 h-5" />, description: 'Vintage film grain & warm sepia', category: 'emotional', isPremium: true, intensity: 'medium', color: 'from-amber-600 to-orange-700', effects: ['Film grain', 'Sepia tones', 'Scratches'] },
  
  // Cinematic styles
  { id: 'movie', name: 'Movie', icon: <Clapperboard className="w-5 h-5" />, description: 'Hollywood-grade color & letterbox', category: 'cinematic', isPremium: false, intensity: 'medium', color: 'from-slate-600 to-zinc-800', effects: ['Letterboxing', 'Teal & orange', 'Cinematic LUT'] },
  { id: 'epic', name: 'Epic', icon: <Mountain className="w-5 h-5" />, description: 'Grand scale with dramatic timing', category: 'cinematic', isPremium: true, intensity: 'high', color: 'from-indigo-600 to-blue-800', effects: ['Slow builds', 'Epic scoring', 'Wide shots focus'] },
  { id: 'thriller', name: 'Thriller', icon: <Ghost className="w-5 h-5" />, description: 'Suspenseful pacing & dark tones', category: 'cinematic', isPremium: true, intensity: 'medium', color: 'from-gray-700 to-slate-900', effects: ['Jump scares', 'Dark grading', 'Tension builds'] },
  { id: 'noir', name: 'Film Noir', icon: <Moon className="w-5 h-5" />, description: 'High contrast black & white drama', category: 'cinematic', isPremium: true, intensity: 'medium', color: 'from-gray-400 to-gray-800', effects: ['B&W contrast', 'Hard shadows', 'Classic wipes'] },
  { id: 'documentary', name: 'Documentary', icon: <Film className="w-5 h-5" />, description: 'Natural cuts & storytelling focus', category: 'cinematic', isPremium: false, intensity: 'low', color: 'from-emerald-600 to-teal-700', effects: ['Clean cuts', 'Ken Burns', 'Lower thirds'] },
  
  // Special styles
  { id: 'comedy', name: 'Comedy', icon: <Laugh className="w-5 h-5" />, description: 'Punchy timing & sound effects', category: 'special', isPremium: false, intensity: 'medium', color: 'from-yellow-400 to-orange-400', effects: ['Comic timing', 'Sound FX', 'Zoom punches'] },
  { id: 'horror', name: 'Horror', icon: <Skull className="w-5 h-5" />, description: 'Creepy effects & dark atmosphere', category: 'special', isPremium: true, intensity: 'high', color: 'from-red-800 to-gray-900', effects: ['Glitch horror', 'Dark vignette', 'Distortion'] },
  { id: 'music-video', name: 'Music Video', icon: <Music className="w-5 h-5" />, description: 'Beat-matched cuts & visual FX', category: 'special', isPremium: false, intensity: 'high', color: 'from-fuchsia-500 to-violet-600', effects: ['Beat sync', 'Visual FX', 'Color flashes'] },
  { id: 'vlog', name: 'Vlog', icon: <Star className="w-5 h-5" />, description: 'Clean & engaging YouTube style', category: 'special', isPremium: false, intensity: 'medium', color: 'from-red-500 to-pink-500', effects: ['Zoom cuts', 'Pop-up text', 'B-roll inserts'] },
  { id: 'aesthetic', name: 'Aesthetic', icon: <Sparkles className="w-5 h-5" />, description: 'Trendy color grades & soft vibes', category: 'special', isPremium: true, intensity: 'low', color: 'from-pink-400 to-blue-400', effects: ['Pastel grades', 'Soft bloom', 'Grain texture'] },
];

interface AIVideoEditorProps {
  isPremium?: boolean;
  onStyleSelect: (style: AIStyle | null) => void;
  onApplyAI: (style: AIStyle, options: AIEditOptions) => Promise<void>;
  selectedStyleId: string | null;
}

export interface AIEditOptions {
  intensity: number;
  musicSync: boolean;
  autoTrim: boolean;
  enhanceColor: boolean;
  stabilize: boolean;
}

export const AIVideoEditor: React.FC<AIVideoEditorProps> = ({
  onStyleSelect,
  onApplyAI,
  selectedStyleId,
}) => {
  const isPremium = true; // All features unlocked
  const [activeCategory, setActiveCategory] = useState<AIStyle['category']>('dynamic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editOptions, setEditOptions] = useState<AIEditOptions>({
    intensity: 75,
    musicSync: true,
    autoTrim: true,
    enhanceColor: true,
    stabilize: false,
  });

  const categories: { id: AIStyle['category']; label: string; icon: React.ReactNode }[] = [
    { id: 'dynamic', label: 'Dynamic', icon: <Zap className="w-4 h-4" /> },
    { id: 'emotional', label: 'Emotional', icon: <Heart className="w-4 h-4" /> },
    { id: 'cinematic', label: 'Cinematic', icon: <Clapperboard className="w-4 h-4" /> },
    { id: 'special', label: 'Special', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const filteredStyles = aiStyles.filter(s => s.category === activeCategory);
  const selectedStyle = aiStyles.find(s => s.id === selectedStyleId);

  const handleSelectStyle = (style: AIStyle) => {
    onStyleSelect(selectedStyleId === style.id ? null : style);
  };

  const handleApply = async () => {
    if (!selectedStyle) {
      toast.error('Select an AI style first');
      return;
    }
    setIsProcessing(true);
    try {
      await onApplyAI(selectedStyle, editOptions);
      toast.success(`${selectedStyle.name} style applied!`, {
        description: `Applied ${selectedStyle.effects.length} effects to your video.`
      });
    } catch (error) {
      toast.error('Failed to apply AI edit');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all text-sm font-medium',
              activeCategory === cat.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {cat.icon}
            <span className="hidden sm:inline">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Styles grid */}
      <div className="grid grid-cols-2 gap-2">
        {filteredStyles.map((style) => (
          <button
            key={style.id}
            onClick={() => handleSelectStyle(style)}
            className={cn(
              'relative p-3 rounded-xl text-left transition-all overflow-hidden',
              'hover:scale-[1.02] active:scale-[0.98]',
              selectedStyleId === style.id
                ? 'ring-2 ring-primary shadow-lg'
                : 'ring-1 ring-border/50 hover:ring-border',
              false
            )}
          >
            {/* Background gradient */}
            <div 
              className={cn('absolute inset-0 opacity-20 bg-gradient-to-br', style.color)}
            />
            
            {/* Content */}
            <div className="relative">
              <div className="flex items-start justify-between mb-2">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br',
                  style.color
                )}>
                  <span className="text-white">{style.icon}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  {selectedStyleId === style.id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
              
              <h4 className="font-semibold text-sm mb-1">{style.name}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {style.description}
              </p>
              
              {/* Effects preview */}
              <div className="flex flex-wrap gap-1">
                {style.effects.slice(0, 2).map((effect, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {effect}
                  </Badge>
                ))}
                {style.effects.length > 2 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    +{style.effects.length - 2}
                  </Badge>
                )}
              </div>
              
              {/* Intensity indicator */}
              <div className="mt-2 flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Intensity:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        'w-2 h-2 rounded-full',
                        level <= (style.intensity === 'low' ? 1 : style.intensity === 'medium' ? 2 : 3)
                          ? 'bg-primary'
                          : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected style options */}
      {selectedStyle && (
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br',
              selectedStyle.color
            )}>
              <span className="text-white">{selectedStyle.icon}</span>
            </div>
            <div>
              <h4 className="font-semibold">{selectedStyle.name} Style</h4>
              <p className="text-sm text-muted-foreground">{selectedStyle.description}</p>
            </div>
          </div>

          {/* AI Options */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'musicSync', label: 'Sync to Music' },
              { key: 'autoTrim', label: 'Auto Trim' },
              { key: 'enhanceColor', label: 'Enhance Color' },
              { key: 'stabilize', label: 'Stabilize' },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setEditOptions(prev => ({
                  ...prev,
                  [option.key]: !prev[option.key as keyof AIEditOptions]
                }))}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg text-sm transition-all',
                  editOptions[option.key as keyof AIEditOptions]
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/50 text-muted-foreground border border-transparent'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center',
                  editOptions[option.key as keyof AIEditOptions]
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground'
                )}>
                  {editOptions[option.key as keyof AIEditOptions] && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                {option.label}
              </button>
            ))}
          </div>

          {/* Effects preview */}
          <div>
            <span className="text-xs text-muted-foreground mb-2 block">Effects to be applied:</span>
            <div className="flex flex-wrap gap-1">
              {selectedStyle.effects.map((effect, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {effect}
                </Badge>
              ))}
            </div>
          </div>

          {/* Apply button */}
          <Button 
            className={cn('w-full bg-gradient-to-r', selectedStyle.color)}
            onClick={handleApply}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Apply {selectedStyle.name} AI Edit
              </>
            )}
          </Button>
        </div>
      )}

      {/* All styles button */}
      <Button variant="ghost" size="sm" className="w-full">
        View All {aiStyles.length} AI Styles
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
};

export { aiStyles };
