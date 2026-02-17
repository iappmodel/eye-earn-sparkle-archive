import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { aiService } from '@/services/ai.service';

export type SuggestionTone = 'friendly' | 'professional' | 'enthusiastic' | 'concise';

export interface UseAiSuggestionsOptions {
  /** Max retries on failure */
  maxRetries?: number;
  /** Called when suggestions are generated */
  onSuccess?: (suggestions: string[]) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

export interface UseAiSuggestionsResult {
  suggestions: string[];
  isLoading: boolean;
  error: string | null;
  generateSuggestions: (
    message: string,
    context?: {
      conversationHistory?: Array<{ role: string; content: string }>;
      recipientName?: string;
      tone?: SuggestionTone;
    }
  ) => Promise<string[]>;
  clearSuggestions: () => void;
  retry: () => void;
}

const DEFAULT_SUGGESTIONS: string[] = [];
const MAX_RETRIES = 2;

export function useAiSuggestions(options: UseAiSuggestionsOptions = {}): UseAiSuggestionsResult {
  const { maxRetries = MAX_RETRIES, onSuccess, onError } = options;

  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<{
    message: string;
    context?: Parameters<UseAiSuggestionsResult['generateSuggestions']>[1];
  } | null>(null);

  const clearSuggestions = useCallback(() => {
    setSuggestions(DEFAULT_SUGGESTIONS);
    setError(null);
  }, []);

  const showErrorToast = useCallback((msg: string, description?: string) => {
    toast.error(msg, { description });
    onError?.(msg);
  }, [onError]);

  const generateSuggestions = useCallback(
    async (
      message: string,
      context?: {
        conversationHistory?: Array<{ role: string; content: string }>;
        recipientName?: string;
        tone?: SuggestionTone;
      }
    ): Promise<string[]> => {
      if (!message?.trim()) {
        showErrorToast('No message to reply to', 'Select a message first');
        return [];
      }

      setLastParams({ message, context });
      setError(null);
      setIsLoading(true);

      try {
        let lastError: string | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await aiService.generateReplySuggestions({
              message: message.trim(),
              tone: context?.tone ?? 'friendly',
              conversationHistory: context?.conversationHistory,
              recipientName: context?.recipientName,
            });

            if (result.success && result.suggestions?.length) {
              setSuggestions(result.suggestions);
              setError(null);
              onSuccess?.(result.suggestions);
              return result.suggestions;
            }

            if (result.error) {
              lastError = result.error;

              // User-friendly messages for known error codes
              if (result.errorCode === 'RATE_LIMIT') {
                showErrorToast('Too many requests', 'Wait a moment and try again');
                break;
              }
              if (result.errorCode === 'CREDITS_EXHAUSTED') {
                showErrorToast('AI credits exhausted', 'Upgrade your plan for more AI suggestions');
                break;
              }
              if (result.errorCode === 'CONFIG_MISSING') {
                showErrorToast('AI not configured', 'Contact support');
                break;
              }
            }

            // Empty or invalid response
            if (attempt === maxRetries) {
              lastError = lastError ?? 'No suggestions generated';
              showErrorToast('Could not generate suggestions', 'Please try again');
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to generate suggestions';
            lastError = msg;

            if (attempt === maxRetries) {
              showErrorToast('AI suggestions failed', msg);
            }
          }
        }

        setError(lastError);
        setSuggestions(DEFAULT_SUGGESTIONS);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [maxRetries, onSuccess, showErrorToast]
  );

  const retry = useCallback(() => {
    if (lastParams) {
      generateSuggestions(lastParams.message, lastParams.context);
    } else {
      toast.info('No previous request to retry');
    }
  }, [lastParams, generateSuggestions]);

  return {
    suggestions,
    isLoading,
    error,
    generateSuggestions,
    clearSuggestions,
    retry,
  };
}
