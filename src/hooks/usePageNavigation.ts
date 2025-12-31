// Multi-directional page navigation hook using configured page layout
import { useState, useCallback, useMemo, useRef } from 'react';
import { useUICustomization, PageSlot, PageDirection } from '@/contexts/UICustomizationContext';

export type TransitionType = 'slide' | 'fade' | 'zoom' | 'flip';
export type TransitionState = 'idle' | 'entering' | 'exiting';

interface PageState {
  direction: PageDirection;
  index: number; // Index within the direction stack
}

interface TransitionConfig {
  type: TransitionType;
  duration: number;
  direction: PageDirection;
}

interface UsePageNavigationReturn {
  currentPage: PageSlot | null;
  currentState: PageState;
  transition: TransitionConfig | null;
  transitionState: TransitionState;
  canNavigate: (direction: PageDirection) => boolean;
  navigate: (direction: PageDirection) => void;
  navigateToPage: (pageId: string) => void;
  getPagesByDirection: (direction: PageDirection) => PageSlot[];
  getTransitionClasses: () => string;
  getTransitionStyles: () => React.CSSProperties;
}

// Get transition type based on direction
const getTransitionType = (direction: PageDirection): TransitionType => {
  switch (direction) {
    case 'up':
    case 'down':
      return 'slide';
    case 'left':
    case 'right':
      return 'slide';
    default:
      return 'fade';
  }
};

export const usePageNavigation = (): UsePageNavigationReturn => {
  const { pageLayout, getPagesByDirection: getPages } = useUICustomization();
  
  // Current page state
  const [currentState, setCurrentState] = useState<PageState>({
    direction: 'center',
    index: 0,
  });
  
  // Transition state
  const [transition, setTransition] = useState<TransitionConfig | null>(null);
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const isNavigating = useRef(false);

  // Get current page
  const currentPage = useMemo(() => {
    const pages = pageLayout.pages.filter(p => p.direction === currentState.direction);
    return pages[currentState.index] || pageLayout.pages.find(p => p.direction === 'center') || null;
  }, [pageLayout.pages, currentState]);

  // Get pages by direction (memoized)
  const getPagesByDirection = useCallback((direction: PageDirection) => {
    return getPages(direction);
  }, [getPages]);

  // Check if navigation is possible in a direction
  const canNavigate = useCallback((direction: PageDirection): boolean => {
    if (isNavigating.current) return false;
    
    // From center, can go in any direction that has pages
    if (currentState.direction === 'center') {
      const targetPages = getPagesByDirection(direction);
      return targetPages.length > 0 || direction === 'up' || direction === 'down';
    }
    
    // From a non-center direction
    const oppositeDirections: Record<PageDirection, PageDirection> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
      center: 'center',
    };
    
    // Can always go back to center via opposite direction
    if (direction === oppositeDirections[currentState.direction]) {
      return true;
    }
    
    // Can navigate within same axis (up/down or left/right)
    if ((currentState.direction === 'up' || currentState.direction === 'down') &&
        (direction === 'up' || direction === 'down')) {
      return true;
    }
    
    if ((currentState.direction === 'left' || currentState.direction === 'right') &&
        (direction === 'left' || direction === 'right')) {
      return true;
    }
    
    return false;
  }, [currentState, getPagesByDirection]);

  // Navigate in a direction
  const navigate = useCallback((direction: PageDirection) => {
    if (!canNavigate(direction) || isNavigating.current) return;
    
    isNavigating.current = true;
    
    // Determine transition type
    const transitionType = getTransitionType(direction);
    const transitionDuration = 300;
    
    // Start exit transition
    setTransition({
      type: transitionType,
      duration: transitionDuration,
      direction,
    });
    setTransitionState('exiting');
    
    // Calculate new state
    setTimeout(() => {
      let newState: PageState;
      
      if (currentState.direction === 'center') {
        // Going from center to a direction
        const targetPages = getPagesByDirection(direction);
        if (targetPages.length > 0) {
          newState = { direction, index: 0 };
        } else {
          // No pages in that direction, stay at center (for vertical scroll)
          newState = currentState;
        }
      } else {
        // Check if going back to center
        const oppositeDirections: Record<PageDirection, PageDirection> = {
          up: 'down',
          down: 'up',
          left: 'right',
          right: 'left',
          center: 'center',
        };
        
        if (direction === oppositeDirections[currentState.direction]) {
          // Going back to center
          newState = { direction: 'center', index: 0 };
        } else if ((currentState.direction === 'left' || currentState.direction === 'right') &&
                   (direction === 'left' || direction === 'right')) {
          // Navigating within horizontal pages
          const pages = getPagesByDirection(currentState.direction);
          if (direction === currentState.direction) {
            // Continue in same direction (next page)
            newState = {
              direction: currentState.direction,
              index: Math.min(currentState.index + 1, pages.length - 1),
            };
          } else {
            // Going opposite (previous page or back to center)
            if (currentState.index > 0) {
              newState = {
                direction: currentState.direction,
                index: currentState.index - 1,
              };
            } else {
              newState = { direction: 'center', index: 0 };
            }
          }
        } else {
          // Stay in current position
          newState = currentState;
        }
      }
      
      setCurrentState(newState);
      setTransitionState('entering');
      
      // Complete transition
      setTimeout(() => {
        setTransitionState('idle');
        setTransition(null);
        isNavigating.current = false;
      }, transitionDuration);
    }, transitionDuration);
  }, [canNavigate, currentState, getPagesByDirection]);

  // Navigate directly to a page
  const navigateToPage = useCallback((pageId: string) => {
    if (isNavigating.current) return;
    
    const targetPage = pageLayout.pages.find(p => p.id === pageId);
    if (!targetPage) return;
    
    const pagesInDirection = getPagesByDirection(targetPage.direction);
    const pageIndex = pagesInDirection.findIndex(p => p.id === pageId);
    
    if (pageIndex === -1) return;
    
    isNavigating.current = true;
    setTransition({
      type: 'zoom',
      duration: 400,
      direction: targetPage.direction,
    });
    setTransitionState('exiting');
    
    setTimeout(() => {
      setCurrentState({
        direction: targetPage.direction,
        index: pageIndex,
      });
      setTransitionState('entering');
      
      setTimeout(() => {
        setTransitionState('idle');
        setTransition(null);
        isNavigating.current = false;
      }, 400);
    }, 400);
  }, [pageLayout.pages, getPagesByDirection]);

  // Get transition CSS classes
  const getTransitionClasses = useCallback((): string => {
    if (!transition || transitionState === 'idle') return '';
    
    const { type, direction } = transition;
    const isExiting = transitionState === 'exiting';
    
    const classes: string[] = ['transition-all', 'duration-300', 'ease-out'];
    
    if (type === 'slide') {
      if (isExiting) {
        switch (direction) {
          case 'up':
            classes.push('animate-slide-out-up');
            break;
          case 'down':
            classes.push('animate-slide-out-down');
            break;
          case 'left':
            classes.push('animate-slide-out-left');
            break;
          case 'right':
            classes.push('animate-slide-out-right');
            break;
        }
      } else {
        switch (direction) {
          case 'up':
            classes.push('animate-slide-in-from-bottom');
            break;
          case 'down':
            classes.push('animate-slide-in-from-top');
            break;
          case 'left':
            classes.push('animate-slide-in-from-right');
            break;
          case 'right':
            classes.push('animate-slide-in-from-left');
            break;
        }
      }
    } else if (type === 'fade') {
      classes.push(isExiting ? 'animate-fade-out' : 'animate-fade-in');
    } else if (type === 'zoom') {
      classes.push(isExiting ? 'animate-zoom-out' : 'animate-zoom-in');
    }
    
    return classes.join(' ');
  }, [transition, transitionState]);

  // Get transition inline styles (for more precise control)
  // IMPORTANT: Always return visible state when idle to prevent blank screens
  const getTransitionStyles = useCallback((): React.CSSProperties => {
    // Always ensure content is visible when not actively transitioning
    if (!transition || transitionState === 'idle') {
      return { 
        opacity: 1, 
        transform: 'none',
        visibility: 'visible' as const,
      };
    }
    
    const { type, direction, duration } = transition;
    const isExiting = transitionState === 'exiting';
    
    const styles: React.CSSProperties = {
      transitionDuration: `${duration}ms`,
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      visibility: 'visible' as const,
    };
    
    if (type === 'slide') {
      switch (direction) {
        case 'up':
          styles.transform = isExiting ? 'translateY(-100%)' : 'translateY(0)';
          break;
        case 'down':
          styles.transform = isExiting ? 'translateY(100%)' : 'translateY(0)';
          break;
        case 'left':
          styles.transform = isExiting ? 'translateX(-100%)' : 'translateX(0)';
          break;
        case 'right':
          styles.transform = isExiting ? 'translateX(100%)' : 'translateX(0)';
          break;
        default:
          styles.transform = 'none';
      }
      styles.opacity = isExiting ? 0 : 1;
    } else if (type === 'fade') {
      styles.opacity = isExiting ? 0 : 1;
      styles.transform = 'none';
    } else if (type === 'zoom') {
      styles.transform = isExiting ? 'scale(0.9)' : 'scale(1)';
      styles.opacity = isExiting ? 0 : 1;
    } else {
      // Fallback - always visible
      styles.opacity = 1;
      styles.transform = 'none';
    }
    
    return styles;
  }, [transition, transitionState]);

  return {
    currentPage,
    currentState,
    transition,
    transitionState,
    canNavigate,
    navigate,
    navigateToPage,
    getPagesByDirection,
    getTransitionClasses,
    getTransitionStyles,
  };
};

export default usePageNavigation;
