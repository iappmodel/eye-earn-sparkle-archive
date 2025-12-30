import React, { useState } from 'react';
import { 
  Eye, EyeOff, Volume2, VolumeX, Lock, Unlock,
  Layers, Grid3X3, Scan, Contrast, Moon, Sun,
  Square, Circle, Sparkles, Wand2, Plus, Trash2, GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface BlurSegment {
  id: string;
  startTime: number;
  endTime: number;
  blurType: BlurType;
  blurIntensity: number; // 0-100
  videoHidden: boolean;
  audioMuted: boolean;
  cafEnabled: boolean;
  cafConfig?: CAFConfig;
}

export type BlurType = 
  | 'glass' 
  | 'mosaic' 
  | 'xray' 
  | 'outlines' 
  | 'negative' 
  | 'shadow' 
  | 'whitening' 
  | 'blackwhite'
  | 'pixelate'
  | 'frosted'
  | 'gaussian';

export interface CAFConfig {
  type: 'payment' | 'follow' | 'comment' | 'share' | 'like' | 'subscribe' | 'custom';
  amount?: number; // For payment type (vicoins)
  customAction?: string;
  buttonText: string;
  description: string;
}

interface MediaBlurEditorProps {
  duration: number;
  currentTime: number;
  segments: BlurSegment[];
  onSegmentsChange: (segments: BlurSegment[]) => void;
  onTimeChange: (time: number) => void;
}

const blurTypes: { id: BlurType; name: string; icon: React.ReactNode; preview: string }[] = [
  { id: 'glass', name: 'Glass', icon: <Layers className="w-4 h-4" />, preview: 'blur(12px)' },
  { id: 'mosaic', name: 'Mosaic', icon: <Grid3X3 className="w-4 h-4" />, preview: 'blur(0px)' },
  { id: 'xray', name: 'X-Ray', icon: <Scan className="w-4 h-4" />, preview: 'invert(1)' },
  { id: 'outlines', name: 'Outlines', icon: <Square className="w-4 h-4" />, preview: 'contrast(3) brightness(1.5)' },
  { id: 'negative', name: 'Negative', icon: <Contrast className="w-4 h-4" />, preview: 'invert(1) hue-rotate(180deg)' },
  { id: 'shadow', name: 'Shadow', icon: <Moon className="w-4 h-4" />, preview: 'brightness(0.2)' },
  { id: 'whitening', name: 'Whitening', icon: <Sun className="w-4 h-4" />, preview: 'brightness(2) contrast(0.5)' },
  { id: 'blackwhite', name: 'B&W', icon: <Circle className="w-4 h-4" />, preview: 'grayscale(1) blur(8px)' },
  { id: 'pixelate', name: 'Pixelate', icon: <Grid3X3 className="w-4 h-4" />, preview: 'blur(0px)' },
  { id: 'frosted', name: 'Frosted', icon: <Sparkles className="w-4 h-4" />, preview: 'blur(20px) saturate(1.5)' },
  { id: 'gaussian', name: 'Gaussian', icon: <Wand2 className="w-4 h-4" />, preview: 'blur(25px)' },
];

export const MediaBlurEditor: React.FC<MediaBlurEditorProps> = ({
  duration,
  currentTime,
  segments,
  onSegmentsChange,
  onTimeChange,
}) => {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'segments' | 'blurtype' | 'audio'>('segments');

  const selectedSegment = segments.find(s => s.id === selectedSegmentId);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addSegment = () => {
    const newSegment: BlurSegment = {
      id: Date.now().toString(),
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
      blurType: 'glass',
      blurIntensity: 80,
      videoHidden: false,
      audioMuted: false,
      cafEnabled: false,
    };
    onSegmentsChange([...segments, newSegment]);
    setSelectedSegmentId(newSegment.id);
  };

  const updateSegment = (id: string, updates: Partial<BlurSegment>) => {
    onSegmentsChange(
      segments.map(s => s.id === id ? { ...s, ...updates } : s)
    );
  };

  const deleteSegment = (id: string) => {
    onSegmentsChange(segments.filter(s => s.id !== id));
    if (selectedSegmentId === id) {
      setSelectedSegmentId(null);
    }
  };

  const getBlurPreviewStyle = (segment: BlurSegment): React.CSSProperties => {
    const blurDef = blurTypes.find(b => b.id === segment.blurType);
    const intensity = segment.blurIntensity / 100;
    
    if (segment.blurType === 'mosaic' || segment.blurType === 'pixelate') {
      return {
        filter: `blur(${2 * intensity}px)`,
        imageRendering: 'pixelated' as const,
      };
    }
    
    if (segment.blurType === 'glass') {
      return { filter: `blur(${12 * intensity}px)` };
    }
    
    if (segment.blurType === 'gaussian') {
      return { filter: `blur(${25 * intensity}px)` };
    }
    
    if (segment.blurType === 'frosted') {
      return { filter: `blur(${20 * intensity}px) saturate(${1 + 0.5 * intensity})` };
    }
    
    if (segment.blurType === 'shadow') {
      return { filter: `brightness(${1 - 0.8 * intensity})` };
    }
    
    if (segment.blurType === 'whitening') {
      return { filter: `brightness(${1 + intensity}) contrast(${1 - 0.5 * intensity})` };
    }
    
    return { filter: blurDef?.preview || 'blur(10px)' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          Media Blur & CAF Editor
        </h3>
        <Button size="sm" onClick={addSegment} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add Blur Segment
        </Button>
      </div>

      {/* Timeline with blur segments */}
      <div className="relative h-16 bg-muted/50 rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex items-center px-2">
          {/* Timeline ruler */}
          <div className="absolute inset-x-0 top-0 h-4 flex">
            {Array.from({ length: Math.ceil(duration / 5) + 1 }).map((_, i) => (
              <div 
                key={i} 
                className="flex-1 border-l border-border/50 text-[10px] text-muted-foreground pl-1"
              >
                {formatTime(i * 5)}
              </div>
            ))}
          </div>
          
          {/* Blur segments on timeline */}
          {segments.map((segment) => {
            const left = (segment.startTime / duration) * 100;
            const width = ((segment.endTime - segment.startTime) / duration) * 100;
            
            return (
              <div
                key={segment.id}
                onClick={() => setSelectedSegmentId(segment.id)}
                className={cn(
                  'absolute top-5 h-10 rounded-md cursor-pointer transition-all',
                  'border-2 flex items-center justify-center gap-1',
                  selectedSegmentId === segment.id
                    ? 'border-primary bg-primary/30 z-10'
                    : 'border-muted-foreground/50 bg-muted-foreground/20 hover:bg-muted-foreground/30'
                )}
                style={{ left: `${left}%`, width: `${width}%`, minWidth: '30px' }}
              >
                {segment.videoHidden && <EyeOff className="w-3 h-3" />}
                {segment.audioMuted && <VolumeX className="w-3 h-3" />}
                {segment.cafEnabled && <Lock className="w-3 h-3 text-amber-400" />}
              </div>
            );
          })}
          
          {/* Playhead */}
          <div 
            className="absolute top-4 bottom-0 w-0.5 bg-primary z-20"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full" />
          </div>
        </div>
      </div>

      {/* Segment list */}
      {segments.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              onClick={() => setSelectedSegmentId(segment.id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all',
                selectedSegmentId === segment.id
                  ? 'bg-primary/20 border border-primary/50'
                  : 'bg-muted/50 hover:bg-muted/80'
              )}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>Segment {index + 1}</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatTime(segment.startTime)} - {formatTime(segment.endTime)})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{segment.blurType}</span>
                  <span>•</span>
                  <span>{segment.blurIntensity}%</span>
                  {segment.cafEnabled && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> CAF
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSegment(segment.id);
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Selected segment editor */}
      {selectedSegment && (
        <div className="border border-border rounded-xl p-4 space-y-4 bg-card">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="segments">Timing</TabsTrigger>
              <TabsTrigger value="blurtype">Blur Type</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
            </TabsList>

            <TabsContent value="segments" className="space-y-4 mt-4">
              {/* Timing controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Time</label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selectedSegment.startTime]}
                      onValueChange={([v]) => updateSegment(selectedSegment.id, { startTime: v })}
                      max={selectedSegment.endTime - 0.5}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">{formatTime(selectedSegment.startTime)}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">End Time</label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selectedSegment.endTime]}
                      onValueChange={([v]) => updateSegment(selectedSegment.id, { endTime: v })}
                      min={selectedSegment.startTime + 0.5}
                      max={duration}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">{formatTime(selectedSegment.endTime)}</span>
                  </div>
                </div>
              </div>

              {/* Blur intensity */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Blur Intensity: {selectedSegment.blurIntensity}%
                </label>
                <Slider
                  value={[selectedSegment.blurIntensity]}
                  onValueChange={([v]) => updateSegment(selectedSegment.id, { blurIntensity: v })}
                  max={100}
                  step={5}
                />
              </div>

              {/* Video/Audio toggles */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={selectedSegment.videoHidden}
                    onCheckedChange={(v) => updateSegment(selectedSegment.id, { videoHidden: v })}
                  />
                  <label className="text-sm flex items-center gap-1.5">
                    {selectedSegment.videoHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    Video Hidden
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={selectedSegment.audioMuted}
                    onCheckedChange={(v) => updateSegment(selectedSegment.id, { audioMuted: v })}
                  />
                  <label className="text-sm flex items-center gap-1.5">
                    {selectedSegment.audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    Audio Muted
                  </label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="blurtype" className="mt-4">
              <div className="grid grid-cols-4 gap-2">
                {blurTypes.map((blur) => (
                  <button
                    key={blur.id}
                    onClick={() => updateSegment(selectedSegment.id, { blurType: blur.id })}
                    className={cn(
                      'relative aspect-square rounded-xl overflow-hidden transition-all',
                      'hover:scale-105 active:scale-95 border-2',
                      selectedSegment.blurType === blur.id
                        ? 'border-primary'
                        : 'border-transparent'
                    )}
                  >
                    <div 
                      className="absolute inset-0 bg-gradient-to-br from-primary/40 to-secondary/40"
                      style={{ filter: blur.preview }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {blur.icon}
                      <span className="text-[10px] mt-1 font-medium">{blur.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <div 
                  className="h-24 rounded-lg bg-gradient-to-br from-primary/60 to-secondary/60 flex items-center justify-center"
                  style={getBlurPreviewStyle(selectedSegment)}
                >
                  <span className="text-white text-sm font-medium">
                    Blurred Content
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audio" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <VolumeX className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium">Mute Audio</p>
                      <p className="text-xs text-muted-foreground">
                        Completely silence audio in this segment
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedSegment.audioMuted}
                    onCheckedChange={(v) => updateSegment(selectedSegment.id, { audioMuted: v })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium">Audio-Only Mode</p>
                      <p className="text-xs text-muted-foreground">
                        Hide video but keep audio playing
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedSegment.videoHidden && !selectedSegment.audioMuted}
                    onCheckedChange={(v) => {
                      if (v) {
                        updateSegment(selectedSegment.id, { videoHidden: true, audioMuted: false });
                      } else {
                        updateSegment(selectedSegment.id, { videoHidden: false });
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <EyeOff className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium">Fully Hidden</p>
                      <p className="text-xs text-muted-foreground">
                        Hide both video and audio
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedSegment.videoHidden && selectedSegment.audioMuted}
                    onCheckedChange={(v) => {
                      updateSegment(selectedSegment.id, { 
                        videoHidden: v, 
                        audioMuted: v 
                      });
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {segments.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <EyeOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No blur segments yet</p>
          <p className="text-sm">Click "Add Blur Segment" to create hidden or blurred sections</p>
        </div>
      )}
    </div>
  );
};

export default MediaBlurEditor;
