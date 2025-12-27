import React, { createContext, useContext, ReactNode } from 'react';
import { useOfflineMode, cacheUtils } from '@/hooks/useOfflineMode';

interface OfflineContextType {
  isOnline: boolean;
  isOffline: boolean;
  queuedCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  queueAction: (type: 'like' | 'follow' | 'task_complete' | 'message' | 'transaction', payload: Record<string, unknown>) => string;
  syncPendingActions: () => Promise<void>;
  cache: typeof cacheUtils;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const offlineMode = useOfflineMode();

  const value: OfflineContextType = {
    isOnline: offlineMode.isOnline,
    isOffline: offlineMode.isOffline,
    queuedCount: offlineMode.queuedCount,
    isSyncing: offlineMode.isSyncing,
    lastSyncTime: offlineMode.lastSyncTime,
    queueAction: offlineMode.queueAction,
    syncPendingActions: offlineMode.syncPendingActions,
    cache: cacheUtils,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};
