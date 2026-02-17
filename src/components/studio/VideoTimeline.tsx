import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Scissors, Play, Pause, ChevronLeft, ChevronRight, Trash2, Copy, Plus,
  ZoomIn, ZoomOut, Maximize2, Move, RotateCcw, RotateCw, GripVertical, Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const BASE_PIXELS_PER_SECOND = 60;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const SNAP_THRESHOLD_SEC = 0.08;
const DEFAULT_FPS = 30;
const MIN_CLIP_DURATION = 0.1;

export interface TrimClip {
  id: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  label?: string;
}

export interface InOutPoints {
  in: number;
  out: number;
}

export interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onTrimChange?: (clips: TrimClip[]) => void;
  onInOutChange?: (inOut: InOutPoints | null) => void;
  highlights?: { startTime: number; endTime: number; id: string; selected: boolean }[];
  /** Initial clips (e.g. from parent); if provided, timeline uses controlled-ish clips on first sync */
  initialClips?: TrimClip[] | null;
  /** Frames per second for frame stepping and snapping */
  fps?: number;
  /** Minimum duration of a single clip in seconds */
  minClipDuration?: number;
  /** Video element for thumbnail strip (optional) */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Snap playhead and trim handles to frame boundaries */
  snapToFrames?: boolean;
  /** Show in/out point markers and allow setting them */
  showInOutPoints?: boolean;
  /** When true, playback loops within in/out or selected clip */
  loopInOutOrClip?: boolean;
  /** When deleting a clip, shift following clips to close the gap */
  rippleDelete?: boolean;
  /** Enable keyboard shortcuts */
  keyboardShortcuts?: boolean;
  /** Callback when internal undo stack is used (parent can sync) */
  onUndoRedo?: (clips: TrimClip[]) => void;
  /** AI-detected scene break times in seconds (shown as vertical markers) */
  sceneBreaks?: number[];
}

function formatTime(seconds: number, showFrames = false, fps = DEFAULT_FPS): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  const frames = showFrames ? Math.floor((seconds % 1) * fps) : null;
  if (frames !== null) {
    return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPause,
  onTrimChange,
  onInOutChange,
  highlights = [],
  initialClips,
  fps = DEFAULT_FPS,
  minClipDuration = MIN_CLIP_DURATION,
  videoRef,
  snapToFrames = true,
  showInOutPoints = true,
  loopInOutOrClip = true,
  rippleDelete = false,
  keyboardShortcuts = true,
  onUndoRedo,
  sceneBreaks = [],
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollTime, setScrollTime] = useState(0);
  const [clips, setClips] = useState<TrimClip[]>(() =>
    initialClips?.length ? initialClips : [{ id: 'main', startTime: 0, endTime: duration, isActive: true }]
  );
  const [inOut, setInOut] = useState<InOutPoints | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'playhead' | 'trimStart' | 'trimEnd' | 'clip' | 'in' | 'out' | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(snapToFrames);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [clipHistory, setClipHistory] = useState<TrimClip[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const dragClipsRef = useRef<TrimClip[] | null>(null);

  const frameTime = 1 / fps;
  const visibleDuration = duration / zoom;
  const trackWidthPx = duration * BASE_PIXELS_PER_SECOND * zoom;
  const maxScrollTime = Math.max(0, duration - visibleDuration);

  // Sync clips when duration or initialClips change; seed undo history
  useEffect(() => {
    if (duration <= 0) return;
    const next = initialClips?.length
      ? initialClips.map(c => ({ ...c, endTime: Math.min(c.endTime, duration), startTime: Math.max(0, c.startTime) }))
      : [{ id: 'main', startTime: 0, endTime: duration, isActive: true }];
    setClips(next);
    setClipHistory([next.map(c => ({ ...c }))]);
    setHistoryIndex(0);
  }, [duration, initialClips?.length]);

  /** Push "after" state so undo/redo work. Call after applying an action. */
  const pushHistoryAfterAction = useCallback((afterClips: TrimClip[]) => {
    const snapshot = afterClips.map(c => ({ ...c }));
    setClipHistory(prev => [...prev.slice(0, historyIndex + 1), snapshot].slice(-50));
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = clipHistory[historyIndex - 1];
    if (prev) {
      setClips(prev);
      setHistoryIndex(historyIndex - 1);
      onTrimChange?.(prev);
      onUndoRedo?.(prev);
      toast.success('Undo');
    }
  }, [historyIndex, clipHistory, onTrimChange, onUndoRedo]);

  const redo = useCallback(() => {
    if (historyIndex >= clipHistory.length - 1) return;
    const next = clipHistory[historyIndex + 1];
    if (next) {
      setClips(next);
      setHistoryIndex(historyIndex + 1);
      onTrimChange?.(next);
      onUndoRedo?.(next);
      toast.success('Redo');
    }
  }, [historyIndex, clipHistory, onTrimChange, onUndoRedo]);

  const snap = useCallback((t: number): number => {
    if (!snapEnabled) return t;
    const frame = Math.round(t / frameTime) * frameTime;
    if (Math.abs(t - frame) < SNAP_THRESHOLD_SEC) return frame;
    for (const clip of clips) {
      for (const edge of [clip.startTime, clip.endTime]) {
        if (Math.abs(t - edge) < SNAP_THRESHOLD_SEC) return edge;
      }
    }
    if (inOut && Math.abs(t - inOut.in) < SNAP_THRESHOLD_SEC) return inOut.in;
    if (inOut && Math.abs(t - inOut.out) < SNAP_THRESHOLD_SEC) return inOut.out;
    return frame;
  }, [snapEnabled, frameTime, clips, inOut]);

  const getTimeFromPosition = useCallback((clientX: number) => {
    const scrollEl = scrollRef.current;
    const trackEl = timelineRef.current;
    if (!scrollEl || !trackEl) return 0;
    const scrollRect = scrollEl.getBoundingClientRect();
    const x = clientX - scrollRect.left + scrollEl.scrollLeft;
    const time = (x / trackWidthPx) * duration;
    return Math.max(0, Math.min(duration, time));
  }, [duration, trackWidthPx]);

  const syncScrollFromElement = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const time = (el.scrollLeft / trackWidthPx) * duration;
    setScrollTime(Math.max(0, Math.min(maxScrollTime, time)));
  }, [duration, trackWidthPx, maxScrollTime]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => syncScrollFromElement();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [syncScrollFromElement]);

  // Keep scroll position in sync when zoom changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetScroll = (scrollTime / duration) * trackWidthPx;
    if (Math.abs(el.scrollLeft - targetScroll) > 2) {
      el.scrollLeft = targetScroll;
    }
  }, [zoom, scrollTime, duration, trackWidthPx]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcuts) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input') || target.closest('textarea') || target.isContentEditable) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          onTimeChange(Math.max(0, currentTime - (e.repeat ? 0.5 : 2)));
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          if (isPlaying) onPlayPause();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          onTimeChange(Math.min(duration, currentTime + (e.repeat ? 0.5 : 2)));
          break;
        case 'i':
          e.preventDefault();
          if (showInOutPoints) {
            const t = snap(currentTime);
            setInOut(prev => ({ in: t, out: prev?.out ?? duration }));
            onInOutChange?.({ in: t, out: (inOut?.out ?? duration) });
            toast.success(`In point: ${formatTime(t)}`);
          }
          break;
        case 'o':
          e.preventDefault();
          if (showInOutPoints) {
            const t = snap(currentTime);
            setInOut(prev => ({ in: prev?.in ?? 0, out: t }));
            onInOutChange?.({ in: (inOut?.in ?? 0), out: t });
            toast.success(`Out point: ${formatTime(t)}`);
          }
          break;
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleSplitAtPlayhead();
          }
          break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          const active = clips.find(c => c.isActive);
          if (active) handleDeleteClip(active.id);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          frameStep(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          frameStep(1);
          break;
        case 'Home':
          e.preventDefault();
          onTimeChange(0);
          break;
        case 'End':
          e.preventDefault();
          onTimeChange(duration);
          break;
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
          }
          break;
        case 'y':
        case 'Y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            redo();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    keyboardShortcuts, currentTime, duration, isPlaying, clips, inOut, showInOutPoints,
    onPlayPause, onTimeChange, onInOutChange, snap, frameTime, undo, redo,
    handleSplitAtPlayhead, handleDeleteClip, frameStep,
  ]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    const time = snap(getTimeFromPosition(e.clientX));
    onTimeChange(time);
  };

  const handleMouseDown = (e: React.MouseEvent, type: typeof dragType, clipId?: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    if (clipId) setActiveClipId(clipId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const rawTime = getTimeFromPosition(e.clientX);
    const newTime = snap(rawTime);

    if (dragType === 'playhead') {
      onTimeChange(newTime);
    } else if (dragType === 'in' && showInOutPoints) {
      setInOut(prev => prev ? { ...prev, in: Math.max(0, Math.min(newTime, prev.out - frameTime)) } : { in: newTime, out: duration });
    } else if (dragType === 'out' && showInOutPoints) {
      setInOut(prev => prev ? { ...prev, out: Math.min(duration, Math.max(newTime, prev.in + frameTime)) } : { in: 0, out: newTime });
    } else if (dragType === 'trimStart' && activeClipId) {
      const updated = clips.map(clip =>
        clip.id === activeClipId
          ? { ...clip, startTime: Math.max(0, Math.min(newTime, clip.endTime - minClipDuration)) }
          : clip
      );
      dragClipsRef.current = updated;
      setClips(updated);
    } else if (dragType === 'trimEnd' && activeClipId) {
      const updated = clips.map(clip =>
        clip.id === activeClipId
          ? { ...clip, endTime: Math.min(duration, Math.max(newTime, clip.startTime + minClipDuration)) }
          : clip
      );
      dragClipsRef.current = updated;
      setClips(updated);
    } else if (dragType === 'clip' && activeClipId) {
      const clip = clips.find(c => c.id === activeClipId);
      if (!clip) return;
      const len = clip.endTime - clip.startTime;
      const delta = newTime - clip.startTime;
      let newStart = clip.startTime + delta;
      let newEnd = newStart + len;
      newStart = Math.max(0, newStart);
      newEnd = Math.min(duration, newEnd);
      if (newEnd - newStart < minClipDuration) return;
      newStart = newEnd - len;
      newStart = Math.max(0, newStart);
      newEnd = newStart + len;
      const updated = clips.map(c => c.id === activeClipId ? { ...c, startTime: newStart, endTime: newEnd } : c);
      dragClipsRef.current = updated;
      setClips(updated);
    }
  }, [isDragging, dragType, activeClipId, duration, getTimeFromPosition, snap, onTimeChange, showInOutPoints, frameTime, clips, minClipDuration]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && (dragType === 'trimStart' || dragType === 'trimEnd' || dragType === 'clip')) {
      const latest = dragClipsRef.current || clips;
      pushHistoryAfterAction(latest);
      onTrimChange?.(latest);
      dragClipsRef.current = null;
    }
    if (isDragging && (dragType === 'in' || dragType === 'out') && inOut) {
      onInOutChange?.(inOut);
    }
    setIsDragging(false);
    setDragType(null);
  }, [isDragging, dragType, clips, inOut, pushHistoryAfterAction, onTrimChange, onInOutChange]);

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
      toast.error('Place playhead inside a clip to split');
      return;
    }
    const t = snap(currentTime);
    const newClips: TrimClip[] = clips.flatMap(clip => {
      if (clip.id !== activeClip.id) return [clip];
      return [
        { ...clip, endTime: t, id: clip.id },
        { id: `clip-${Date.now()}`, startTime: t, endTime: clip.endTime, isActive: false },
      ];
    });
    setClips(newClips);
    pushHistoryAfterAction(newClips);
    onTrimChange?.(newClips);
    toast.success('Split at playhead');
  };

  const handleDeleteClip = (clipId: string) => {
    if (clips.length <= 1) {
      toast.error('Keep at least one clip');
      return;
    }
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    let newClips: TrimClip[];
    if (rippleDelete) {
      const gap = clip.endTime - clip.startTime;
      newClips = clips
        .filter(c => c.id !== clipId)
        .map(c => {
          if (c.startTime >= clip.endTime) {
            return { ...c, startTime: c.startTime - gap, endTime: c.endTime - gap };
          }
          if (c.endTime > clip.startTime && c.startTime < clip.endTime) {
            const newStart = c.startTime < clip.startTime ? c.startTime : clip.startTime;
            const newEnd = c.endTime > clip.endTime ? c.endTime - gap : c.endTime - (c.endTime - clip.startTime);
            return { ...c, startTime: newStart, endTime: Math.max(newStart + minClipDuration, newEnd) };
          }
          return c;
        });
    } else {
      newClips = clips.filter(c => c.id !== clipId);
      if (!newClips.some(c => c.isActive)) newClips[0].isActive = true;
    }
    setClips(newClips);
    pushHistoryAfterAction(newClips);
    onTrimChange?.(newClips);
    toast.success(rippleDelete ? 'Clip removed (ripple)' : 'Clip deleted');
  };

  const handleDuplicateClip = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    const newClip: TrimClip = {
      id: `clip-${Date.now()}`,
      startTime: clip.startTime,
      endTime: clip.endTime,
      isActive: false,
      label: clip.label ? `${clip.label} (copy)` : undefined,
    };
    const next = [...clips, newClip];
    setClips(next);
    pushHistoryAfterAction(next);
    onTrimChange?.(next);
    toast.success('Clip duplicated');
  };

  const selectClip = (clipId: string) => {
    setClips(prev => prev.map(c => ({ ...c, isActive: c.id === clipId })));
  };

  const frameStep = (direction: -1 | 1) => {
    const t = snap(Math.max(0, Math.min(duration, currentTime + frameTime * direction)));
    onTimeChange(t);
  };

  const zoomIn = () => setZoom(z => Math.min(MAX_ZOOM, z * 1.5));
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, z / 1.5));
  const zoomFit = () => {
    setZoom(1);
    setScrollTime(0);
  };
  const zoomToSelection = () => {
    const active = clips.find(c => c.isActive);
    if (!active) return;
    const len = active.endTime - active.startTime;
    if (len <= 0) return;
    const newZoom = duration / len;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom)));
    setScrollTime(active.startTime);
    scrollRef.current && (scrollRef.current.scrollLeft = (active.startTime / duration) * (duration * BASE_PIXELS_PER_SECOND * zoom));
  };

  // Thumbnails from video: seek to each clip start and capture on seeked (one at a time)
  const thumbIndexRef = useRef(0);
  useEffect(() => {
    if (!videoRef?.current || !duration || clips.length === 0) return;
    const video = videoRef.current;
    const clip = clips[thumbIndexRef.current];
    if (!clip || thumbnails[clip.id]) {
      thumbIndexRef.current = Math.min(thumbIndexRef.current + 1, clips.length - 1);
      return;
    }
    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnails(prev => ({ ...prev, [clip.id]: canvas.toDataURL('image/jpeg', 0.6) }));
        }
      } catch (_) {}
      thumbIndexRef.current = Math.min(thumbIndexRef.current + 1, clips.length - 1);
      video.removeEventListener('seeked', onSeeked);
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = clip.startTime;
    return () => video.removeEventListener('seeked', onSeeked);
  }, [videoRef?.current, duration, clips, thumbnails]);

  // Loop playback: when time reaches end of in/out or active clip, jump to start
  useEffect(() => {
    if (!loopInOutOrClip || !isPlaying) return;
    const active = clips.find(c => c.isActive);
    const end = inOut ? inOut.out : (active ? active.endTime : duration);
    const start = inOut ? inOut.in : (active ? active.startTime : 0);
    if (currentTime >= end - 0.05) {
      onTimeChange(start);
    }
  }, [currentTime, isPlaying, loopInOutOrClip, clips, inOut, duration, onTimeChange]);

  return (
    <div className="space-y-2 select-none">
      {/* Top bar: transport + time + zoom + tools */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => frameStep(-1)} title="Previous frame">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => frameStep(1)} title="Next frame">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-mono text-muted-foreground ml-1" title="Current / Duration">
            {formatTime(currentTime, true, fps)} / {formatTime(duration, true, fps)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showInOutPoints && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              I/O
            </span>
          )}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.25}
              className="w-20"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomFit} title="Fit timeline">
              <Maximize2 className="h-4 w-4" />
            </Button>
            {clips.some(c => c.isActive) && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomToSelection} title="Zoom to selection">
                <Move className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSplitAtPlayhead} title="Split at playhead (S)">
              <Scissors className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => clips.find(c => c.isActive) && handleDuplicateClip(clips.find(c => c.isActive)!.id)}
              title="Duplicate clip"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => clips.find(c => c.isActive) && handleDeleteClip(clips.find(c => c.isActive)!.id)}
              title="Delete clip (Del)"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Snap</span>
              <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={historyIndex >= clipHistory.length - 1 || clipHistory.length === 0} title="Redo (Ctrl+Y)">
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Ruler + Track in one scroll container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/50 bg-muted/10"
        style={{ scrollBehavior: 'auto' }}
      >
        <div
          ref={timelineRef}
          className="relative cursor-pointer"
          style={{ width: trackWidthPx, minWidth: '100%' }}
          onClick={handleTimelineClick}
          onMouseMove={(e) => setHoverTime(getTimeFromPosition(e.clientX))}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Ruler */}
          <div className="relative h-7 border-b border-border/50 bg-muted/20 rounded-t-lg">
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${(i / duration) * 100}%` }}
              >
                <div className={cn("w-px bg-muted-foreground/50", i % 5 === 0 ? "h-3" : "h-2")} />
                {i % 5 === 0 && (
                  <span className="text-[9px] text-muted-foreground mt-0.5 font-mono">{i}s</span>
                )}
              </div>
            ))}
            {hoverTime !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/60 pointer-events-none z-20"
                style={{ left: `${(hoverTime / duration) * 100}%` }}
              />
            )}
          </div>

          {/* Main track */}
          <div className="relative h-20">
          {/* Scene break markers (AI analysis) */}
          {sceneBreaks.filter(t => t > 0 && t < duration).map((t, i) => (
            <div
              key={`scene-${i}`}
              className="absolute top-0 bottom-0 w-0.5 bg-violet-500/70 pointer-events-none z-[5]"
              style={{ left: `${(t / duration) * 100}%` }}
              title={`Scene ${i + 1}`}
            />
          ))}
          {/* Waveform / background */}
          <div className="absolute inset-0 flex items-center gap-0.5 px-0.5 opacity-20">
            {Array.from({ length: Math.min(200, Math.floor(trackWidthPx / 4)) }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-primary rounded-sm min-w-[2px]"
                style={{ height: `${25 + Math.sin(i * 0.3) * 35}%` }}
              />
            ))}
          </div>

          {/* In/Out overlay */}
          {showInOutPoints && inOut && (
            <>
              <div
                className="absolute top-0 bottom-0 bg-amber-500/10 pointer-events-none"
                style={{
                  left: `${(inOut.in / duration) * 100}%`,
                  width: `${((inOut.out - inOut.in) / duration) * 100}%`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1.5 cursor-ew-resize bg-amber-500 z-10 rounded-l flex items-center justify-center"
                style={{ left: `${(inOut.in / duration) * 100}%` }}
                onMouseDown={(e) => handleMouseDown(e, 'in')}
              >
                <span className="text-[8px] font-bold text-amber-950 -rotate-90 whitespace-nowrap">IN</span>
              </div>
              <div
                className="absolute top-0 bottom-0 w-1.5 cursor-ew-resize bg-amber-500 z-10 rounded-r flex items-center justify-center"
                style={{ left: `${(inOut.out / duration) * 100}%` }}
                onMouseDown={(e) => handleMouseDown(e, 'out')}
              >
                <span className="text-[8px] font-bold text-amber-950 -rotate-90 whitespace-nowrap">OUT</span>
              </div>
            </>
          )}

          {/* Clips */}
          {clips.map((clip) => {
            const leftPct = (clip.startTime / duration) * 100;
            const widthPct = ((clip.endTime - clip.startTime) / duration) * 100;
            return (
              <div
                key={clip.id}
                className={cn(
                  'absolute top-1.5 bottom-1.5 rounded-md border-2 transition-colors cursor-grab active:cursor-grabbing',
                  clip.isActive ? 'bg-primary/35 border-primary z-[5]' : 'bg-muted/60 border-muted-foreground/30 hover:border-primary/50 z-[4]'
                )}
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 24 }}
                onClick={(e) => { e.stopPropagation(); selectClip(clip.id); }}
                onMouseDown={(e) => e.button === 0 && handleMouseDown(e, 'clip', clip.id)}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-primary/60 rounded-l hover:bg-primary flex items-center justify-center shrink-0"
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'trimStart', clip.id); }}
                >
                  <GripVertical className="h-3 w-3 text-primary-foreground/80" />
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-primary/60 rounded-r hover:bg-primary flex items-center justify-center shrink-0"
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, 'trimEnd', clip.id); }}
                >
                  <GripVertical className="h-3 w-3 text-primary-foreground/80" />
                </div>
                <div className="absolute inset-x-5 inset-y-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-medium text-foreground/90 truncate">
                    {clip.label || formatTime(clip.endTime - clip.startTime)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Highlights */}
          {highlights.map((h) => (
            <div
              key={h.id}
              className={cn('absolute top-0 bottom-0 pointer-events-none z-[2]', h.selected ? 'bg-green-500/25' : 'bg-amber-500/20')}
              style={{
                left: `${(h.startTime / duration) * 100}%`,
                width: `${((h.endTime - h.startTime) / duration) * 100}%`,
              }}
            >
              <div className={cn('absolute top-0 left-0 right-0 h-0.5', h.selected ? 'bg-green-500' : 'bg-amber-500')} />
            </div>
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 cursor-ew-resize"
            style={{ left: `${(currentTime / duration) * 100}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'playhead')}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md border border-primary/50" />
          </div>
          </div>
        </div>
      </div>

      {/* Hover time tooltip */}
      {hoverTime !== null && (
        <div className="text-[10px] font-mono text-muted-foreground">
          Hover: {formatTime(hoverTime, true, fps)}
        </div>
      )}

      {/* Clip strip with thumbnails */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
          {clips.map((clip, index) => (
          <button
            key={clip.id}
            onClick={() => selectClip(clip.id)}
            className={cn(
              'relative flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden transition-all border-2',
              clip.isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary' : 'border-transparent opacity-75 hover:opacity-100'
            )}
          >
            {thumbnails[clip.id] ? (
              <img src={thumbnails[clip.id]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-[10px] font-medium text-white/90"
                style={{
                  background: `linear-gradient(135deg, hsl(${(index * 55) % 360}, 65%, 42%) 0%, hsl(${(index * 55 + 40) % 360}, 65%, 28%) 100%)`,
                }}
              >
                {clip.label || `Clip ${index + 1}`}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/70 to-transparent text-[9px] text-white font-mono">
              {formatTime(clip.endTime - clip.startTime)}
            </div>
          </button>
        ))}
      </div>

      {/* Shortcut hints */}
      {keyboardShortcuts && (
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span>Space: Play/Pause</span>
          <span>J/K/L: Back/Pause/Fwd</span>
          <span>I/O: In/Out</span>
          <span>S: Split</span>
          <span>Del: Delete clip</span>
          <span>←/→: Frame</span>
          <span>Ctrl+Z/Y: Undo/Redo</span>
        </div>
      )}
    </div>
  );
};
