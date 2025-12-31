import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useAppError } from '@/hooks/useAppError';
import { AppError } from '@/lib/errors';

interface UseDataQueryOptions<TData> extends Omit<UseQueryOptions<TData, AppError>, 'queryFn'> {
  queryFn: () => Promise<TData>;
  onSuccess?: (data: TData) => void;
  onError?: (error: AppError) => void;
  showErrorToast?: boolean;
  retryOnError?: boolean;
}

interface DataQueryResult<TData> extends Omit<UseQueryResult<TData, AppError>, 'error'> {
  error: AppError | null;
  isEmpty: boolean;
  isLoadingInitial: boolean;
}

/**
 * Enhanced data fetching hook with consistent loading, error, and empty states.
 * Integrates with the app's error handling system.
 */
export function useDataQuery<TData>({
  queryFn,
  onSuccess,
  onError,
  showErrorToast = true,
  retryOnError = true,
  ...options
}: UseDataQueryOptions<TData>): DataQueryResult<TData> {
  const { handleError, parseError } = useAppError();

  const query = useQuery<TData, AppError>({
    ...options,
    queryFn: async () => {
      try {
        const data = await queryFn();
        onSuccess?.(data);
        return data;
      } catch (err) {
        const appError = parseError(err);
        
        if (showErrorToast) {
          handleError(appError, { showToast: true });
        }
        
        onError?.(appError);
        throw appError;
      }
    },
    retry: retryOnError ? 2 : false,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Determine if data is empty
  const isEmpty = (() => {
    if (query.isLoading || query.isError) return false;
    if (!query.data) return true;
    if (Array.isArray(query.data)) return query.data.length === 0;
    if (typeof query.data === 'object') return Object.keys(query.data).length === 0;
    return false;
  })();

  // Initial loading (no data yet)
  const isLoadingInitial = query.isLoading && !query.data;

  return {
    ...query,
    error: query.error ?? null,
    isEmpty,
    isLoadingInitial,
  };
}

/**
 * Hook for paginated/infinite data with consistent states
 */
export function usePaginatedQuery<TData, TItem>({
  queryFn,
  getItems,
  ...options
}: UseDataQueryOptions<TData> & {
  getItems: (data: TData) => TItem[];
}) {
  const result = useDataQuery({ queryFn, ...options });
  
  const items = result.data ? getItems(result.data) : [];
  const isEmpty = !result.isLoading && items.length === 0;

  return {
    ...result,
    items,
    isEmpty,
    itemCount: items.length,
  };
}

export default useDataQuery;
