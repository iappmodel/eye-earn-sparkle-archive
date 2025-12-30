import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
  onSuccess?: () => void;
  onFinalFailure?: (error: Error) => void;
}

interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  lastError: Error | null;
  nextRetryAt: Date | null;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'onRetry' | 'onSuccess' | 'onFinalFailure'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export const useNetworkRetry = <T>(
  request: () => Promise<T>,
  config: RetryConfig = {}
) => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    nextRetryAt: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate delay with exponential backoff and jitter
  const getRetryDelay = useCallback((attempt: number): number => {
    const exponentialDelay = mergedConfig.baseDelay * Math.pow(mergedConfig.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    return Math.min(exponentialDelay + jitter, mergedConfig.maxDelay);
  }, [mergedConfig.baseDelay, mergedConfig.backoffMultiplier, mergedConfig.maxDelay]);

  // Check if error is retryable
  const isRetryableError = useCallback((error: Error): boolean => {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      return true;
    }
    // Timeout errors
    if (error.name === 'AbortError') {
      return true;
    }
    // Server errors (5xx)
    if (error.message.includes('500') || error.message.includes('502') || 
        error.message.includes('503') || error.message.includes('504')) {
      return true;
    }
    // Rate limiting
    if (error.message.includes('429')) {
      return true;
    }
    return false;
  }, []);

  // Execute request with retry logic
  const execute = useCallback(async (): Promise<T | null> => {
    let attempt = 0;
    
    while (attempt <= mergedConfig.maxRetries) {
      try {
        setState(prev => ({ 
          ...prev, 
          isRetrying: attempt > 0,
          retryCount: attempt,
          nextRetryAt: null 
        }));

        const result = await request();
        
        setState(prev => ({ 
          ...prev, 
          isRetrying: false, 
          retryCount: 0,
          lastError: null,
          nextRetryAt: null 
        }));
        
        config.onSuccess?.();
        return result;
        
      } catch (error) {
        const err = error as Error;
        setState(prev => ({ ...prev, lastError: err }));

        if (!isRetryableError(err) || attempt >= mergedConfig.maxRetries) {
          setState(prev => ({ 
            ...prev, 
            isRetrying: false,
            nextRetryAt: null 
          }));
          
          if (attempt >= mergedConfig.maxRetries) {
            config.onFinalFailure?.(err);
            toast.error('Request failed', {
              description: 'Please check your connection and try again.',
            });
          }
          throw err;
        }

        // Wait before retry
        const delay = getRetryDelay(attempt);
        const nextRetry = new Date(Date.now() + delay);
        
        setState(prev => ({ ...prev, nextRetryAt: nextRetry }));
        config.onRetry?.(attempt + 1, err);
        
        await new Promise(resolve => {
          timeoutRef.current = setTimeout(resolve, delay);
        });
        
        attempt++;
      }
    }
    
    return null;
  }, [request, mergedConfig.maxRetries, getRetryDelay, isRetryableError, config]);

  // Cancel ongoing retries
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState(prev => ({ 
      ...prev, 
      isRetrying: false,
      nextRetryAt: null 
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    execute,
    cancel,
    ...state,
  };
};

// Wrapper for fetch with auto-retry
export const fetchWithRetry = async <T>(
  url: string,
  options?: RequestInit & { retryConfig?: RetryConfig }
): Promise<T> => {
  const { retryConfig, ...fetchOptions } = options || {};
  const config = { ...DEFAULT_CONFIG, ...retryConfig };
  
  let attempt = 0;
  
  while (attempt <= config.maxRetries) {
    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
      
    } catch (error) {
      const err = error as Error;
      
      // Check if retryable
      const isRetryable = 
        err.name === 'TypeError' ||
        err.message.includes('500') ||
        err.message.includes('502') ||
        err.message.includes('503') ||
        err.message.includes('504') ||
        err.message.includes('429');
      
      if (!isRetryable || attempt >= config.maxRetries) {
        throw err;
      }
      
      // Wait before retry with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  
  throw new Error('Max retries exceeded');
};

// Hook for handling API calls with automatic retry on failure
export const useApiWithRetry = <T, P extends unknown[]>(
  apiCall: (...args: P) => Promise<T>,
  config?: RetryConfig
) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryInfo, setRetryInfo] = useState({
    attempt: 0,
    nextRetryAt: null as Date | null,
  });

  const execute = useCallback(async (...args: P): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    let attempt = 0;
    
    while (attempt <= mergedConfig.maxRetries) {
      try {
        setRetryInfo({ attempt, nextRetryAt: null });
        const result = await apiCall(...args);
        setData(result);
        setIsLoading(false);
        return result;
        
      } catch (err) {
        const error = err as Error;
        
        if (attempt >= mergedConfig.maxRetries) {
          setError(error);
          setIsLoading(false);
          return null;
        }
        
        const delay = Math.min(
          mergedConfig.baseDelay * Math.pow(mergedConfig.backoffMultiplier, attempt),
          mergedConfig.maxDelay
        );
        
        setRetryInfo({ 
          attempt: attempt + 1, 
          nextRetryAt: new Date(Date.now() + delay) 
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
    
    setIsLoading(false);
    return null;
  }, [apiCall, config]);

  return {
    data,
    error,
    isLoading,
    retryInfo,
    execute,
    reset: () => {
      setData(null);
      setError(null);
      setRetryInfo({ attempt: 0, nextRetryAt: null });
    },
  };
};

export default useNetworkRetry;
