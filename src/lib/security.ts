// Security utilities for safe error handling and messages

/**
 * Generic error messages that don't leak implementation details
 */
export const SAFE_ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  INVALID_INPUT: 'Invalid input provided',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  PAYMENT_FAILED: 'Payment could not be processed',
  VALIDATION_FAILED: 'Please check your input and try again',
} as const;

/**
 * Map internal error codes to safe messages
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Map common error patterns to safe messages
    if (message.includes('unauthorized') || message.includes('jwt') || message.includes('token')) {
      return SAFE_ERROR_MESSAGES.UNAUTHORIZED;
    }
    if (message.includes('forbidden') || message.includes('permission')) {
      return SAFE_ERROR_MESSAGES.FORBIDDEN;
    }
    if (message.includes('not found') || message.includes('404')) {
      return SAFE_ERROR_MESSAGES.NOT_FOUND;
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return SAFE_ERROR_MESSAGES.RATE_LIMITED;
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return SAFE_ERROR_MESSAGES.VALIDATION_FAILED;
    }
    if (message.includes('network') || message.includes('fetch')) {
      return SAFE_ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (message.includes('stripe') || message.includes('payment')) {
      return SAFE_ERROR_MESSAGES.PAYMENT_FAILED;
    }
  }
  
  return SAFE_ERROR_MESSAGES.SERVER_ERROR;
}

/**
 * Check if error should be logged (contains sensitive info that shouldn't be shown to users)
 */
export function isSensitiveError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const sensitivePatterns = [
    /supabase/i,
    /postgres/i,
    /database/i,
    /sql/i,
    /stripe.*key/i,
    /api.*key/i,
    /secret/i,
    /password/i,
    /credential/i,
    /internal/i,
    /stack/i,
    /trace/i,
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Sanitize error for client response - removes sensitive details
 */
export function sanitizeErrorForClient(error: unknown): { message: string; code?: string } {
  const safeMessage = getSafeErrorMessage(error);
  
  // Only include error code if it's a known safe code
  const safeCode = error instanceof Error && 'code' in error 
    ? getSafeErrorCode(String((error as { code?: string }).code))
    : undefined;
  
  return {
    message: safeMessage,
    ...(safeCode && { code: safeCode }),
  };
}

/**
 * Map internal error codes to safe external codes
 */
function getSafeErrorCode(internalCode: string): string | undefined {
  const safeCodeMap: Record<string, string> = {
    'PGRST116': 'NOT_FOUND',
    '23505': 'DUPLICATE',
    '23503': 'REFERENCE_ERROR',
    '42501': 'FORBIDDEN',
    'auth/invalid-credentials': 'INVALID_CREDENTIALS',
    'auth/user-not-found': 'USER_NOT_FOUND',
    'auth/email-already-exists': 'EMAIL_EXISTS',
  };
  
  return safeCodeMap[internalCode];
}

/**
 * Create a safe error response for edge functions
 */
export function createSafeErrorResponse(
  error: unknown, 
  corsHeaders: Record<string, string>,
  statusCode = 500
): Response {
  const { message, code } = sanitizeErrorForClient(error);
  
  // Log the full error server-side for debugging
  console.error('[SECURITY] Safe error response generated:', {
    originalError: error instanceof Error ? error.message : String(error),
    safeMessage: message,
    statusCode,
  });
  
  return new Response(
    JSON.stringify({ 
      error: message, 
      success: false,
      ...(code && { code }),
    }),
    { 
      status: statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

export default {
  SAFE_ERROR_MESSAGES,
  getSafeErrorMessage,
  isSensitiveError,
  sanitizeErrorForClient,
  createSafeErrorResponse,
};
