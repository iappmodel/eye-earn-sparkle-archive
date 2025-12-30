import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit' | 'idle'>('idle');

  useEffect(() => {
    if (children !== displayChildren) {
      setTransitionStage('exit');
      
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage('enter');
        
        const enterTimer = setTimeout(() => {
          setTransitionStage('idle');
        }, 300);
        
        return () => clearTimeout(enterTimer);
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [children, displayChildren]);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        transitionStage === 'exit' && "opacity-0 scale-[0.98] translate-y-2",
        transitionStage === 'enter' && "opacity-100 scale-100 translate-y-0 animate-fade-in",
        transitionStage === 'idle' && "opacity-100 scale-100 translate-y-0",
        className
      )}
    >
      {displayChildren}
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
