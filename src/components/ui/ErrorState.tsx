import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, Lock, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

type ErrorType = 'generic' | 'network' | 'server' | 'notFound' | 'unauthorized' | 'offline';

interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

const errorConfig: Record<ErrorType, { icon: React.ReactNode; title: string; description: string; color: string }> = {
  generic: {
    icon: <AlertTriangle className="w-12 h-12" />,
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again.",
    color: "text-destructive",
  },
  network: {
    icon: <WifiOff className="w-12 h-12" />,
    title: "Connection Error",
    description: "Unable to connect to the server. Check your internet connection.",
    color: "text-amber-500",
  },
  server: {
    icon: <ServerCrash className="w-12 h-12" />,
    title: "Server Error",
    description: "Our servers are having issues. Please try again later.",
    color: "text-destructive",
  },
  notFound: {
    icon: <FileX className="w-12 h-12" />,
    title: "Not Found",
    description: "The content you're looking for doesn't exist or was removed.",
    color: "text-muted-foreground",
  },
  unauthorized: {
    icon: <Lock className="w-12 h-12" />,
    title: "Access Denied",
    description: "You don't have permission to view this content.",
    color: "text-amber-500",
  },
  offline: {
    icon: <WifiOff className="w-12 h-12" />,
    title: "You're Offline",
    description: "Connect to the internet to access this content.",
    color: "text-muted-foreground",
  },
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'generic',
  title,
  description,
  onRetry,
  retryLabel = "Try Again",
  className,
}) => {
  const config = errorConfig[type];
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in",
      className
    )}>
      {/* Icon container with error glow */}
      <div className="relative mb-6">
        <div className={cn(
          "absolute inset-0 rounded-full blur-xl opacity-30 animate-pulse",
          type === 'generic' || type === 'server' ? "bg-destructive" : "bg-amber-500"
        )} />
        <div className={cn(
          "relative w-24 h-24 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-muted/80 to-muted/40",
          "border-2",
          type === 'generic' || type === 'server' ? "border-destructive/50" : "border-amber-500/50"
        )}>
          <span className={config.color}>
            {config.icon}
          </span>
        </div>
      </div>
      
      {/* Title */}
      <h3 className="text-xl font-display font-bold text-foreground mb-2">
        {title || config.title}
      </h3>
      
      {/* Description */}
      <p className="text-muted-foreground text-sm max-w-[280px] mb-6">
        {description || config.description}
      </p>
      
      {/* Retry button */}
      {onRetry && (
        <Button 
          onClick={onRetry}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
