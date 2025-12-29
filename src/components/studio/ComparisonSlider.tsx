import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical, Eye, EyeOff, SplitSquareHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComparisonSliderProps {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
  /** If true, renders as a standalone panel with preview area */
  standalone?: boolean;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  isActive,
  onToggle,
  className,
  standalone = false,
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

  // Standalone button mode - for beauty editor header
  if (!isActive && standalone) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className={cn("gap-2 h-8", className)}
      >
        <SplitSquareHorizontal className="w-4 h-4" />
        Compare
      </Button>
    );
  }

  // Overlay button mode - for video preview
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

  // Standalone panel mode - embedded preview within beauty editor
  if (standalone) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <SplitSquareHorizontal className="w-4 h-4" />
            Before/After Comparison
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 px-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Comparison Preview Container */}
        <div
          ref={containerRef}
          className="relative w-full aspect-[4/3] bg-muted rounded-xl overflow-hidden cursor-ew-resize select-none border border-border"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Original (Before) Side - left portion */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-muted via-muted/90 to-muted/80"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2 opacity-70">
                <div className="w-20 h-20 mx-auto rounded-full bg-foreground/10 flex items-center justify-center border-2 border-dashed border-foreground/20">
                  <span className="text-3xl">👤</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Original</span>
              </div>
            </div>
            {/* Before Label */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur-sm border border-border/50">
              <span className="text-[10px] font-bold uppercase tracking-wider">Before</span>
            </div>
          </div>

          {/* Enhanced (After) Side - right portion */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-primary/10 via-pink-500/10 to-purple-500/10"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/40 shadow-lg shadow-primary/20">
                  <span className="text-3xl">✨</span>
                </div>
                <span className="text-xs font-medium text-primary">Enhanced</span>
              </div>
            </div>
            {/* After Label */}
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-primary backdrop-blur-sm">
              <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-wider">After</span>
            </div>
          </div>

          {/* Slider Divider */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none z-20"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            {/* Slider Handle */}
            <div
              className={cn(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                'w-11 h-11 rounded-full bg-white shadow-xl',
                'flex items-center justify-center',
                'border-2 border-primary',
                isDragging && 'scale-110 ring-4 ring-primary/20',
                'transition-all duration-150'
              )}
            >
              <GripVertical className="w-5 h-5 text-primary" />
            </div>

            {/* Top arrow */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-white" />
            
            {/* Bottom arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
          </div>

          {/* Instruction Hint */}
          {!isDragging && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-sm shadow-lg border border-border/50">
              <span className="text-[10px] text-muted-foreground font-medium">← Drag to compare →</span>
            </div>
          )}
        </div>
        
        <p className="text-[10px] text-center text-muted-foreground">
          Upload media to see real-time before/after comparison
        </p>
      </div>
    );
  }

  // Overlay mode - for video preview
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
