import { useState, useCallback, useRef } from 'react';

interface SwipeConfig {
  threshold?: number;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const useSwipeNavigation = ({
  threshold = 50,
  onSwipeUp,
  onSwipeDown,
  onSwipeLeft,
  onSwipeRight,
}: SwipeConfig) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const pos = 'touches' in e ? e.touches[0] : e;
    startPos.current = { x: pos.clientX, y: pos.clientY };
    currentPos.current = { x: pos.clientX, y: pos.clientY };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const pos = 'touches' in e ? e.touches[0] : e;
    currentPos.current = { x: pos.clientX, y: pos.clientY };
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine if swipe is primarily vertical or horizontal
    if (absY > absX && absY > threshold) {
      if (deltaY < 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    } else if (absX > absY && absX > threshold) {
      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }
  }, [isDragging, threshold, onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleTouchStart,
      onMouseMove: handleTouchMove,
      onMouseUp: handleTouchEnd,
      onMouseLeave: handleTouchEnd,
    },
    isDragging,
  };
};
