import React, { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Direction = 'up' | 'down' | 'left' | 'right';

interface CrossNavigationProps {
  onNavigate: (direction: Direction) => void;
  labels?: {
    up?: string;
    down?: string;
    left?: string;
    right?: string;
  };
  activeDirection?: Direction | null;
}

export const CrossNavigation: React.FC<CrossNavigationProps> = ({
  onNavigate,
  labels = {
    up: 'Previous',
    down: 'Next',
    left: 'Friends',
    right: 'Promos',
  },
  activeDirection,
}) => {
  const [visibleDirection, setVisibleDirection] = useState<Direction | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Show the direction indicator briefly when activeDirection changes
  useEffect(() => {
    if (activeDirection) {
      setVisibleDirection(activeDirection);
      setIsAnimating(true);

      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [activeDirection]);

  // Clear visible direction after fade-out animation completes
  useEffect(() => {
    if (!isAnimating && visibleDirection) {
      const timer = setTimeout(() => {
        setVisibleDirection(null);
      }, 300); // Match fade-out duration
      return () => clearTimeout(timer);
    }
  }, [isAnimating, visibleDirection]);

  const handleClick = useCallback((direction: Direction) => {
    setVisibleDirection(direction);
    setIsAnimating(true);
    onNavigate(direction);

    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, 1000);
  }, [onNavigate]);

  const baseClasses = "fixed z-40 flex items-center gap-2 transition-all duration-300 pointer-events-auto";
  const visibleClasses = "opacity-90 scale-100";
  const hiddenClasses = "opacity-0 scale-75 pointer-events-none";

  return (
    <>
      {/* Top indicator */}
      <button
        onClick={() => handleClick('up')}
        className={cn(
          baseClasses,
          "top-6 left-1/2 -translate-x-1/2 flex-col",
          visibleDirection === 'up' && isAnimating ? visibleClasses : hiddenClasses
        )}
      >
        <ChevronUp className="w-8 h-8 text-primary animate-bounce" />
        <span className="text-sm font-medium text-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
          {labels.up}
        </span>
      </button>

      {/* Bottom indicator */}
      <button
        onClick={() => handleClick('down')}
        className={cn(
          baseClasses,
          "bottom-28 left-1/2 -translate-x-1/2 flex-col-reverse",
          visibleDirection === 'down' && isAnimating ? visibleClasses : hiddenClasses
        )}
      >
        <ChevronDown className="w-8 h-8 text-primary animate-bounce" />
        <span className="text-sm font-medium text-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
          {labels.down}
        </span>
      </button>

      {/* Left indicator */}
      <button
        onClick={() => handleClick('left')}
        className={cn(
          baseClasses,
          "left-6 top-1/2 -translate-y-1/2",
          visibleDirection === 'left' && isAnimating ? visibleClasses : hiddenClasses
        )}
      >
        <ChevronLeft className="w-8 h-8 text-primary" />
        <span className="text-sm font-medium text-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
          {labels.left}
        </span>
      </button>

      {/* Right indicator */}
      <button
        onClick={() => handleClick('right')}
        className={cn(
          baseClasses,
          "right-6 top-1/2 -translate-y-1/2",
          visibleDirection === 'right' && isAnimating ? visibleClasses : hiddenClasses
        )}
      >
        <span className="text-sm font-medium text-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
          {labels.right}
        </span>
        <ChevronRight className="w-8 h-8 text-primary" />
      </button>
    </>
  );
};
