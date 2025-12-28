import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';

interface Button3DProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
}

export const Button3D = React.forwardRef<HTMLButtonElement, Button3DProps>(
  ({ className, variant = 'primary', size = 'md', glow = false, pulse = false, children, onClick, ...props }, ref) => {
    const { triggerHaptic, reducedMotion } = useAccessibility();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [isPressed, setIsPressed] = useState(false);
    const [ripplePos, setRipplePos] = useState({ x: 50, y: 50 });

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      triggerHaptic('medium');
      
      // Calculate ripple position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setRipplePos({ x, y });
      
      onClick?.(e);
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm rounded-lg',
      md: 'px-5 py-2.5 text-base rounded-xl',
      lg: 'px-7 py-3.5 text-lg rounded-2xl',
    };

    const variantClasses = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'neu-button text-foreground',
      accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
      ghost: 'bg-transparent hover:bg-muted/50 text-foreground',
    };

    return (
      <button
        ref={ref || buttonRef}
        className={cn(
          'relative font-display font-medium transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-50 disabled:pointer-events-none',
          sizeClasses[size],
          variantClasses[variant],
          !reducedMotion && 'btn-pulse-3d micro-ripple',
          glow && 'animate-glow-ambient',
          pulse && !reducedMotion && 'animate-pulse-3d',
          isPressed && 'scale-95',
          className
        )}
        style={{
          '--ripple-x': `${ripplePos.x}%`,
          '--ripple-y': `${ripplePos.y}%`,
        } as React.CSSProperties}
        onClick={handleClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        {...props}
      >
        {/* 3D depth shadow layer */}
        {!reducedMotion && variant === 'primary' && (
          <span 
            className="absolute inset-0 rounded-[inherit] bg-primary/30 blur-lg -z-10 
                       translate-y-1 group-hover:translate-y-2 transition-transform"
            aria-hidden="true"
          />
        )}
        
        {/* Inner highlight for 3D effect */}
        <span 
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent 
                     via-foreground/20 to-transparent rounded-t-[inherit]"
          aria-hidden="true"
        />
        
        {children}
      </button>
    );
  }
);

Button3D.displayName = 'Button3D';
