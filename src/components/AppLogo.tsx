import React from 'react';
import { cn } from '@/lib/utils';
import iLogo from '@/assets/i-logo.png';

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
    sm: 'w-8 h-10',
    md: 'w-10 h-12',
    lg: 'w-14 h-16',
    xl: 'w-20 h-24',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 3D "i" Logo Image */}
      <div 
        className={cn(
          sizeClasses[size],
          'relative flex items-center justify-center'
        )}
      >
        {/* Glow background */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-purple/40 via-neon-magenta/30 to-neon-cyan/20 blur-xl scale-150" />
        
        {/* Logo image with screen blend to work on dark backgrounds */}
        <img 
          src={iLogo} 
          alt="i Logo" 
          className="relative w-full h-full object-contain mix-blend-screen"
          style={{
            filter: 'drop-shadow(0 0 15px rgba(168, 85, 247, 0.5)) drop-shadow(0 0 30px rgba(236, 72, 153, 0.3))'
          }}
        />
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
