// Standardized error handling utilities

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  OFFLINE = 'OFFLINE',
  
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Permission errors
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Business logic errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  ALREADY_CLAIMED = 'ALREADY_CLAIMED',
  EXPIRED = 'EXPIRED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Unknown
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retry?: boolean;
}

// User-friendly error messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Unable to connect. Please check your internet connection.',
  [ErrorCode.TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.OFFLINE]: 'You appear to be offline. Please check your connection.',
  
  [ErrorCode.UNAUTHORIZED]: 'Please sign in to continue.',
  [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [ErrorCode.EMAIL_NOT_VERIFIED]: 'Please verify your email address.',
  
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCode.MISSING_REQUIRED]: 'Please fill in all required fields.',
  
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.ALREADY_EXISTS]: 'This item already exists.',
  [ErrorCode.CONFLICT]: 'A conflict occurred. Please refresh and try again.',
  
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait before trying again.',
  [ErrorCode.TOO_MANY_REQUESTS]: 'You\'ve made too many requests. Please slow down.',
  
  [ErrorCode.FORBIDDEN]: 'You don\'t have permission to do this.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You don\'t have the required permissions.',
  
  [ErrorCode.INSUFFICIENT_BALANCE]: 'Insufficient balance for this transaction.',
  [ErrorCode.ALREADY_CLAIMED]: 'This reward has already been claimed.',
  [ErrorCode.EXPIRED]: 'This item has expired.',
  [ErrorCode.LIMIT_EXCEEDED]: 'You\'ve reached the limit for this action.',
  
  [ErrorCode.INTERNAL_ERROR]: 'Something went wrong. Please try again later.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  
  [ErrorCode.UNKNOWN]: 'An unexpected error occurred.',
};

export function createAppError(
  code: ErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>
): AppError {
  const retryable = [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.TIMEOUT,
    ErrorCode.OFFLINE,
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.SERVICE_UNAVAILABLE,
  ].includes(code);

  return {
    code,
    message: customMessage || ERROR_MESSAGES[code],
    details,
    retry: retryable,
  };
}

export function parseError(error: unknown): AppError {
  // Already an AppError
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return error as AppError;
  }

  // Supabase/Postgres errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as { code: string; message?: string; details?: string };
    
    switch (supabaseError.code) {
      case 'PGRST301':
      case '42501':
        return createAppError(ErrorCode.FORBIDDEN, supabaseError.message);
      case '23505':
        return createAppError(ErrorCode.ALREADY_EXISTS, supabaseError.message);
      case '23503':
        return createAppError(ErrorCode.NOT_FOUND, supabaseError.message);
      case '22P02':
        return createAppError(ErrorCode.INVALID_INPUT, supabaseError.message);
      case 'PGRST116':
        return createAppError(ErrorCode.NOT_FOUND);
      default:
        break;
    }
  }

  // Standard Error object
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return createAppError(ErrorCode.NETWORK_ERROR);
    }
    if (message.includes('timeout')) {
      return createAppError(ErrorCode.TIMEOUT);
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return createAppError(ErrorCode.UNAUTHORIZED);
    }
    if (message.includes('forbidden') || message.includes('403')) {
      return createAppError(ErrorCode.FORBIDDEN);
    }
    if (message.includes('not found') || message.includes('404')) {
      return createAppError(ErrorCode.NOT_FOUND);
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return createAppError(ErrorCode.RATE_LIMITED);
    }
    if (message.includes('balance') || message.includes('insufficient')) {
      return createAppError(ErrorCode.INSUFFICIENT_BALANCE);
    }
    
    return createAppError(ErrorCode.UNKNOWN, error.message);
  }

  // String error
  if (typeof error === 'string') {
    return createAppError(ErrorCode.UNKNOWN, error);
  }

  return createAppError(ErrorCode.UNKNOWN);
}

// Helper to check if error is retryable
export function isRetryableError(error: AppError): boolean {
  return error.retry === true;
}

// Helper to get HTTP status from error code
export function getHttpStatusFromErrorCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.SESSION_EXPIRED:
    case ErrorCode.INVALID_CREDENTIALS:
      return 401;
    case ErrorCode.FORBIDDEN:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
      return 403;
    case ErrorCode.NOT_FOUND:
      return 404;
    case ErrorCode.CONFLICT:
    case ErrorCode.ALREADY_EXISTS:
      return 409;
    case ErrorCode.RATE_LIMITED:
    case ErrorCode.TOO_MANY_REQUESTS:
      return 429;
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED:
      return 400;
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 503;
    default:
      return 500;
  }
}

export default { ErrorCode, createAppError, parseError, isRetryableError };
