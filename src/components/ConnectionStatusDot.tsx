import React from 'react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { cn } from '@/lib/utils';

interface ConnectionStatusDotProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ConnectionStatusDot: React.FC<ConnectionStatusDotProps> = ({ 
  className, 
  showLabel = false,
  size = 'sm' 
}) => {
  const { isOnline, isSyncing, queuedCount } = useOfflineMode();

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-destructive';
    if (isSyncing) return 'bg-warning animate-pulse';
    if (queuedCount > 0) return 'bg-warning';
    return 'bg-primary';
  };

  const getStatusLabel = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (queuedCount > 0) return `${queuedCount} pending`;
    return 'Online';
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div 
        className={cn(
          "rounded-full",
          sizeClasses[size],
          getStatusColor()
        )}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {getStatusLabel()}
        </span>
      )}
    </div>
  );
};

export default ConnectionStatusDot;
