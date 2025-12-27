import React, { useState, useEffect } from 'react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  WifiOff, 
  RefreshCw, 
  Cloud,
  CloudOff,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className }: OfflineBannerProps) {
  const { 
    isOnline, 
    isOffline, 
    queuedCount, 
    isSyncing, 
    syncPendingActions 
  } = useOfflineMode();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // Just came back online
      setShowSyncSuccess(true);
      setTimeout(() => {
        setShowBanner(false);
        setShowSyncSuccess(false);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOnline, isOffline, wasOffline]);

  // Show banner if there are queued actions
  useEffect(() => {
    if (queuedCount > 0) {
      setShowBanner(true);
    }
  }, [queuedCount]);

  if (!showBanner && queuedCount === 0) return null;

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-transform duration-300",
        showBanner ? "translate-y-0" : "-translate-y-full",
        className
      )}
    >
      <div 
        className={cn(
          "px-4 py-2 flex items-center justify-between gap-3",
          isOffline 
            ? "bg-destructive text-destructive-foreground" 
            : showSyncSuccess 
              ? "bg-primary text-primary-foreground"
              : "bg-warning text-warning-foreground"
        )}
      >
        <div className="flex items-center gap-2">
          {isOffline ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">You're offline</span>
            </>
          ) : showSyncSuccess ? (
            <>
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Back online!</span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4" />
              <span className="text-sm font-medium">
                {queuedCount} action{queuedCount !== 1 ? 's' : ''} pending
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {queuedCount > 0 && isOnline && (
            <Button
              size="sm"
              variant="secondary"
              onClick={syncPendingActions}
              disabled={isSyncing}
              className="h-7 text-xs"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 mr-1" />
                  Sync now
                </>
              )}
            </Button>
          )}
          
          {isOffline && (
            <Badge variant="outline" className="bg-background/20 text-current border-current/30">
              Changes will sync when online
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfflineBanner;
