import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in ms (default: 5 minutes)
  staleTime?: number; // Time before data is considered stale (default: 1 minute)
  cacheKey?: string;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_STALE_TIME = 60 * 1000; // 1 minute

// In-memory cache store
const cacheStore = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data if valid
 */
export function getCached<T>(key: string): { data: T | null; isStale: boolean } {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  
  if (!entry) {
    return { data: null, isStale: true };
  }
  
  const now = Date.now();
  
  // Check if expired
  if (now > entry.expiresAt) {
    cacheStore.delete(key);
    return { data: null, isStale: true };
  }
  
  // Check if stale (but still valid)
  const isStale = now > entry.timestamp + DEFAULT_STALE_TIME;
  
  return { data: entry.data, isStale };
}

/**
 * Set cache entry
 */
export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  const now = Date.now();
  cacheStore.set(key, {
    data,
    timestamp: now,
    expiresAt: now + ttl,
  });
}

/**
 * Invalidate cache entry or entries matching a pattern
 */
export function invalidateCache(keyOrPattern: string | RegExp): void {
  if (typeof keyOrPattern === 'string') {
    cacheStore.delete(keyOrPattern);
  } else {
    for (const key of cacheStore.keys()) {
      if (keyOrPattern.test(key)) {
        cacheStore.delete(key);
      }
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cacheStore.clear();
}

/**
 * Hook for stale-while-revalidate caching pattern
 */
export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const { ttl = DEFAULT_TTL, staleTime = DEFAULT_STALE_TIME } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  const fetchData = useCallback(async (isRevalidation = false) => {
    if (!isRevalidation) {
      setIsLoading(true);
    } else {
      setIsValidating(true);
    }
    setError(null);

    try {
      const result = await fetcher();
      
      if (isMounted.current) {
        setData(result);
        setCache(key, result, ttl);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Fetch failed'));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsValidating(false);
      }
    }
  }, [key, fetcher, ttl]);

  const revalidate = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    const updated = typeof newData === 'function' 
      ? (newData as (prev: T | null) => T)(data)
      : newData;
    setData(updated);
    setCache(key, updated, ttl);
  }, [key, data, ttl]);

  useEffect(() => {
    isMounted.current = true;
    
    // Check cache first
    const { data: cachedData, isStale } = getCached<T>(key);
    
    if (cachedData !== null) {
      setData(cachedData);
      setIsLoading(false);
      
      // Revalidate in background if stale
      if (isStale) {
        fetchData(true);
      }
    } else {
      fetchData();
    }

    return () => {
      isMounted.current = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    isLoading,
    isValidating,
    error,
    revalidate,
    mutate,
  };
}

/**
 * Prefetch and cache data
 */
export async function prefetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<void> {
  try {
    const data = await fetcher();
    setCache(key, data, ttl);
  } catch (e) {
    // Silently fail prefetch
    console.warn('[Cache] Prefetch failed:', key, e);
  }
}

export default {
  getCached,
  setCache,
  invalidateCache,
  clearCache,
  useCachedFetch,
  prefetch,
};
