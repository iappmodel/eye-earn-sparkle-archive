import React from 'react';
import { cn } from '@/lib/utils';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

interface SwipeDismissOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const SwipeDismissOverlay: React.FC<SwipeDismissOverlayProps> = ({
  isOpen,
  onClose,
  children,
  className,
}) => {
  const { dragOffset, isDragging, scrollRef, handlers } = useSwipeToDismiss({
    onDismiss: onClose,
  });

  if (!isOpen) return null;

  const opacity = Math.max(1 - dragOffset / 500, 0.3);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-background/95 backdrop-blur-lg',
        !isDragging && dragOffset === 0 && 'animate-slide-up',
        className
      )}
      style={{
        transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        opacity: dragOffset > 0 ? opacity : undefined,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
      }}
      {...handlers}
      ref={scrollRef}
    >
      {/* Drag Handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
      </div>
      {children}
    </div>
  );
};

export default SwipeDismissOverlay;
