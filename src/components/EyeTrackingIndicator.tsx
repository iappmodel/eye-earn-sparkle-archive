import React from 'react';
import { cn } from '@/lib/utils';

interface EyeTrackingIndicatorProps {
  isTracking: boolean;
  isFaceDetected: boolean;
  attentionScore: number;
  className?: string;
}

export const EyeTrackingIndicator: React.FC<EyeTrackingIndicatorProps> = ({
  isTracking,
  isFaceDetected,
  attentionScore,
  className,
}) => {
  if (!isTracking) return null;

  const getStatusColor = () => {
    if (!isFaceDetected) return 'bg-destructive';
    if (attentionScore >= 85) return 'bg-green-500';
    if (attentionScore >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getGlowColor = () => {
    if (!isFaceDetected) return 'bg-destructive/30';
    if (attentionScore >= 85) return 'bg-green-500/30';
    if (attentionScore >= 50) return 'bg-yellow-500/30';
    return 'bg-orange-500/30';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Glowing dot indicator */}
      <div className="relative">
        {/* Outer glow */}
        <div className={cn(
          'absolute -inset-2 rounded-full blur-md animate-pulse',
          getGlowColor()
        )} />
        
        {/* Ping animation */}
        {isFaceDetected && (
          <div className={cn(
            'absolute inset-0 w-4 h-4 rounded-full animate-ping opacity-75',
            getStatusColor()
          )} />
        )}
        
        {/* Main dot */}
        <div className={cn(
          'relative w-4 h-4 rounded-full shadow-lg transition-colors duration-300',
          getStatusColor()
        )}>
          {/* Inner highlight */}
          <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-white/50" />
        </div>
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className={cn(
          'text-xs font-medium transition-colors',
          isFaceDetected ? 'text-green-400' : 'text-destructive'
        )}>
          {isFaceDetected ? 'Tracking' : 'Look here'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {attentionScore}%
        </span>
      </div>
    </div>
  );
};
