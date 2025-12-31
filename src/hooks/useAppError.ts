import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { parseError, AppError, ErrorCode, isRetryableError } from '@/lib/errors';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ErrorHandlerOptions {
  showToast?: boolean;
  haptic?: boolean;
  onRetry?: () => void;
  context?: string;
}

export function useAppError() {
  const haptics = useHapticFeedback();

  const handleError = useCallback((
    error: unknown,
    options: ErrorHandlerOptions = {}
  ): AppError => {
    const { showToast = true, haptic = true, onRetry, context } = options;
    const appError = parseError(error);

    // Log for debugging
    console.error(`[${context || 'App'}] Error:`, appError.code, appError.message, appError.details);

    // Haptic feedback for errors
    if (haptic) {
      haptics.error();
    }

    // Show toast notification
    if (showToast) {
      const toastConfig: Parameters<typeof toast>[0] = {
        title: getErrorTitle(appError.code),
        description: appError.message,
        variant: 'destructive',
      };

      // Add retry action if applicable
      if (isRetryableError(appError) && onRetry) {
        toastConfig.action = {
          label: 'Retry',
          onClick: onRetry,
        } as any;
      }

      toast(toastConfig);
    }

    return appError;
  }, [haptics]);

  const handleSuccess = useCallback((message: string, hapticEnabled = true) => {
    if (hapticEnabled) {
      haptics.success();
    }
    
    toast({
      title: 'Success',
      description: message,
    });
  }, [haptics]);

  const handleWarning = useCallback((message: string, hapticEnabled = true) => {
    if (hapticEnabled) {
      haptics.medium();
    }
    
    toast({
      title: 'Warning',
      description: message,
      variant: 'destructive',
    });
  }, [haptics]);

  // Wrapper for async operations with automatic error handling
  const withErrorHandling = useCallback(<T,>(
    asyncFn: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<T | null> => {
    return asyncFn().catch((error) => {
      handleError(error, options);
      return null;
    });
  }, [handleError]);

  // Try-catch wrapper that returns a result object
  const tryCatch = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<{ data: T | null; error: AppError | null }> => {
    try {
      const data = await asyncFn();
      return { data, error: null };
    } catch (error) {
      const appError = handleError(error, { ...options, showToast: false });
      if (options.showToast !== false) {
        toast({
          title: getErrorTitle(appError.code),
          description: appError.message,
          variant: 'destructive',
        });
      }
      return { data: null, error: appError };
    }
  }, [handleError]);

  return {
    handleError,
    handleSuccess,
    handleWarning,
    withErrorHandling,
    tryCatch,
    parseError,
    isRetryableError,
  };
}

function getErrorTitle(code: ErrorCode): string {
  switch (code) {
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.TIMEOUT:
    case ErrorCode.OFFLINE:
      return 'Connection Error';
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.SESSION_EXPIRED:
    case ErrorCode.INVALID_CREDENTIALS:
      return 'Authentication Error';
    case ErrorCode.FORBIDDEN:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
      return 'Access Denied';
    case ErrorCode.RATE_LIMITED:
    case ErrorCode.TOO_MANY_REQUESTS:
      return 'Slow Down';
    case ErrorCode.INSUFFICIENT_BALANCE:
      return 'Insufficient Balance';
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED:
      return 'Invalid Input';
    default:
      return 'Error';
  }
}

export default useAppError;
