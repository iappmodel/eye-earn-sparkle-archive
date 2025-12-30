import React, { useState, useEffect } from 'react';
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
  const [showFullEye, setShowFullEye] = useState(true);
  
  const isAttentive = isFaceDetected && attentionScore >= 50;
  
  useEffect(() => {
    if (isAttentive) {
      // When attentive, fade out the full eye after a short delay
      const timer = setTimeout(() => setShowFullEye(false), 800);
      return () => clearTimeout(timer);
    } else {
      // When not attentive, show full eye immediately
      setShowFullEye(true);
    }
  }, [isAttentive]);

  if (!isTracking) return null;

  const eyeColor = isAttentive ? 'stroke-green-500' : 'stroke-destructive';
  const irisColor = isAttentive ? 'bg-green-500' : 'bg-destructive';
  const glowColor = isAttentive ? 'shadow-green-500/50' : 'shadow-destructive/50';

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Eye outline container */}
      <div className="relative w-12 h-8">
        {/* Outer eye shape - fades out when attentive */}
        <svg
          viewBox="0 0 48 32"
          className={cn(
            'absolute inset-0 w-full h-full transition-all duration-700',
            eyeColor,
            showFullEye ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
          fill="none"
          strokeWidth="2"
        >
          {/* Upper eyelid curve */}
          <path
            d="M4 16 Q24 2 44 16"
            className="transition-colors duration-300"
          />
          {/* Lower eyelid curve */}
          <path
            d="M4 16 Q24 30 44 16"
            className="transition-colors duration-300"
          />
        </svg>
        
        {/* Iris/Pupil - always visible, pulses when attentive */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'rounded-full transition-all duration-300',
              irisColor,
              glowColor,
              isAttentive ? [
                'w-3 h-3',
                'shadow-lg',
                'animate-pulse'
              ] : [
                'w-4 h-4',
                'shadow-md'
              ]
            )}
          >
            {/* Inner highlight */}
            <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/60" />
          </div>
        </div>
        
        {/* Glow ring around iris when attentive */}
        {isAttentive && !showFullEye && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className={cn(
                'w-5 h-5 rounded-full',
                'bg-green-500/20',
                'animate-ping'
              )}
              style={{ animationDuration: '2s' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
