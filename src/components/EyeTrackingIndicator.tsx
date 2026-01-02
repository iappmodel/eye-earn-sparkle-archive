import React, { useState, useEffect, useRef, forwardRef } from 'react';
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
  'top-left': 'top-2 left-4',
  'top-center': 'top-2 left-1/2 -translate-x-1/2',
  'top-right': 'top-2 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};

export const EyeTrackingIndicator = forwardRef<HTMLDivElement, EyeTrackingIndicatorProps>(({
  isTracking,
  isFaceDetected,
  attentionScore,
  position = 'top-center',
  className,
}, ref) => {
  const [visibility, setVisibility] = useState<'full' | 'iris-only' | 'hidden'>('full');
  const [irisOffset, setIrisOffset] = useState({ x: 0, y: 0 });
  const goodAttentionStartRef = useRef<number | null>(null);
  
  const isAttentive = isFaceDetected && attentionScore >= 50;
  
  // Progressive hiding: full eye -> iris only -> completely hidden
  // When attention is lost: immediately show full eye (red)
  useEffect(() => {
    if (!isAttentive) {
      // Attention lost - show full eye immediately
      setVisibility('full');
      goodAttentionStartRef.current = null;
      return;
    }

    // Start tracking good attention time
    if (goodAttentionStartRef.current === null) {
      goodAttentionStartRef.current = Date.now();
    }

    const elapsed = Date.now() - goodAttentionStartRef.current;
    
    // After 2s of good attention: hide outer circle (show iris only)
    // After 4s of good attention: hide everything
    if (elapsed >= 4000) {
      setVisibility('hidden');
    } else if (elapsed >= 2000) {
      setVisibility('iris-only');
    } else {
      setVisibility('full');
    }
  }, [isAttentive, attentionScore]);

  // Update visibility on interval when attentive
  useEffect(() => {
    if (!isAttentive) return;

    const interval = setInterval(() => {
      if (goodAttentionStartRef.current === null) return;
      
      const elapsed = Date.now() - goodAttentionStartRef.current;
      
      if (elapsed >= 4000) {
        setVisibility('hidden');
      } else if (elapsed >= 2000) {
        setVisibility('iris-only');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isAttentive]);

  // Subtle iris movement when tracking is active
  useEffect(() => {
    if (!isTracking || !isAttentive) {
      setIrisOffset({ x: 0, y: 0 });
      return;
    }

    const moveIris = () => {
      const maxOffset = 1.5;
      setIrisOffset({
        x: (Math.random() - 0.5) * maxOffset * 2,
        y: (Math.random() - 0.5) * maxOffset * 2,
      });
    };

    const interval = setInterval(moveIris, 800 + Math.random() * 400);
    moveIris();

    return () => clearInterval(interval);
  }, [isTracking, isAttentive]);

  if (!isTracking) return null;

  // Get color based on attention state
  const getEyeColor = () => {
    if (!isAttentive) {
      return {
        stroke: 'stroke-red-500',
        bg: 'bg-red-500',
        shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.6)]',
      };
    }
    if (attentionScore >= 80) {
      return {
        stroke: 'stroke-green-500',
        bg: 'bg-green-500',
        shadow: 'shadow-[0_0_10px_rgba(34,197,94,0.4)]',
      };
    }
    if (attentionScore >= 50) {
      return {
        stroke: 'stroke-yellow-500',
        bg: 'bg-yellow-500',
        shadow: 'shadow-[0_0_10px_rgba(234,179,8,0.4)]',
      };
    }
    return {
      stroke: 'stroke-orange-500',
      bg: 'bg-orange-500',
      shadow: 'shadow-[0_0_10px_rgba(249,115,22,0.4)]',
    };
  };

  const colors = getEyeColor();
  const showOuterCircle = visibility === 'full';
  const showIris = visibility === 'full' || visibility === 'iris-only';
  const isHidden = visibility === 'hidden';

  return (
    <div 
      ref={ref}
      className={cn(
        'absolute z-50 flex items-center justify-center transition-all duration-500',
        positionClasses[position],
        isHidden ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100',
        className
      )}
    >
      {/* Eye container - minimal circular design matching reference */}
      <div className={cn(
        'relative w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300',
        'bg-muted/60 backdrop-blur-sm border border-border/30',
        colors.shadow
      )}>
        {/* Outer circle (eye outline) - fades out first */}
        <svg
          viewBox="0 0 40 40"
          className={cn(
            'absolute inset-0 w-full h-full transition-all duration-500',
            colors.stroke,
            showOuterCircle ? 'opacity-100' : 'opacity-0'
          )}
          fill="none"
          strokeWidth="1.5"
        >
          <circle cx="20" cy="20" r="16" className="transition-colors duration-300" />
        </svg>
        
        {/* Middle circle (iris outline) - fades out second */}
        <svg
          viewBox="0 0 40 40"
          className={cn(
            'absolute inset-0 w-full h-full transition-all duration-500',
            colors.stroke,
            showIris ? 'opacity-100' : 'opacity-0'
          )}
          fill="none"
          strokeWidth="1"
        >
          <circle 
            cx="20" 
            cy="20" 
            r="9" 
            className="transition-all duration-300"
            style={{
              transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
              transformOrigin: 'center',
            }}
          />
        </svg>
        
        {/* Inner pupil dot - always visible when indicator shown */}
        <div
          className={cn(
            'absolute w-3.5 h-3.5 rounded-full transition-all duration-300',
            colors.bg,
            showIris ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          )}
          style={{
            transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
          }}
        >
          {/* Highlight */}
          <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/60" />
        </div>

        {/* Pulse effect when attention is lost */}
        {!isAttentive && (
          <div 
            className="absolute inset-0 rounded-full border-2 border-red-500/60 animate-ping"
            style={{ animationDuration: '1.5s' }}
          />
        )}
      </div>
    </div>
  );
});

EyeTrackingIndicator.displayName = 'EyeTrackingIndicator';
