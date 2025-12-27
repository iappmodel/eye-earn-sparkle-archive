import { useState, useEffect, useCallback } from 'react';

interface QueuedAction {
  id: string;
  type: 'like' | 'follow' | 'task_complete' | 'message' | 'transaction';
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const CACHE_DURATIONS = {
  feed: 60 * 60 * 1000, // 1 hour
  profile: 24 * 60 * 60 * 1000, // 24 hours
  tasks: 30 * 60 * 1000, // 30 minutes
  messages: 15 * 60 * 1000, // 15 minutes
};

const QUEUED_ACTIONS_KEY = 'offline_queued_actions';
const CACHE_PREFIX = 'cache_';

export const useOfflineMode = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Load queued actions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(QUEUED_ACTIONS_KEY);
    if (stored) {
      try {
        setQueuedActions(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing queued actions:', e);
      }
    }
  }, []);

  // Save queued actions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(QUEUED_ACTIONS_KEY, JSON.stringify(queuedActions));
  }, [queuedActions]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Attempt to sync when coming back online
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Queue an action for later sync
  const queueAction = useCallback((
    type: QueuedAction['type'],
    payload: Record<string, unknown>
  ) => {
    const action: QueuedAction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    setQueuedActions(prev => [...prev, action]);
    return action.id;
  }, []);

  // Remove an action from the queue
  const removeFromQueue = useCallback((actionId: string) => {
    setQueuedActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  // Sync pending actions (to be called when online)
  const syncPendingActions = useCallback(async () => {
    if (!navigator.onLine || queuedActions.length === 0 || isSyncing) return;

    setIsSyncing(true);
    const failedActions: QueuedAction[] = [];

    for (const action of queuedActions) {
      try {
        // Process action based on type
        const success = await processQueuedAction(action);
        if (!success && action.retries < 3) {
          failedActions.push({ ...action, retries: action.retries + 1 });
        }
      } catch (error) {
        console.error('Error processing queued action:', error);
        if (action.retries < 3) {
          failedActions.push({ ...action, retries: action.retries + 1 });
        }
      }
    }

    setQueuedActions(failedActions);
    setLastSyncTime(new Date());
    setIsSyncing(false);
  }, [queuedActions, isSyncing]);

  return {
    isOnline,
    isOffline: !isOnline,
    queuedActions,
    queuedCount: queuedActions.length,
    isSyncing,
    lastSyncTime,
    queueAction,
    removeFromQueue,
    syncPendingActions,
  };
};

// Process a queued action - returns true if successful
async function processQueuedAction(action: QueuedAction): Promise<boolean> {
  // Import supabase dynamically to avoid circular dependencies
  const { supabase } = await import('@/integrations/supabase/client');

  switch (action.type) {
    case 'like':
      // Handle like action
      const { error: likeError } = await supabase
        .from('content_interactions')
        .upsert({
          user_id: action.payload.userId as string,
          content_id: action.payload.contentId as string,
          liked: true,
        });
      return !likeError;

    case 'task_complete':
      // Handle task completion
      const { error: taskError } = await supabase
        .from('user_tasks')
        .update({
          progress: action.payload.progress as number,
          completed: action.payload.completed as boolean,
          completed_at: action.payload.completed ? new Date().toISOString() : null,
        })
        .eq('id', action.payload.taskId as string);
      return !taskError;

    case 'transaction':
      // Handle transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert([action.payload as { amount: number; coin_type: string; description: string; type: string; user_id: string }]);
      return !txError;

    default:
      console.warn('Unknown action type:', action.type);
      return true; // Remove unknown actions from queue
  }
}

// Cache utilities
export const cacheUtils = {
  set: <T>(key: string, data: T, type: keyof typeof CACHE_DURATIONS = 'feed') => {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATIONS[type],
    };
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (e) {
      console.error('Cache write error:', e);
      // Clear old cache if storage is full
      clearExpiredCache();
    }
  },

  get: <T>(key: string): T | null => {
    try {
      const stored = localStorage.getItem(CACHE_PREFIX + key);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return entry.data;
    } catch (e) {
      console.error('Cache read error:', e);
      return null;
    }
  },

  remove: (key: string) => {
    localStorage.removeItem(CACHE_PREFIX + key);
  },

  clear: () => {
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  },

  isStale: (key: string): boolean => {
    try {
      const stored = localStorage.getItem(CACHE_PREFIX + key);
      if (!stored) return true;

      const entry = JSON.parse(stored);
      return Date.now() > entry.expiresAt;
    } catch {
      return true;
    }
  },
};

// Clear expired cache entries
function clearExpiredCache() {
  Object.keys(localStorage)
    .filter(key => key.startsWith(CACHE_PREFIX))
    .forEach(key => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const entry = JSON.parse(stored);
          if (Date.now() > entry.expiresAt) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
}

// Hook for cached data fetching
export const useCachedData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  cacheType: keyof typeof CACHE_DURATIONS = 'feed'
) => {
  const [data, setData] = useState<T | null>(() => cacheUtils.get<T>(key));
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(!!data);
  const { isOnline } = useOfflineMode();

  const refresh = useCallback(async (force = false) => {
    // If offline and we have cached data, don't try to fetch
    if (!isOnline && data) {
      return;
    }

    // If we have fresh cached data and not forcing, skip fetch
    if (!force && data && !cacheUtils.isStale(key)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const freshData = await fetcher();
      setData(freshData);
      setIsFromCache(false);
      cacheUtils.set(key, freshData, cacheType);
    } catch (e) {
      setError(e as Error);
      // If fetch fails and we have cached data, use it
      const cached = cacheUtils.get<T>(key);
      if (cached) {
        setData(cached);
        setIsFromCache(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, cacheType, isOnline, data]);

  useEffect(() => {
    refresh();
  }, []);

  // Refresh when coming back online
  useEffect(() => {
    if (isOnline && cacheUtils.isStale(key)) {
      refresh(true);
    }
  }, [isOnline]);

  return {
    data,
    isLoading,
    error,
    isFromCache,
    refresh: () => refresh(true),
  };
};
