// Offline Status Banner Component
import React from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className }: OfflineBannerProps) {
  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground',
        'px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium',
        'animate-in slide-in-from-top duration-300',
        className
      )}
    >
      <WifiOff className="w-4 h-4" />
      <span>You're offline. Some features may be limited.</span>
    </div>
  );
}
