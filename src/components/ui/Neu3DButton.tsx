import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';

export type VideoTheme = 'purple' | 'magenta' | 'cyan' | 'gold' | 'emerald' | 'rose';

interface Neu3DButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glass' | 'neon' | 'solid';
  theme?: VideoTheme;
  isPressed?: boolean;
  label?: string;
  count?: number | string;
  disabled?: boolean;
  pulse?: boolean;
}

const themeColors: Record<VideoTheme, { 
  glow: string; 
  border: string; 
  bg: string;
  text: string;
  shadow: string;
}> = {
  purple: {
    glow: 'shadow-[0_0_20px_hsl(270_95%_65%/0.4)]',
    border: 'border-[hsl(270,95%,65%,0.4)]',
    bg: 'bg-[hsl(270,95%,65%,0.15)]',
    text: 'text-[hsl(270,95%,75%)]',
    shadow: 'hover:shadow-[0_0_30px_hsl(270_95%_65%/0.6),0_0_60px_hsl(270_95%_65%/0.3)]',
  },
  magenta: {
    glow: 'shadow-[0_0_20px_hsl(320_90%_60%/0.4)]',
    border: 'border-[hsl(320,90%,60%,0.4)]',
    bg: 'bg-[hsl(320,90%,60%,0.15)]',
    text: 'text-[hsl(320,90%,70%)]',
    shadow: 'hover:shadow-[0_0_30px_hsl(320_90%_60%/0.6),0_0_60px_hsl(320_90%_60%/0.3)]',
  },
  cyan: {
    glow: 'shadow-[0_0_20px_hsl(185_100%_50%/0.4)]',
    border: 'border-[hsl(185,100%,50%,0.4)]',
    bg: 'bg-[hsl(185,100%,50%,0.15)]',
    text: 'text-[hsl(185,100%,60%)]',
    shadow: 'hover:shadow-[0_0_30px_hsl(185_100%_50%/0.6),0_0_60px_hsl(185_100%_50%/0.3)]',
  },
  gold: {
    glow: 'shadow-[0_0_20px_hsl(45_100%_55%/0.4)]',
    border: 'border-[hsl(45,100%,55%,0.4)]',
    bg: 'bg-[hsl(45,100%,55%,0.15)]',
    text: 'text-[hsl(45,100%,65%)]',
    shadow: 'hover:shadow-[0_0_30px_hsl(45_100%_55%/0.6),0_0_60px_hsl(45_100%_55%/0.3)]',
  },
  emerald: {
    glow: 'shadow-[0_0_20px_hsl(160_84%_39%/0.4)]',
    border: 'border-[hsl(160,84%,39%,0.4)]',
    bg: 'bg-[hsl(160,84%,39%,0.15)]',
    text: 'text-[hsl(160,84%,49%)]',
    shadow: 'hover:shadow-[0_0_30px_hsl(160_84%_39%/0.6),0_0_60px_hsl(160_84%_39%/0.3)]',
  },
  rose: {
    glow: 'shadow-[0_0_20px_hsl(350_89%_60%/0.4)]',
    border: 'border-[hsl(350,89%,60%,0.4)]',
    bg: 'bg-[hsl(350,89%,60%,0.15)]',
    text: 'text-[hsl(350,89%,70%)]',
    shadow: 'hover:shadow-[0_0_30px_hsl(350_89%_60%/0.6),0_0_60px_hsl(350_89%_60%/0.3)]',
  },
};

const sizeClasses = {
  sm: 'w-11 h-11 [&>svg]:w-5 [&>svg]:h-5',
  md: 'w-14 h-14 [&>svg]:w-6 [&>svg]:h-6',
  lg: 'w-16 h-16 [&>svg]:w-7 [&>svg]:h-7',
};

export const Neu3DButton: React.FC<Neu3DButtonProps> = ({
  children,
  onClick,
  className,
  size = 'md',
  variant = 'glass',
  theme = 'purple',
  isPressed = false,
  label,
  count,
  disabled = false,
  pulse = false,
}) => {
  const { triggerHaptic, reducedMotion } = useAccessibility();
  const [pressed, setPressed] = useState(false);

  const colors = themeColors[theme];
  const isActive = pressed || isPressed;

  const handlePress = useCallback(() => {
    if (disabled) return;
    setPressed(true);
    triggerHaptic('light');
  }, [disabled, triggerHaptic]);

  const handleRelease = useCallback(() => {
    if (disabled) return;
    setPressed(false);
    onClick?.();
  }, [disabled, onClick]);

  const handleMouseLeave = useCallback(() => {
    setPressed(false);
  }, []);

  // Base glass-morphism styles
  const glassBase = cn(
    'backdrop-blur-xl border',
    'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
    'before:absolute before:inset-0 before:rounded-[inherit]',
    'before:bg-gradient-to-b before:from-white/20 before:to-transparent before:opacity-50',
    colors.border,
    colors.glow,
    !reducedMotion && colors.shadow
  );

  // Neon variant with stronger glow
  const neonBase = cn(
    'backdrop-blur-md border-2',
    colors.border,
    colors.bg,
    colors.glow,
    !reducedMotion && 'hover:scale-110',
    !reducedMotion && colors.shadow
  );

  // Solid 3D neumorphic
  const solidBase = cn(
    'bg-gradient-to-br from-secondary/90 to-secondary/60',
    'border border-border/50',
    'shadow-[4px_4px_12px_hsl(0_0%_0%/0.4),-2px_-2px_8px_hsl(0_0%_100%/0.05)]',
    isActive && 'shadow-[inset_2px_2px_6px_hsl(0_0%_0%/0.4),inset_-1px_-1px_4px_hsl(0_0%_100%/0.03)]'
  );

  const variantStyles = {
    default: 'neu-button',
    glass: glassBase,
    neon: neonBase,
    solid: solidBase,
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        disabled={disabled}
        className={cn(
          // Base styles
          'relative rounded-2xl flex items-center justify-center overflow-hidden',
          'transition-all duration-300 ease-out',
          'transform-gpu will-change-transform',
          // Size
          sizeClasses[size],
          // Variant
          variantStyles[variant],
          // 3D transform
          !reducedMotion && !isActive && 'hover:-translate-y-1 hover:scale-105',
          isActive && 'translate-y-0.5 scale-95',
          // Pulse animation
          pulse && !reducedMotion && 'animate-pulse-3d',
          // Text color
          colors.text,
          // Disabled
          disabled && 'opacity-40 cursor-not-allowed',
          className
        )}
        onMouseDown={disabled ? undefined : handlePress}
        onMouseUp={disabled ? undefined : handleRelease}
        onMouseLeave={handleMouseLeave}
        onTouchStart={disabled ? undefined : handlePress}
        onTouchEnd={disabled ? undefined : handleRelease}
      >
        {/* Inner highlight edge */}
        <span 
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-[inherit]"
          aria-hidden="true"
        />
        
        {/* Ambient glow on hover */}
        {!reducedMotion && variant !== 'solid' && (
          <span 
            className={cn(
              'absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300',
              'hover:opacity-100',
              colors.bg
            )}
            aria-hidden="true"
          />
        )}
        
        {/* Content */}
        <span className="relative z-10 text-white drop-shadow-lg">
          {children}
        </span>
      </button>

      {/* Label */}
      {label && (
        <span className={cn(
          'text-xs font-medium tracking-wide',
          colors.text,
          'drop-shadow-[0_0_8px_currentColor]'
        )}>
          {label}
        </span>
      )}

      {/* Count */}
      {count !== undefined && (
        <span className="text-xs font-semibold text-white/80">
          {count}
        </span>
      )}
    </div>
  );
};

export default Neu3DButton;
