import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type IndicatorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface EyeTrackingIndicatorProps {
  isTracking: boolean;
  isFaceDetected: boolean;
  attentionScore: number;
  position?: IndicatorPosition;
  className?: string;
}

const positionClasses: Record<IndicatorPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};

export const EyeTrackingIndicator: React.FC<EyeTrackingIndicatorProps> = ({
  isTracking,
  isFaceDetected,
  attentionScore,
  position = 'top-right',
  className,
}) => {
  const [showFullEye, setShowFullEye] = useState(true);
  const [irisOffset, setIrisOffset] = useState({ x: 0, y: 0 });
  
  const isAttentive = isFaceDetected && attentionScore >= 50;
  
  // Fade out full eye when attentive
  useEffect(() => {
    if (isAttentive) {
      const timer = setTimeout(() => setShowFullEye(false), 800);
      return () => clearTimeout(timer);
    } else {
      setShowFullEye(true);
    }
  }, [isAttentive]);

  // Subtle iris movement when tracking is active
  useEffect(() => {
    if (!isTracking || !isAttentive) {
      setIrisOffset({ x: 0, y: 0 });
      return;
    }

    const moveIris = () => {
      // Subtle random movement within a small range
      const maxOffset = 1.5;
      setIrisOffset({
        x: (Math.random() - 0.5) * maxOffset * 2,
        y: (Math.random() - 0.5) * maxOffset * 2,
      });
    };

    // Move iris every 800-1200ms for organic feel
    const interval = setInterval(moveIris, 800 + Math.random() * 400);
    moveIris(); // Initial movement

    return () => clearInterval(interval);
  }, [isTracking, isAttentive]);

  if (!isTracking) return null;

  const eyeColor = isAttentive ? 'stroke-green-500' : 'stroke-destructive';
  const irisColor = isAttentive ? 'bg-green-500' : 'bg-destructive';
  const glowColor = isAttentive ? 'shadow-green-500/50' : 'shadow-destructive/50';

  return (
    <div 
      className={cn(
        'absolute z-50 flex items-center justify-center',
        positionClasses[position],
        className
      )}
    >
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
        
        {/* Iris/Pupil - always visible, pulses and moves when attentive */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'relative rounded-full transition-all duration-500 ease-out',
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
            style={{
              transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
            }}
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
              style={{ 
                animationDuration: '2s',
                transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
