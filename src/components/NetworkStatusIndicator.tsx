import React, { useState, useEffect } from 'react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  RefreshCw,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NetworkStatusIndicatorProps {
  variant?: 'minimal' | 'badge' | 'full';
  showSyncButton?: boolean;
  className?: string;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  variant = 'minimal',
  showSyncButton = false,
  className,
}) => {
  const { 
    isOnline, 
    queuedCount, 
    isSyncing, 
    syncPendingActions,
    lastSyncTime 
  } = useOfflineMode();
  
  const [connectionQuality, setConnectionQuality] = useState<'poor' | 'medium' | 'good'>('good');
  const [showStatus, setShowStatus] = useState(false);

  // Monitor connection quality using Network Information API
  useEffect(() => {
    const connection = (navigator as any).connection;
    if (connection) {
      const updateQuality = () => {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') {
          setConnectionQuality('good');
        } else if (effectiveType === '3g') {
          setConnectionQuality('medium');
        } else {
          setConnectionQuality('poor');
        }
      };

      updateQuality();
      connection.addEventListener('change', updateQuality);
      return () => connection.removeEventListener('change', updateQuality);
    }
  }, []);

  // Show status briefly when connection state changes
  useEffect(() => {
    setShowStatus(true);
    const timer = setTimeout(() => setShowStatus(false), 3000);
    return () => clearTimeout(timer);
  }, [isOnline]);

  const getSignalIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (connectionQuality === 'poor') return <SignalLow className="w-4 h-4" />;
    if (connectionQuality === 'medium') return <SignalMedium className="w-4 h-4" />;
    return <SignalHigh className="w-4 h-4" />;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-destructive';
    if (connectionQuality === 'poor') return 'text-orange-500';
    if (connectionQuality === 'medium') return 'text-yellow-500';
    return 'text-green-500';
  };

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1.5 transition-opacity duration-300",
              showStatus || !isOnline ? "opacity-100" : "opacity-0",
              className
            )}>
              <div className={cn("relative", getStatusColor())}>
                {getSignalIcon()}
                {queuedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-[8px] text-primary-foreground rounded-full flex items-center justify-center">
                    {queuedCount}
                  </span>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isOnline 
                ? `Online (${connectionQuality} connection)` 
                : 'Offline'
              }
              {queuedCount > 0 && ` • ${queuedCount} pending`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'badge') {
    if (isOnline && queuedCount === 0) return null;
    
    return (
      <Badge 
        variant={isOnline ? 'secondary' : 'destructive'}
        className={cn("gap-1.5", className)}
      >
        {!isOnline && <WifiOff className="w-3 h-3" />}
        {isOnline && queuedCount > 0 && (
          isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudOff className="w-3 h-3" />
        )}
        <span className="text-xs">
          {!isOnline && 'Offline'}
          {isOnline && queuedCount > 0 && (
            isSyncing ? 'Syncing...' : `${queuedCount} pending`
          )}
        </span>
      </Badge>
    );
  }

  // Full variant
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl transition-colors",
      isOnline ? 'bg-primary/10' : 'bg-destructive/10',
      className
    )}>
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center",
        isOnline ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
      )}>
        {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {isOnline ? 'Connected' : 'Offline'}
          </span>
          {isOnline && connectionQuality !== 'good' && (
            <Badge variant="outline" className="text-xs">
              {connectionQuality} signal
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {!isOnline && 'Changes will sync when back online'}
          {isOnline && queuedCount > 0 && `${queuedCount} changes pending sync`}
          {isOnline && queuedCount === 0 && lastSyncTime && (
            `Last synced ${formatTimeAgo(lastSyncTime)}`
          )}
        </p>
      </div>

      {showSyncButton && isOnline && queuedCount > 0 && (
        <Button
          size="sm"
          variant="secondary"
          onClick={syncPendingActions}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      )}
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export default NetworkStatusIndicator;
