import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SwipeBackConfig {
  threshold?: number;
  edgeWidth?: number;
  enabled?: boolean;
}

export const useSwipeBack = ({
  threshold = 100,
  edgeWidth = 30,
  enabled = true,
}: SwipeBackConfig = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSwipingBack, setIsSwipingBack] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const startPos = useRef({ x: 0, y: 0 });
  const isEdgeSwipe = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    // Only activate on left edge swipe
    if (touch.clientX <= edgeWidth) {
      isEdgeSwipe.current = true;
      startPos.current = { x: touch.clientX, y: touch.clientY };
      setIsSwipingBack(true);
    }
  }, [enabled, edgeWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isEdgeSwipe.current || !enabled) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startPos.current.x;
    const deltaY = Math.abs(touch.clientY - startPos.current.y);

    // Cancel if vertical movement is more than horizontal
    if (deltaY > Math.abs(deltaX)) {
      isEdgeSwipe.current = false;
      setIsSwipingBack(false);
      setSwipeProgress(0);
      return;
    }

    if (deltaX > 0) {
      const progress = Math.min(deltaX / threshold, 1);
      setSwipeProgress(progress);
    }
  }, [enabled, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isEdgeSwipe.current || !enabled) return;

    if (swipeProgress >= 0.5) {
      // Navigate back
      navigate(-1);
    }

    setIsSwipingBack(false);
    setSwipeProgress(0);
    isEdgeSwipe.current = false;
  }, [enabled, swipeProgress, navigate]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isSwipingBack,
    swipeProgress,
    canGoBack: location.key !== 'default',
  };
};
