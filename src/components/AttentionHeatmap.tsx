import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface AttentionSegment {
  startPercent: number;
  endPercent: number;
  avgScore: number;
}

interface AttentionHeatmapProps {
  segments: AttentionSegment[];
  currentProgress: number;
  isVisible: boolean;
  className?: string;
}

const getHeatColor = (score: number): string => {
  // Gradient from red (low) -> orange -> yellow -> green (high)
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-lime-500';
  if (score >= 40) return 'bg-yellow-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

const getHeatOpacity = (score: number): number => {
  return 0.5 + (score / 100) * 0.5;
};

export const AttentionHeatmap: React.FC<AttentionHeatmapProps> = ({
  segments,
  currentProgress,
  isVisible,
  className,
}) => {
  // Create a visual representation of attention over time
  const heatmapBars = useMemo(() => {
    if (segments.length === 0) return [];

    return segments.map((segment, index) => ({
      ...segment,
      color: getHeatColor(segment.avgScore),
      opacity: getHeatOpacity(segment.avgScore),
      width: segment.endPercent - segment.startPercent,
    }));
  }, [segments]);

  // Calculate stats
  const stats = useMemo(() => {
    if (segments.length === 0) return null;

    const totalWidth = segments.reduce((sum, s) => sum + (s.endPercent - s.startPercent), 0);
    if (totalWidth === 0) return null;

    const weightedSum = segments.reduce((sum, s) => {
      const width = s.endPercent - s.startPercent;
      return sum + s.avgScore * width;
    }, 0);

    const avgScore = weightedSum / totalWidth;
    const bestSegment = segments.reduce((best, s) => s.avgScore > best.avgScore ? s : best, segments[0]);
    const worstSegment = segments.reduce((worst, s) => s.avgScore < worst.avgScore ? s : worst, segments[0]);

    return {
      avgScore: Math.round(avgScore),
      bestStart: Math.round(bestSegment.startPercent),
      bestEnd: Math.round(bestSegment.endPercent),
      worstStart: Math.round(worstSegment.startPercent),
      worstEnd: Math.round(worstSegment.endPercent),
    };
  }, [segments]);

  if (!isVisible || segments.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Heatmap visualization */}
      <div className="relative h-6 bg-muted/30 rounded-lg overflow-hidden">
        {/* Background grid lines */}
        <div className="absolute inset-0 flex">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-border/20 last:border-r-0"
            />
          ))}
        </div>

        {/* Heat segments */}
        {heatmapBars.map((bar, index) => (
          <div
            key={index}
            className={cn(
              'absolute top-0 h-full transition-all duration-300',
              bar.color
            )}
            style={{
              left: `${bar.startPercent}%`,
              width: `${bar.width}%`,
              opacity: bar.opacity,
            }}
          />
        ))}

        {/* Current position indicator */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-100"
          style={{ left: `${currentProgress}%` }}
        />

        {/* Time labels */}
        <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 text-[8px] text-muted-foreground/70">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-500" />
          <span className="text-muted-foreground">Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-yellow-500" />
          <span className="text-muted-foreground">Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-500" />
          <span className="text-muted-foreground">High</span>
        </div>
      </div>

      {/* Stats summary (shown in end stats overlay) */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="bg-muted/30 rounded-lg p-2">
            <div className={cn(
              'text-sm font-bold',
              stats.avgScore >= 70 ? 'text-green-500' : stats.avgScore >= 40 ? 'text-yellow-500' : 'text-red-500'
            )}>
              {stats.avgScore}%
            </div>
            <div className="text-muted-foreground">Average</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <div className="text-sm font-bold text-green-500">
              {stats.bestStart}-{stats.bestEnd}%
            </div>
            <div className="text-muted-foreground">Best Focus</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <div className="text-sm font-bold text-orange-500">
              {stats.worstStart}-{stats.worstEnd}%
            </div>
            <div className="text-muted-foreground">Needs Work</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Hook to track attention over time and build heatmap data
export const useAttentionHeatmap = () => {
  const [segments, setSegments] = React.useState<AttentionSegment[]>([]);
  const currentSegmentRef = React.useRef<{ startPercent: number; scores: number[] } | null>(null);
  const lastProgressRef = React.useRef(0);

  const recordAttention = React.useCallback((progress: number, attentionScore: number) => {
    const SEGMENT_SIZE = 5; // 5% segments
    const currentSegmentStart = Math.floor(progress / SEGMENT_SIZE) * SEGMENT_SIZE;

    // Check if we've moved to a new segment
    const lastSegmentStart = Math.floor(lastProgressRef.current / SEGMENT_SIZE) * SEGMENT_SIZE;
    
    if (currentSegmentStart !== lastSegmentStart && currentSegmentRef.current) {
      // Finalize previous segment
      const scores = currentSegmentRef.current.scores;
      const avgScore = scores.length > 0 
        ? scores.reduce((a, b) => a + b, 0) / scores.length 
        : 0;

      setSegments(prev => {
        // Check if segment already exists
        const existingIndex = prev.findIndex(s => s.startPercent === currentSegmentRef.current!.startPercent);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            avgScore,
          };
          return updated;
        }
        return [...prev, {
          startPercent: currentSegmentRef.current!.startPercent,
          endPercent: currentSegmentRef.current!.startPercent + SEGMENT_SIZE,
          avgScore,
        }];
      });

      // Start new segment
      currentSegmentRef.current = {
        startPercent: currentSegmentStart,
        scores: [attentionScore],
      };
    } else if (!currentSegmentRef.current) {
      // Initialize first segment
      currentSegmentRef.current = {
        startPercent: currentSegmentStart,
        scores: [attentionScore],
      };
    } else {
      // Add to current segment
      currentSegmentRef.current.scores.push(attentionScore);
    }

    lastProgressRef.current = progress;
  }, []);

  const reset = React.useCallback(() => {
    setSegments([]);
    currentSegmentRef.current = null;
    lastProgressRef.current = 0;
  }, []);

  const finalizeCurrentSegment = React.useCallback(() => {
    if (currentSegmentRef.current && currentSegmentRef.current.scores.length > 0) {
      const scores = currentSegmentRef.current.scores;
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      setSegments(prev => {
        const existingIndex = prev.findIndex(s => s.startPercent === currentSegmentRef.current!.startPercent);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            avgScore,
            endPercent: lastProgressRef.current,
          };
          return updated;
        }
        return [...prev, {
          startPercent: currentSegmentRef.current!.startPercent,
          endPercent: lastProgressRef.current,
          avgScore,
        }];
      });
    }
  }, []);

  return {
    segments,
    recordAttention,
    reset,
    finalizeCurrentSegment,
  };
};
