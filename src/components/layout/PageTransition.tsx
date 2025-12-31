import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  const location = useLocation();

  // NOTE: Previously we compared `children` by reference and ran an exit/enter state machine.
  // In React, `children` can be a new element every render (even on the same route), which can
  // keep the wrapper stuck at `opacity-0` on frequent re-renders (appears as a blank screen).
  // Keying by route avoids that while still giving a smooth page fade-in.
  return (
    <div
      key={location.key}
      className={cn(
        'w-full transition-opacity duration-200 ease-out animate-fade-in motion-reduce:animate-none',
        className
      )}
    >
      {children}
    </div>
  );
};


// Slide transition for horizontal navigation
export const SlideTransition: React.FC<PageTransitionProps & { direction?: 'left' | 'right' }> = ({ 
  children, 
  className,
  direction = 'right',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isVisible 
          ? "opacity-100 translate-x-0" 
          : direction === 'right' 
            ? "opacity-0 translate-x-8" 
            : "opacity-0 -translate-x-8",
        className
      )}
    >
      {children}
    </div>
  );
};

// Fade up transition for modals/sheets
export const FadeUpTransition: React.FC<PageTransitionProps & { isOpen: boolean }> = ({ 
  children, 
  className,
  isOpen,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isOpen 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 translate-y-4",
        className
      )}
    >
      {children}
    </div>
  );
};

// Scale transition for popups/tooltips
export const ScaleTransition: React.FC<PageTransitionProps & { isOpen: boolean; origin?: string }> = ({ 
  children, 
  className,
  isOpen,
  origin = 'center',
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "transition-all duration-200 ease-out",
        isOpen 
          ? "opacity-100 scale-100" 
          : "opacity-0 scale-95",
        className
      )}
      style={{ transformOrigin: origin }}
    >
      {children}
    </div>
  );
};
