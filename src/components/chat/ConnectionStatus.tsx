import React from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnectionStatusType = 'connected' | 'reconnecting' | 'disconnected' | 'closed';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, className }) => {
  if (status === 'connected') return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        status === 'reconnecting' && 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
        status === 'disconnected' && 'bg-destructive/20 text-destructive',
        status === 'closed' && 'bg-muted text-muted-foreground',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {status === 'reconnecting' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Reconnecting…</span>
        </>
      )}
      {(status === 'disconnected' || status === 'closed') && (
        <>
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{status === 'disconnected' ? 'Disconnected' : 'Offline'}</span>
        </>
      )}
    </div>
  );
};
