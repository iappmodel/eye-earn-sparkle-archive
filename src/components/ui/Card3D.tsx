import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';

interface Card3DProps extends React.HTMLAttributes<HTMLDivElement> {
  tiltEnabled?: boolean;
  glowEnabled?: boolean;
  depth?: 'shallow' | 'medium' | 'deep';
  children: React.ReactNode;
}

export const Card3D = React.forwardRef<HTMLDivElement, Card3DProps>(
  ({ className, tiltEnabled = true, glowEnabled = false, depth = 'medium', children, ...props }, ref) => {
    const { reducedMotion } = useAccessibility();
    const cardRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');
    const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion || !tiltEnabled) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;
      
      setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`);
      setGlowPosition({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
    };

    const handleMouseLeave = () => {
      setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)');
    };

    const depthClasses = {
      shallow: 'shadow-[4px_4px_8px_hsl(220_20%_8%),_-4px_-4px_8px_hsl(220_15%_18%)]',
      medium: 'shadow-[8px_8px_16px_hsl(220_20%_8%),_-8px_-8px_16px_hsl(220_15%_18%)]',
      deep: 'shadow-[12px_12px_24px_hsl(220_20%_6%),_-12px_-12px_24px_hsl(220_15%_20%)]',
    };

    return (
      <div
        ref={ref || cardRef}
        className={cn(
          'relative rounded-2xl bg-card border border-border/50 overflow-hidden',
          'transition-all duration-300 ease-out',
          depthClasses[depth],
          glowEnabled && 'animate-depth-pulse',
          className
        )}
        style={{
          transform: reducedMotion ? undefined : transform,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* Ambient glow effect following cursor */}
        {glowEnabled && !reducedMotion && (
          <div
            className="absolute inset-0 pointer-events-none opacity-50 transition-opacity"
            style={{
              background: `radial-gradient(circle at ${glowPosition.x}% ${glowPosition.y}%, hsl(var(--primary) / 0.15) 0%, transparent 50%)`,
            }}
            aria-hidden="true"
          />
        )}
        
        {/* Top edge highlight */}
        <div 
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
          aria-hidden="true"
        />
        
        {/* Content with preserved 3D */}
        <div className="relative" style={{ transform: 'translateZ(20px)' }}>
          {children}
        </div>
      </div>
    );
  }
);

Card3D.displayName = 'Card3D';
