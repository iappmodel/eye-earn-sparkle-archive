import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  message?: string;
  className?: string;
  variant?: 'fullscreen' | 'inline' | 'overlay';
}

export const PageLoader: React.FC<PageLoaderProps> = ({ 
  message = 'Loading...', 
  className,
  variant = 'fullscreen' 
}) => {
  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-8", className)}>
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className={cn(
        "absolute inset-0 bg-background/80 backdrop-blur-sm",
        "flex items-center justify-center z-50",
        className
      )}>
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 bg-background",
      "flex flex-col items-center justify-center gap-4 z-[100]",
      className
    )}>
      {/* Animated loader */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      
      {/* Logo pulse effect */}
      <div className="absolute w-8 h-8 rounded-full bg-primary/20 animate-pulse" />
      
      {/* Message */}
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
};

export default PageLoader;
