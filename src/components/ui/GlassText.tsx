import React from 'react';
import { cn } from '@/lib/utils';
import { VideoTheme } from './Neu3DButton';

interface GlassTextProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  theme?: VideoTheme;
  variant?: 'glow' | 'gradient' | '3d' | 'neon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const themeGradients: Record<VideoTheme, string> = {
  purple: 'from-[hsl(270,95%,75%)] via-[hsl(290,90%,70%)] to-[hsl(320,90%,70%)]',
  magenta: 'from-[hsl(320,90%,70%)] via-[hsl(350,90%,65%)] to-[hsl(10,90%,65%)]',
  cyan: 'from-[hsl(185,100%,60%)] via-[hsl(200,100%,60%)] to-[hsl(220,100%,65%)]',
  gold: 'from-[hsl(45,100%,65%)] via-[hsl(35,100%,60%)] to-[hsl(25,100%,55%)]',
  emerald: 'from-[hsl(160,84%,49%)] via-[hsl(170,84%,45%)] to-[hsl(185,84%,45%)]',
  rose: 'from-[hsl(350,89%,70%)] via-[hsl(330,89%,65%)] to-[hsl(310,89%,65%)]',
};

const themeGlows: Record<VideoTheme, string> = {
  purple: 'drop-shadow-[0_0_20px_hsl(270,95%,65%,0.5)]',
  magenta: 'drop-shadow-[0_0_20px_hsl(320,90%,60%,0.5)]',
  cyan: 'drop-shadow-[0_0_20px_hsl(185,100%,50%,0.5)]',
  gold: 'drop-shadow-[0_0_20px_hsl(45,100%,55%,0.5)]',
  emerald: 'drop-shadow-[0_0_20px_hsl(160,84%,39%,0.5)]',
  rose: 'drop-shadow-[0_0_20px_hsl(350,89%,60%,0.5)]',
};

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export const GlassText: React.FC<GlassTextProps> = ({
  children,
  as: Tag = 'span',
  theme = 'purple',
  variant = 'glow',
  size = 'md',
  className,
}) => {
  const baseStyles = cn(
    'font-display font-bold tracking-wide',
    sizeClasses[size]
  );

  const variantStyles = {
    glow: cn(
      'text-white',
      themeGlows[theme]
    ),
    gradient: cn(
      'bg-gradient-to-r bg-clip-text text-transparent',
      themeGradients[theme],
      themeGlows[theme]
    ),
    '3d': cn(
      'text-white',
      themeGlows[theme],
      '[text-shadow:2px_2px_0_hsl(0_0%_0%/0.3),-1px_-1px_0_hsl(0_0%_100%/0.1)]'
    ),
    neon: cn(
      'bg-gradient-to-r bg-clip-text text-transparent',
      themeGradients[theme],
      themeGlows[theme],
      'animate-pulse'
    ),
  };

  return (
    <Tag className={cn(baseStyles, variantStyles[variant], className)}>
      {children}
    </Tag>
  );
};

export default GlassText;
