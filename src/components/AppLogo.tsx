import React from 'react';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  animated?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({ 
  size = 'md', 
  showText = false,
  className,
  animated = true 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 3D "i" Logo */}
      <div 
        className={cn(
          sizeClasses[size],
          'relative flex items-center justify-center',
          animated && 'animate-float-neon'
        )}
      >
        {/* Glow background */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-purple/30 via-neon-magenta/20 to-neon-cyan/10 blur-xl" />
        
        {/* Main logo container */}
        <div className="relative w-full h-full rounded-xl overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-fuchsia-500 to-cyan-400" />
          
          {/* Inner shadow for 3D effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/20" />
          
          {/* The "i" letter */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span 
              className="font-display font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              style={{ 
                fontSize: size === 'sm' ? '1.25rem' : size === 'md' ? '1.5rem' : size === 'lg' ? '2rem' : '2.75rem',
                textShadow: '0 0 20px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              i
            </span>
          </div>
          
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60" />
          
          {/* Bottom reflection */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-white/10 blur-sm" />
        </div>
        
        {/* Outer glow ring */}
        <div className="absolute -inset-1 rounded-xl border border-neon-purple/30 opacity-50" />
      </div>

      {showText && (
        <span 
          className={cn(
            'font-display font-bold gradient-text',
            textSizeClasses[size]
          )}
        >
          viewi
        </span>
      )}
    </div>
  );
};
