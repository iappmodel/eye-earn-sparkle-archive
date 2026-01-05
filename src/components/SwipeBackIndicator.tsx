import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeBackIndicatorProps {
  isActive: boolean;
  progress: number;
}

export const SwipeBackIndicator: React.FC<SwipeBackIndicatorProps> = ({
  isActive,
  progress,
}) => {
  if (!isActive) return null;

  return (
    <>
      {/* Edge indicator */}
      <div
        className={cn(
          'fixed left-0 top-0 bottom-0 z-[100] pointer-events-none',
          'bg-gradient-to-r from-primary/30 to-transparent',
          'transition-opacity duration-150'
        )}
        style={{
          width: `${progress * 100}px`,
          opacity: progress,
        }}
      />
      
      {/* Back arrow */}
      <div
        className={cn(
          'fixed left-4 top-1/2 -translate-y-1/2 z-[100]',
          'w-12 h-12 rounded-full bg-primary/20 backdrop-blur-md',
          'flex items-center justify-center',
          'transition-all duration-150',
          progress >= 0.5 ? 'scale-110 bg-primary/40' : 'scale-100'
        )}
        style={{
          opacity: progress,
          transform: `translateY(-50%) translateX(${progress * 20}px)`,
        }}
      >
        <ChevronLeft className={cn(
          'w-6 h-6 text-primary transition-transform duration-150',
          progress >= 0.5 ? '-translate-x-0.5' : ''
        )} />
      </div>
    </>
  );
};
