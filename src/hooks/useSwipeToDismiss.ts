import { useState, useRef, useCallback } from 'react';

interface UseSwipeToDismissOptions {
  threshold?: number;
  onDismiss: () => void;
}

export const useSwipeToDismiss = ({
  threshold = 150,
  onDismiss,
}: UseSwipeToDismissOptions) => {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start drag if scrolled to top
    const scrollEl = scrollRef.current;
    if (scrollEl && scrollEl.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
    isDraggingRef.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const scrollEl = scrollRef.current;
    if (scrollEl && scrollEl.scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;

    // Only allow downward drag
    if (delta > 0) {
      isDraggingRef.current = true;
      setIsDragging(true);
      setDragOffset(delta);
      // Prevent scroll while dragging down
      e.preventDefault();
    } else if (isDraggingRef.current) {
      // If we were dragging but now going back up, reset
      setDragOffset(0);
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;

    if (dragOffset >= threshold) {
      // Dismiss
      setDragOffset(window.innerHeight);
      setTimeout(() => {
        onDismiss();
        setDragOffset(0);
        setIsDragging(false);
      }, 200);
    } else {
      // Snap back
      setDragOffset(0);
      setIsDragging(false);
    }
    isDraggingRef.current = false;
  }, [dragOffset, threshold, onDismiss]);

  return {
    dragOffset,
    isDragging,
    scrollRef,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
};
