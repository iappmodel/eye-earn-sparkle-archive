import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface NeuButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'accent' | 'gold';
  isPressed?: boolean;
  tooltip?: string;
  showTooltipOnHover?: boolean;
  badge?: number | string;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-14 h-14',
  lg: 'w-18 h-18',
};

const iconSizeClasses = {
  sm: '[&>svg]:w-5 [&>svg]:h-5',
  md: '[&>svg]:w-6 [&>svg]:h-6',
  lg: '[&>svg]:w-7 [&>svg]:h-7',
};

export const NeuButton: React.FC<NeuButtonProps> = ({
  children,
  onClick,
  className,
  size = 'md',
  variant = 'default',
  isPressed = false,
  tooltip,
  showTooltipOnHover = true,
  badge,
}) => {
  const [pressed, setPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handlePress = useCallback(() => {
    setPressed(true);
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const handleRelease = useCallback(() => {
    setPressed(false);
    onClick?.();
  }, [onClick]);

  const handleMouseLeave = useCallback(() => {
    setPressed(false);
    setIsHovered(false);
  }, []);

  const accentStyles = variant === 'accent' 
    ? 'text-primary border border-primary/30 shadow-primary/20' 
    : variant === 'gold' 
    ? 'text-icoin border border-icoin/30 shadow-icoin/20' 
    : 'text-foreground';

  const glowStyles = variant === 'accent'
    ? 'hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
    : variant === 'gold'
    ? 'hover:shadow-[0_0_20px_hsl(var(--icoin)/0.3)]'
    : 'hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]';

  return (
    <div className="relative group">
      <button
        className={cn(
          // Base styles
          'rounded-2xl flex items-center justify-center',
          'transition-all duration-200 ease-out',
          'transform-gpu will-change-transform',
          // Size
          sizeClasses[size],
          iconSizeClasses[size],
          // 3D depth effect
          'shadow-[0_8px_16px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3)]',
          // Neumorphic base
          pressed || isPressed ? 'neu-inset scale-95 translate-y-1' : 'neu-button',
          // Hover 3D lift
          !pressed && !isPressed && 'hover:scale-105 hover:-translate-y-0.5',
          // Active press
          'active:scale-95 active:translate-y-1',
          // Accent colors
          accentStyles,
          // Glow on hover
          glowStyles,
          className
        )}
        onMouseDown={handlePress}
        onMouseUp={handleRelease}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={() => setIsHovered(true)}
        onTouchStart={handlePress}
        onTouchEnd={handleRelease}
      >
        {/* Inner glow effect for accent variants */}
        {(variant === 'accent' || variant === 'gold') && (
          <div className={cn(
            'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300',
            'group-hover:opacity-100',
            variant === 'accent' ? 'bg-primary/10' : 'bg-icoin/10'
          )} />
        )}
        
        {/* Icon content */}
        <div className="relative z-10">
          {children}
        </div>
      </button>

      {/* Badge indicator */}
      {badge !== undefined && (
        <div className={cn(
          'absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full',
          'flex items-center justify-center',
          'text-xs font-bold',
          'animate-scale-in',
          variant === 'gold' 
            ? 'bg-icoin text-primary-foreground' 
            : 'bg-primary text-primary-foreground'
        )}>
          {badge}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && showTooltipOnHover && isHovered && (
        <div className={cn(
          'absolute right-full mr-3 top-1/2 -translate-y-1/2',
          'px-3 py-1.5 rounded-lg',
          'bg-background/90 backdrop-blur-md border border-border/50',
          'text-sm text-foreground whitespace-nowrap',
          'shadow-lg',
          'animate-fade-in',
          'pointer-events-none z-50'
        )}>
          {tooltip}
          {/* Arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45 w-2 h-2 bg-background/90 border-r border-t border-border/50" />
        </div>
      )}
    </div>
  );
};
