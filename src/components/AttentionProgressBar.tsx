import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AttentionSegment {
  startPercent: number;
  endPercent: number;
  quality: 'high' | 'medium' | 'low' | 'none';
}

interface AttentionProgressBarProps {
  progress: number; // 0-100
  currentAttentionScore: number;
  isTracking: boolean;
  className?: string;
}

const qualityColors = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-orange-500',
  none: 'bg-red-500',
};

const getQuality = (score: number): 'high' | 'medium' | 'low' | 'none' => {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'none';
};

export const AttentionProgressBar: React.FC<AttentionProgressBarProps> = ({
  progress,
  currentAttentionScore,
  isTracking,
  className,
}) => {
  const [segments, setSegments] = useState<AttentionSegment[]>([]);
  const lastProgressRef = useRef(0);
  const lastQualityRef = useRef<'high' | 'medium' | 'low' | 'none'>('high');

  // Update segments as video progresses
  useEffect(() => {
    if (!isTracking || progress <= 0) return;

    const currentQuality = getQuality(currentAttentionScore);
    const lastProgress = lastProgressRef.current;

    // If quality changed or this is a new segment
    if (currentQuality !== lastQualityRef.current || segments.length === 0) {
      setSegments(prev => {
        // Close previous segment if exists
        const updated = prev.length > 0 
          ? prev.map((seg, i) => 
              i === prev.length - 1 
                ? { ...seg, endPercent: lastProgress }
                : seg
            )
          : [];

        // Start new segment
        return [...updated, {
          startPercent: lastProgress,
          endPercent: progress,
          quality: currentQuality,
        }];
      });
      lastQualityRef.current = currentQuality;
    } else {
      // Extend current segment
      setSegments(prev => 
        prev.map((seg, i) => 
          i === prev.length - 1 
            ? { ...seg, endPercent: progress }
            : seg
        )
      );
    }

    lastProgressRef.current = progress;
  }, [progress, currentAttentionScore, isTracking]);

  // Reset when progress resets
  useEffect(() => {
    if (progress < 5 && lastProgressRef.current > 50) {
      setSegments([]);
      lastProgressRef.current = 0;
      lastQualityRef.current = 'high';
    }
  }, [progress]);

  if (!isTracking) return null;

  return (
    <div className={cn('absolute bottom-1 left-0 right-0 h-1.5 z-40', className)}>
      {/* Background track */}
      <div className="absolute inset-0 bg-muted/40 rounded-full" />
      
      {/* Attention quality segments */}
      {segments.map((segment, index) => (
        <div
          key={index}
          className={cn(
            'absolute top-0 h-full rounded-full transition-all duration-100',
            qualityColors[segment.quality]
          )}
          style={{
            left: `${segment.startPercent}%`,
            width: `${Math.max(0, segment.endPercent - segment.startPercent)}%`,
          }}
        />
      ))}

      {/* Current position indicator */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-lg transition-all duration-100"
        style={{ left: `calc(${progress}% - 5px)` }}
      >
        <div className={cn(
          'absolute inset-0.5 rounded-full',
          qualityColors[getQuality(currentAttentionScore)]
        )} />
      </div>

      {/* Legend - compact */}
      <div className="absolute -top-5 right-0 flex items-center gap-2 text-[10px]">
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Good</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <span className="text-muted-foreground">Fair</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-muted-foreground">Low</span>
        </span>
      </div>
    </div>
  );
};
