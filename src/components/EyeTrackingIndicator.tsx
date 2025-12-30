import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type EyeIndicatorPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-right';

interface EyeTrackingIndicatorProps {
  isTracking: boolean;
  isFaceDetected: boolean;
  attentionScore: number;
  position?: EyeIndicatorPosition;
  className?: string;
  onAttentionLostTooLong?: () => void;
  videoDuration?: number;
  currentTime?: number;
  attentionThreshold?: number;
}

const positionClasses: Record<EyeIndicatorPosition, string> = {
  'top-left': 'top-0 left-4',
  'top-center': 'top-0 left-1/2 -translate-x-1/2',
  'top-right': 'top-0 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};

export const EyeTrackingIndicator: React.FC<EyeTrackingIndicatorProps> = ({
  isTracking,
  isFaceDetected,
  attentionScore,
  position = 'top-center',
  className,
  onAttentionLostTooLong,
  videoDuration = 0,
  currentTime = 0,
  attentionThreshold = 10,
}) => {
  const [isHidden, setIsHidden] = useState(false);
  const [irisOffset, setIrisOffset] = useState({ x: 0, y: 0 });
  const attentionLostTimeRef = useRef(0);
  const lastCheckRef = useRef(Date.now());
  
  const isAttentive = isFaceDetected && attentionScore >= 50;
  
  // Hide indicator when attention is above 33%
  useEffect(() => {
    if (attentionScore >= 33 && isAttentive) {
      const timer = setTimeout(() => setIsHidden(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsHidden(false);
    }
  }, [attentionScore, isAttentive]);

  // Track attention lost time and trigger auto-pause if > threshold %
  useEffect(() => {
    if (!isTracking || videoDuration <= 0) return;

    const now = Date.now();
    const elapsed = now - lastCheckRef.current;
    lastCheckRef.current = now;

    if (!isAttentive) {
      attentionLostTimeRef.current += elapsed;
    }

    const totalWatchedTime = currentTime * 1000; // convert to ms
    if (totalWatchedTime > 0) {
      const lostPercentage = (attentionLostTimeRef.current / totalWatchedTime) * 100;
      
      if (lostPercentage > attentionThreshold && !isAttentive) {
        onAttentionLostTooLong?.();
      }
    }
  }, [isTracking, isAttentive, videoDuration, currentTime, onAttentionLostTooLong, attentionThreshold]);

  // Reset attention lost time when tracking starts fresh
  useEffect(() => {
    if (isTracking) {
      attentionLostTimeRef.current = 0;
      lastCheckRef.current = Date.now();
    }
  }, [isTracking]);

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
        fill: 'fill-red-500',
        bg: 'bg-red-500',
        glow: 'shadow-red-500/40',
      };
    }
    if (attentionScore >= 80) {
      return {
        stroke: 'stroke-green-500',
        fill: 'fill-green-500',
        bg: 'bg-green-500',
        glow: 'shadow-green-500/40',
      };
    }
    if (attentionScore >= 50) {
      return {
        stroke: 'stroke-yellow-500',
        fill: 'fill-yellow-500',
        bg: 'bg-yellow-500',
        glow: 'shadow-yellow-500/40',
      };
    }
    return {
      stroke: 'stroke-orange-500',
      fill: 'fill-orange-500',
      bg: 'bg-orange-500',
      glow: 'shadow-orange-500/40',
    };
  };

  const colors = getEyeColor();

  return (
    <div 
      className={cn(
        'absolute z-50 flex items-center justify-center transition-all duration-500',
        positionClasses[position],
        isHidden ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100',
        className
      )}
    >
      {/* Eye container - circular design like reference */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        {/* Outer circle (eye outline) */}
        <svg
          viewBox="0 0 40 40"
          className={cn(
            'absolute inset-0 w-full h-full transition-all duration-300',
            colors.stroke
          )}
          fill="none"
          strokeWidth="1.5"
        >
          <circle cx="20" cy="20" r="18" className="transition-colors duration-300" />
        </svg>
        
        {/* Middle circle (iris outline) */}
        <svg
          viewBox="0 0 40 40"
          className={cn(
            'absolute inset-0 w-full h-full transition-all duration-300',
            colors.stroke
          )}
          fill="none"
          strokeWidth="1"
        >
          <circle 
            cx="20" 
            cy="20" 
            r="10" 
            className="transition-colors duration-300"
            style={{
              transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
              transformOrigin: 'center',
            }}
          />
        </svg>
        
        {/* Inner pupil dot */}
        <div
          className={cn(
            'absolute w-3 h-3 rounded-full transition-all duration-300',
            colors.bg,
            colors.glow,
            'shadow-md'
          )}
          style={{
            transform: `translate(${irisOffset.x}px, ${irisOffset.y}px)`,
          }}
        >
          {/* Highlight */}
          <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-white/50" />
        </div>

        {/* Pulse effect when not attentive */}
        {!isAttentive && (
          <div 
            className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping"
            style={{ animationDuration: '1.5s' }}
          />
        )}
      </div>
    </div>
  );
};
