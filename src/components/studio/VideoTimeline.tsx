import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Scissors, Play, Pause, ChevronLeft, ChevronRight, Trash2, Copy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface TrimClip {
  id: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

export interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onTrimChange?: (clips: TrimClip[]) => void;
  highlights?: { startTime: number; endTime: number; id: string; selected: boolean }[];
}

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPause,
  onTrimChange,
  highlights = [],
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'playhead' | 'trimStart' | 'trimEnd' | 'clip' | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [clips, setClips] = useState<TrimClip[]>([
    { id: 'main', startTime: 0, endTime: duration, isActive: true }
  ]);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (duration > 0) {
      setClips([{ id: 'main', startTime: 0, endTime: duration, isActive: true }]);
    }
  }, [duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getTimeFromPosition = useCallback((clientX: number) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  }, [duration]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    const newTime = getTimeFromPosition(e.clientX);
    onTimeChange(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'playhead' | 'trimStart' | 'trimEnd' | 'clip', clipId?: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    if (clipId) setActiveClipId(clipId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;
    
    const newTime = getTimeFromPosition(e.clientX);
    
    if (dragType === 'playhead') {
      onTimeChange(newTime);
    } else if (dragType === 'trimStart' && activeClipId) {
      setClips(prev => prev.map(clip => 
        clip.id === activeClipId 
          ? { ...clip, startTime: Math.max(0, Math.min(newTime, clip.endTime - 0.5)) }
          : clip
      ));
    } else if (dragType === 'trimEnd' && activeClipId) {
      setClips(prev => prev.map(clip => 
        clip.id === activeClipId 
          ? { ...clip, endTime: Math.min(duration, Math.max(newTime, clip.startTime + 0.5)) }
          : clip
      ));
    }
  }, [isDragging, dragType, activeClipId, duration, getTimeFromPosition, onTimeChange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && onTrimChange) {
      onTrimChange(clips);
    }
    setIsDragging(false);
    setDragType(null);
  }, [isDragging, clips, onTrimChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleSplitAtPlayhead = () => {
    const activeClip = clips.find(c => c.isActive);
    if (!activeClip || currentTime <= activeClip.startTime || currentTime >= activeClip.endTime) {
      toast.error('Place playhead within clip to split');
      return;
    }

    const newClips: TrimClip[] = clips.flatMap(clip => {
      if (clip.id === activeClip.id) {
        return [
          { ...clip, endTime: currentTime, id: clip.id },
          { id: `clip-${Date.now()}`, startTime: currentTime, endTime: clip.endTime, isActive: false }
        ];
      }
      return [clip];
    });

    setClips(newClips);
    onTrimChange?.(newClips);
    toast.success('Clip split at playhead');
  };

  const handleDeleteClip = (clipId: string) => {
    if (clips.length <= 1) {
      toast.error('Cannot delete last clip');
      return;
    }
    const newClips = clips.filter(c => c.id !== clipId);
    if (!newClips.some(c => c.isActive) && newClips.length > 0) {
      newClips[0].isActive = true;
    }
    setClips(newClips);
    onTrimChange?.(newClips);
    toast.success('Clip deleted');
  };

  const handleDuplicateClip = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    const newClip: TrimClip = {
      id: `clip-${Date.now()}`,
      startTime: clip.startTime,
      endTime: clip.endTime,
      isActive: false
    };
    
    setClips([...clips, newClip]);
    toast.success('Clip duplicated');
  };

  const selectClip = (clipId: string) => {
    setClips(prev => prev.map(c => ({ ...c, isActive: c.id === clipId })));
  };

  const frameStep = (direction: -1 | 1) => {
    const frameTime = 1 / 30; // Assume 30fps
    const newTime = Math.max(0, Math.min(duration, currentTime + (frameTime * direction)));
    onTimeChange(newTime);
  };

  return (
    <div className="space-y-3 select-none">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => frameStep(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPlayPause}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => frameStep(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-sm font-mono text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSplitAtPlayhead}>
            <Scissors className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => {
              const active = clips.find(c => c.isActive);
              if (active) handleDuplicateClip(active.id);
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive"
            onClick={() => {
              const active = clips.find(c => c.isActive);
              if (active) handleDeleteClip(active.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline ruler */}
      <div className="relative h-6 bg-muted/30 rounded-t-lg overflow-hidden">
        {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${(i / duration) * 100}%` }}
          >
            <div className="w-px h-3 bg-muted-foreground/40" />
            {i % 5 === 0 && (
              <span className="text-[8px] text-muted-foreground mt-0.5">{i}s</span>
            )}
          </div>
        ))}
      </div>

      {/* Main timeline with clips */}
      <div 
        ref={timelineRef}
        className="relative h-16 bg-muted/20 rounded-lg cursor-pointer overflow-hidden"
        onClick={handleTimelineClick}
      >
        {/* Waveform background simulation */}
        <div className="absolute inset-0 flex items-center gap-0.5 px-1 opacity-30">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-primary rounded-full"
              style={{ height: `${20 + Math.random() * 60}%` }}
            />
          ))}
        </div>

        {/* Clips */}
        {clips.map((clip) => (
          <div
            key={clip.id}
            className={cn(
              'absolute top-1 bottom-1 rounded-lg border-2 transition-colors cursor-pointer',
              clip.isActive 
                ? 'bg-primary/30 border-primary' 
                : 'bg-muted/50 border-muted-foreground/30 hover:border-primary/50'
            )}
            style={{
              left: `${(clip.startTime / duration) * 100}%`,
              width: `${((clip.endTime - clip.startTime) / duration) * 100}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectClip(clip.id);
            }}
          >
            {/* Trim handles */}
            <div
              className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-primary/50 rounded-l-md hover:bg-primary/80 flex items-center justify-center"
              onMouseDown={(e) => handleMouseDown(e, 'trimStart', clip.id)}
            >
              <div className="w-0.5 h-4 bg-white rounded-full" />
            </div>
            <div
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-primary/50 rounded-r-md hover:bg-primary/80 flex items-center justify-center"
              onMouseDown={(e) => handleMouseDown(e, 'trimEnd', clip.id)}
            >
              <div className="w-0.5 h-4 bg-white rounded-full" />
            </div>

            {/* Clip info */}
            <div className="absolute inset-x-4 inset-y-0 flex items-center justify-center pointer-events-none">
              <span className="text-[10px] font-medium text-foreground/80">
                {formatTime(clip.endTime - clip.startTime)}
              </span>
            </div>
          </div>
        ))}

        {/* AI Highlights overlay */}
        {highlights.map((h) => (
          <div
            key={h.id}
            className={cn(
              'absolute top-0 bottom-0 pointer-events-none',
              h.selected ? 'bg-green-500/20' : 'bg-amber-500/15'
            )}
            style={{
              left: `${(h.startTime / duration) * 100}%`,
              width: `${((h.endTime - h.startTime) / duration) * 100}%`,
            }}
          >
            <div className={cn(
              'absolute top-0 left-0 right-0 h-1',
              h.selected ? 'bg-green-500' : 'bg-amber-500'
            )} />
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 cursor-ew-resize"
          style={{ left: `${(currentTime / duration) * 100}%` }}
          onMouseDown={(e) => handleMouseDown(e, 'playhead')}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow" />
        </div>
      </div>

      {/* Clip strip with thumbnails simulation */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {clips.map((clip, index) => (
          <button
            key={clip.id}
            onClick={() => selectClip(clip.id)}
            className={cn(
              'flex-shrink-0 w-20 h-12 rounded-lg overflow-hidden transition-all relative',
              clip.isActive 
                ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' 
                : 'opacity-60 hover:opacity-100'
            )}
          >
            <div 
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, hsl(${(index * 60) % 360}, 70%, 40%) 0%, hsl(${(index * 60 + 60) % 360}, 70%, 30%) 100%)`
              }}
            />
            <span className="absolute bottom-0.5 left-1 text-[8px] text-white font-medium">
              Clip {index + 1}
            </span>
          </button>
        ))}
        <button className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors">
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};
