import React from 'react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Cloud, 
  CloudOff,
  Clock,
  Check,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SyncStatusPanel: React.FC = () => {
  const { 
    isOnline, 
    queuedActions,
    queuedCount, 
    isSyncing, 
    lastSyncTime,
    syncPendingActions,
    removeFromQueue
  } = useOfflineMode();

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'like': return '❤️';
      case 'follow': return '👤';
      case 'task_complete': return '✅';
      case 'message': return '💬';
      case 'transaction': return '💰';
      default: return '📝';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-primary" />
            ) : (
              <WifiOff className="w-5 h-5 text-destructive" />
            )}
            Sync Status
          </div>
          <Badge variant={isOnline ? 'default' : 'destructive'}>
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Cloud className="w-4 h-4 text-primary" />
            ) : (
              <CloudOff className="w-4 h-4 text-destructive" />
            )}
            <span className="text-sm">
              {isOnline ? 'Connected to server' : 'Working offline'}
            </span>
          </div>
          {lastSyncTime && (
            <span className="text-xs text-muted-foreground">
              Last sync: {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Pending Actions */}
        {queuedCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                Pending Actions ({queuedCount})
              </h4>
              {isOnline && (
                <Button
                  size="sm"
                  onClick={syncPendingActions}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Sync All
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto">
              {queuedActions.slice(0, 10).map((action) => (
                <div 
                  key={action.id}
                  className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{getActionIcon(action.type)}</span>
                    <span className="capitalize">{action.type.replace('_', ' ')}</span>
                    {action.retries > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Retry {action.retries}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeFromQueue(action.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {queuedCount > 10 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  +{queuedCount - 10} more actions
                </p>
              )}
            </div>
          </div>
        )}

        {/* All Synced */}
        {queuedCount === 0 && isOnline && (
          <div className="flex items-center justify-center gap-2 py-4 text-primary">
            <Check className="w-5 h-5" />
            <span className="text-sm font-medium">All changes synced</span>
          </div>
        )}

        {/* Offline Message */}
        {!isOnline && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              You're currently offline. Your changes will be saved locally and synced when you reconnect.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncStatusPanel;
