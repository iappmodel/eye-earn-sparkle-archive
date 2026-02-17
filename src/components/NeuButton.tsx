import React, { useEffect, useMemo, useState, useCallback, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface NeuButtonProps {
  children: React.ReactNode;
  /**
   * Optional ID used for per-button appearance overrides (saved in localStorage
   * via the long-press settings popover).
   */
  buttonId?: string;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'accent' | 'gold';
  isPressed?: boolean;
  tooltip?: string;
  showTooltipOnHover?: boolean;
  badge?: number | string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizeClasses = {
  sm: '[&>svg]:w-3.5 [&>svg]:h-3.5',
  md: '[&>svg]:w-4 [&>svg]:h-4',
  lg: '[&>svg]:w-5 [&>svg]:h-5',
};

type ButtonSizeOption = 'sm' | 'md' | 'lg';
type ButtonBorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'gradient';
type ButtonShadowStyle = 'none' | 'soft' | 'hard' | 'neon';
type ButtonHoverEffect = 'none' | 'scale' | 'rotate' | 'glow' | 'scale-rotate' | 'lift';
type ButtonAnimationType = 'none' | 'pulse' | 'glow' | 'bounce' | 'shake' | 'float';
type ButtonShapeOption =
  | 'theme'
  | 'rounded'
  | 'pill'
  | 'square'
  | 'circle'
  | 'hex'
  | 'star'
  | 'heart'
  | 'diamond';

const STORAGE_KEYS = {
  sizes: 'visuai-button-sizes',
  colors: 'visuai-button-colors',
  opacity: 'visuai-button-opacity',
  borders: 'visuai-button-borders',
  shadows: 'visuai-button-shadows',
  hovers: 'visuai-button-hovers',
  animations: 'visuai-button-animations',
  shapes: 'visuai-button-shapes',
} as const;

const SETTINGS_EVENTS = [
  'buttonSizesChanged',
  'buttonColorsChanged',
  'buttonOpacitiesChanged',
  'buttonBordersChanged',
  'buttonShadowsChanged',
  'buttonHoversChanged',
  'buttonAnimationsChanged',
  'buttonShapesChanged',
] as const;

function safeLoadMap<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

export const NeuButton = forwardRef<HTMLButtonElement, NeuButtonProps>(({
  children,
  buttonId,
  onClick,
  className,
  size = 'md',
  variant = 'default',
  isPressed = false,
  tooltip,
  showTooltipOnHover = true,
  badge,
  disabled = false,
}, ref) => {
  const [pressed, setPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!buttonId) return;

    const bump = () => setRevision((v) => v + 1);
    SETTINGS_EVENTS.forEach((evt) => window.addEventListener(evt, bump as EventListener));
    window.addEventListener('storage', bump);
    return () => {
      SETTINGS_EVENTS.forEach((evt) => window.removeEventListener(evt, bump as EventListener));
      window.removeEventListener('storage', bump);
    };
  }, [buttonId]);

  const overrides = useMemo(() => {
    if (!buttonId) {
      return null;
    }

    const sizes = safeLoadMap<ButtonSizeOption>(STORAGE_KEYS.sizes);
    const colors = safeLoadMap<string>(STORAGE_KEYS.colors); // "270 95% 65%"
    const opacities = safeLoadMap<number>(STORAGE_KEYS.opacity); // 10-100
    const borders = safeLoadMap<ButtonBorderStyle>(STORAGE_KEYS.borders);
    const shadows = safeLoadMap<ButtonShadowStyle>(STORAGE_KEYS.shadows);
    const hovers = safeLoadMap<ButtonHoverEffect>(STORAGE_KEYS.hovers);
    const animations = safeLoadMap<ButtonAnimationType>(STORAGE_KEYS.animations);
    const shapes = safeLoadMap<ButtonShapeOption>(STORAGE_KEYS.shapes);

    return {
      size: sizes[buttonId],
      color: colors[buttonId],
      opacity: opacities[buttonId],
      hasOpacity: Object.prototype.hasOwnProperty.call(opacities, buttonId),
      border: borders[buttonId],
      shadow: shadows[buttonId],
      hover: hovers[buttonId],
      animation: animations[buttonId],
      shape: shapes[buttonId],
    };
  }, [buttonId, revision]);

  const effectiveSize = (overrides?.size || size) as ButtonSizeOption;

  const handlePressStart = useCallback(() => {
    if (disabled) return;
    setPressed(true);
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [disabled]);

  const handlePressEnd = useCallback(() => {
    setPressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPressed(false);
    setIsHovered(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(e);
  }, [disabled, onClick]);

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

  const customBorder = overrides?.border || 'none';
  const customShadow = overrides?.shadow || 'none';
  const customHover = overrides?.hover || 'none';
  const customAnimation = overrides?.animation || 'none';
  const customShape = overrides?.shape || 'theme';
  const customOpacity = overrides?.opacity ?? 100;
  const customColor = overrides?.color; // HSL string

  const shapeClass =
    customShape === 'theme' ? '' :
    customShape === 'rounded' ? 'btn-shape-rounded' :
    customShape === 'pill' ? 'btn-shape-pill' :
    customShape === 'square' ? 'btn-shape-square' :
    customShape === 'circle' ? 'btn-shape-circle' :
    customShape === 'hex' ? 'btn-shape-hex' :
    customShape === 'star' ? 'btn-shape-star' :
    customShape === 'heart' ? 'btn-shape-heart' :
    customShape === 'diamond' ? 'btn-shape-diamond' :
    '';

  const borderClass =
    customBorder === 'none' ? '' :
    customBorder === 'solid' ? 'border border-foreground/15' :
    customBorder === 'dashed' ? 'border border-dashed border-foreground/25' :
    customBorder === 'dotted' ? 'border border-dotted border-foreground/25' :
    customBorder === 'gradient' ? 'btn-border-gradient' :
    '';

  const shadowClass =
    customShadow === 'none' ? '' :
    customShadow === 'soft' ? 'btn-shadow-soft' :
    customShadow === 'hard' ? 'btn-shadow-hard' :
    customShadow === 'neon' ? 'btn-shadow-neon' :
    '';

  const hoverClass =
    customHover === 'none' ? '' :
    customHover === 'scale' ? 'btn-hover-scale' :
    customHover === 'rotate' ? 'btn-hover-rotate' :
    customHover === 'glow' ? 'btn-hover-glow' :
    customHover === 'scale-rotate' ? 'btn-hover-scale-rotate' :
    customHover === 'lift' ? 'btn-hover-lift' :
    '';

  const animationClass =
    customAnimation === 'none' ? '' :
    customAnimation === 'pulse' ? 'animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]' :
    customAnimation === 'glow' ? 'btn-animate-glow' :
    customAnimation === 'bounce' ? 'animate-bounce' :
    customAnimation === 'shake' ? 'btn-animate-shake' :
    customAnimation === 'float' ? 'btn-animate-float' :
    '';

  return (
    <div className="relative group">
      <button
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          // Base styles
          'rounded-2xl flex items-center justify-center',
          'transition-all duration-200 ease-out',
          'transform-gpu will-change-transform',
          // Size
          sizeClasses[effectiveSize],
          iconSizeClasses[effectiveSize],
          // 3D depth effect
          customShadow === 'none' ? 'shadow-[0_8px_16px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3)]' : '',
          // Neumorphic base
          pressed || isPressed ? 'neu-inset scale-95 translate-y-1' : 'neu-button',
          // Hover 3D lift
          !pressed && !isPressed && !disabled && 'hover:scale-105 hover:-translate-y-0.5',
          // Active press
          !disabled && 'active:scale-95 active:translate-y-1',
          // Accent colors
          accentStyles,
          // Glow on hover
          !disabled && glowStyles,
          // Disabled styles
          disabled && 'opacity-50 cursor-not-allowed',
          // Per-button overrides
          borderClass,
          shadowClass,
          !disabled && hoverClass,
          animationClass,
          shapeClass,
          className
        )}
        style={{
          ...(overrides?.hasOpacity ? ({ ['--btn-alpha' as any]: customOpacity / 100 } as React.CSSProperties) : null),
          ...(customColor
            ? ({
                // Used by glass theme CSS (and safe to ignore elsewhere).
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--btn-tint-hsl' as any]: customColor,
                borderColor:
                  customBorder !== 'none' && customBorder !== 'gradient'
                    ? `hsl(${customColor} / 0.28)`
                    : undefined,
                color: variant === 'default' ? `hsl(${customColor})` : undefined,
              } as React.CSSProperties)
            : null),
        }}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={() => setIsHovered(true)}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
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
});

NeuButton.displayName = 'NeuButton';
