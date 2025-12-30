import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type EyeIndicatorPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-right';

interface EyeTrackingIndicatorProps {
  isTracking: boolean;
  isFaceDetected: boolean;
  attentionScore: number;
  position?: EyeIndicatorPosition;
  className?: string;
}

const positionClasses: Record<EyeIndicatorPosition, string> = {
  'top-left': 'top-3 left-4',
  'top-center': 'top-3 left-1/2 -translate-x-1/2',
  'top-right': 'top-3 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};

export const EyeTrackingIndicator: React.FC<EyeTrackingIndicatorProps> = ({
  isTracking,
  isFaceDetected,
  attentionScore,
  position = 'top-center',
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
      const maxOffset = 1;
      setIrisOffset({
        x: (Math.random() - 0.5) * maxOffset * 2,
        y: (Math.random() - 0.5) * maxOffset * 2,
      });
    };

    const interval = setInterval(moveIris, 900 + Math.random() * 300);
    moveIris();

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
      {/* Smaller eye container */}
      <div className="relative w-8 h-5">
        {/* Outer eye shape - fades out when attentive */}
        <svg
          viewBox="0 0 32 20"
          className={cn(
            'absolute inset-0 w-full h-full transition-all duration-700',
            eyeColor,
            showFullEye ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          )}
          fill="none"
          strokeWidth="1.5"
        >
          {/* Upper eyelid curve */}
          <path d="M2 10 Q16 1 30 10" className="transition-colors duration-300" />
          {/* Lower eyelid curve */}
          <path d="M2 10 Q16 19 30 10" className="transition-colors duration-300" />
        </svg>
        
        {/* Iris/Pupil - smaller, pulses and moves when attentive */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'relative rounded-full transition-all duration-500 ease-out',
              irisColor,
              glowColor,
              isAttentive ? 'w-2 h-2 shadow-md animate-pulse' : 'w-2.5 h-2.5 shadow-sm'
            )}
            style={{
              transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
            }}
          >
            {/* Inner highlight */}
            <div className="absolute top-0.5 left-0.5 w-0.5 h-0.5 rounded-full bg-white/60" />
          </div>
        </div>
        
        {/* Glow ring around iris when attentive */}
        {isAttentive && !showFullEye && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className="w-3 h-3 rounded-full bg-green-500/20 animate-ping"
              style={{ 
                animationDuration: '2.5s',
                transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
