import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, Eye, EyeOff } from 'lucide-react';

interface ComparisonSliderProps {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  isActive,
  onToggle,
  className,
}) => {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setPosition(percentage);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  if (!isActive) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          'absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full',
          'bg-black/60 backdrop-blur-sm border border-white/20',
          'text-white text-xs font-medium',
          'hover:bg-black/80 transition-colors',
          className
        )}
      >
        <Eye className="w-3.5 h-3.5" />
        Compare
      </button>
    );
  }

  return (
    <>
      {/* Toggle button when active */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full',
          'bg-primary/80 backdrop-blur-sm border border-primary/50',
          'text-white text-xs font-medium',
          'hover:bg-primary transition-colors',
          className
        )}
      >
        <EyeOff className="w-3.5 h-3.5" />
        Exit Compare
      </button>

      {/* Comparison overlay container */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-10 cursor-ew-resize"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Clip mask for "Before" side (original - no effects) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {/* This div blocks the filter effects on the left side */}
          <div className="absolute inset-0 bg-transparent" />
          
          {/* "Before" label */}
          <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium backdrop-blur-sm">
            Original
          </div>
        </div>

        {/* "After" label on right side */}
        <div
          className="absolute top-3 px-2 py-1 rounded bg-primary/70 text-white text-xs font-medium backdrop-blur-sm pointer-events-none"
          style={{ left: `calc(${position}% + 12px)` }}
        >
          With Effect
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          {/* Handle */}
          <div
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-10 h-10 rounded-full bg-white shadow-xl',
              'flex items-center justify-center',
              'border-2 border-primary',
              isDragging && 'scale-110',
              'transition-transform duration-150'
            )}
          >
            <GripVertical className="w-5 h-5 text-primary" />
          </div>

          {/* Top arrow */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-white" />
          
          {/* Bottom arrow */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
        </div>
      </div>

      {/* Mask for blocking effects on the "before" side */}
      <div
        className="absolute inset-0 z-5 pointer-events-none"
        style={{
          clipPath: `inset(0 ${100 - position}% 0 0)`,
          background: 'transparent',
        }}
        data-comparison-mask="true"
      />
    </>
  );
};

// Hook to check if comparison is blocking effects
export const useComparisonMask = (position: number, elementX: number, containerWidth: number) => {
  const threshold = (position / 100) * containerWidth;
  return elementX < threshold;
};
