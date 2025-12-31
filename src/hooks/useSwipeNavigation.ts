import { useState, useCallback, useRef } from 'react';

interface SwipeConfig {
  threshold?: number;
  /** Pixels of movement before we consider it a drag/swipe (prevents taps from being swallowed) */
  dragStartThreshold?: number;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const isInteractiveTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(
    el.closest(
      'button, a, input, textarea, select, [role="button"], [data-no-swipe], [data-draggable]'
    )
  );
};

export const useSwipeNavigation = ({
  threshold = 50,
  dragStartThreshold = 10,
  onSwipeUp,
  onSwipeDown,
  onSwipeLeft,
  onSwipeRight,
}: SwipeConfig) => {
  const [isDragging, setIsDragging] = useState(false);
  const isPointerDown = useRef(false);
  const ignoreSwipeForThisGesture = useRef(false);

  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Never swallow taps/clicks on interactive controls
    ignoreSwipeForThisGesture.current = isInteractiveTarget(e.target);
    if (ignoreSwipeForThisGesture.current) return;

    isPointerDown.current = true;
    setIsDragging(false);

    const pos = 'touches' in e ? e.touches[0] : e;
    startPos.current = { x: pos.clientX, y: pos.clientY };
    currentPos.current = { x: pos.clientX, y: pos.clientY };
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isPointerDown.current || ignoreSwipeForThisGesture.current) return;

      const pos = 'touches' in e ? e.touches[0] : e;
      currentPos.current = { x: pos.clientX, y: pos.clientY };

      const deltaX = currentPos.current.x - startPos.current.x;
      const deltaY = currentPos.current.y - startPos.current.y;

      // Only enter dragging state after a small movement threshold
      if (!isDragging && (Math.abs(deltaX) > dragStartThreshold || Math.abs(deltaY) > dragStartThreshold)) {
        setIsDragging(true);
      }
    },
    [isDragging, dragStartThreshold]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isPointerDown.current || ignoreSwipeForThisGesture.current) return;

    isPointerDown.current = false;

    // If the gesture never became a drag, let the click/tap happen normally.
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
