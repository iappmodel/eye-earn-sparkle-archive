// AI Service for Lovable AI Gateway Integration
import { supabase } from '@/integrations/supabase/client';
import type { AISuggestion, AIFeedPreference, MediaContent } from '@/types/app.types';

const AI_FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export type SuggestionTone = 'friendly' | 'professional' | 'enthusiastic' | 'concise';

export interface GenerateReplySuggestionsParams {
  message: string;
  tone?: SuggestionTone;
  conversationHistory?: Array<{ role: string; content: string }>;
  recipientName?: string;
}

export interface GenerateReplySuggestionsResult {
  success: boolean;
  suggestions?: string[];
  error?: string;
  errorCode?: 'RATE_LIMIT' | 'CREDITS_EXHAUSTED' | 'CONFIG_MISSING' | 'NETWORK' | 'PARSE' | 'UNKNOWN';
}

/** Result from ai-content-analyzer / analyzeContent() for tagging, caption, and safety */
export interface ContentAnalysisResult {
  tags: string[];
  category: string;
  quality_score: number;
  content_safety: 'safe' | 'sensitive' | 'adult';
  suggested_hashtags: string[];
  suggested_caption: string | null;
  detected_mood?: string;
}

const DEFAULT_CONTENT_ANALYSIS: ContentAnalysisResult = {
  tags: [],
  category: 'general',
  quality_score: 0,
  content_safety: 'safe',
  suggested_hashtags: [],
  suggested_caption: null,
};

class AIService {
  // Get AI-curated feed recommendations
  async getFeedRecommendations(
    userId: string,
    preferences: AIFeedPreference,
    recentHistory: string[]
  ): Promise<MediaContent[]> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-feed-curator', {
        body: {
          userId,
          preferences,
          recentHistory,
          limit: 20,
        },
      });

      if (error) throw error;
      return data.recommendations || [];
    } catch (error) {
      console.error('[AI] Feed recommendation error:', error);
      return [];
    }
  }

  // Get smart suggestions based on user behavior
  async getSmartSuggestions(
    userId: string,
    context: 'home' | 'map' | 'profile' | 'rewards'
  ): Promise<AISuggestion[]> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggestions', {
        body: {
          userId,
          context,
        },
      });

      if (error) throw error;
      return data.suggestions || [];
    } catch (error) {
      console.error('[AI] Suggestions error:', error);
      return [];
    }
  }

  // Generate quick reply suggestions for chat (generate-reply edge function)
  async generateReplySuggestions(params: GenerateReplySuggestionsParams): Promise<GenerateReplySuggestionsResult> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-reply', {
        body: {
          message: params.message,
          tone: params.tone ?? 'friendly',
          context: params.conversationHistory
            ? params.conversationHistory
                .slice(-10) // Last 10 messages for context
                .map((m) => `${m.role}: ${m.content}`)
                .join('\n')
            : undefined,
          recipientName: params.recipientName,
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message ?? 'Function invocation failed',
          errorCode: 'NETWORK',
        };
      }

      // Handle explicit error responses from edge function
      if (data?.success === false && data?.error) {
        const errorCode =
          data.errorCode === 'RATE_LIMIT'
            ? 'RATE_LIMIT'
            : data.errorCode === 'CREDITS_EXHAUSTED'
              ? 'CREDITS_EXHAUSTED'
              : data.errorCode === 'CONFIG_MISSING'
                ? 'CONFIG_MISSING'
                : 'UNKNOWN';
        return {
          success: false,
          error: data.error,
          errorCode,
        };
      }

      const suggestions = data?.suggestions;
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return {
          success: false,
          error: 'No suggestions returned',
          errorCode: 'PARSE',
        };
      }

      return {
        success: true,
        suggestions: suggestions.slice(0, 3).filter((s): s is string => typeof s === 'string'),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate suggestions';
      return {
        success: false,
        error: message,
        errorCode: 'NETWORK',
      };
    }
  }

  // Generate auto-response for messages
  async generateAutoResponse(
    conversationHistory: Array<{ role: string; content: string }>,
    userContext: Record<string, unknown>
  ): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat-assistant', {
        body: {
          messages: conversationHistory,
          context: userContext,
        },
      });

      if (error) throw error;
      return data.response || '';
    } catch (error) {
      console.error('[AI] Auto-response error:', error);
      return '';
    }
  }

  /** Result from AI content analyzer (tags, category, quality, safety, caption/hashtags) */
  async analyzeContent(
    contentUrl: string,
    contentType: 'video' | 'image',
    options?: { thumbnailUrl?: string; thumbnailUrls?: string[] }
  ): Promise<ContentAnalysisResult> {
    try {
      const body: { contentUrl: string; contentType: 'video' | 'image'; thumbnailUrl?: string; thumbnailUrls?: string[] } = {
        contentUrl,
        contentType,
      };
      if (options?.thumbnailUrls?.length) body.thumbnailUrls = options.thumbnailUrls;
      else if (options?.thumbnailUrl) body.thumbnailUrl = options.thumbnailUrl;

      const { data, error } = await supabase.functions.invoke('ai-content-analyzer', {
        body,
      });

      if (error) throw error;
      const d = data as ContentAnalysisResult | undefined;
      return d && Array.isArray(d.tags)
        ? {
            tags: d.tags,
            category: d.category ?? 'general',
            quality_score: typeof d.quality_score === 'number' ? d.quality_score : 0,
            content_safety: d.content_safety ?? 'safe',
            suggested_hashtags: Array.isArray(d.suggested_hashtags) ? d.suggested_hashtags : [],
            suggested_caption: d.suggested_caption ?? null,
            ...(d.detected_mood && { detected_mood: d.detected_mood }),
          }
        : DEFAULT_CONTENT_ANALYSIS;
    } catch (error) {
      console.error('[AI] Content analysis error:', error);
      return DEFAULT_CONTENT_ANALYSIS;
    }
  }

  // Validate user-uploaded content
  async validateUpload(
    contentUrl: string
  ): Promise<{ valid: boolean; issues: string[]; suggestions: string[] }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-content-validator', {
        body: {
          contentUrl,
        },
      });

      if (error) throw error;
      return data || { valid: true, issues: [], suggestions: [] };
    } catch (error) {
      console.error('[AI] Validation error:', error);
      return { valid: true, issues: [], suggestions: [] };
    }
  }

  // Stream AI chat responses
  async streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    onDelta: (text: string) => void,
    onDone: () => void
  ): Promise<void> {
    const response = await fetch(`${AI_FUNCTIONS_BASE}/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok || !response.body) {
      throw new Error('Failed to start AI stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line.startsWith(':') || line === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          // Incomplete JSON, wait for more data
        }
      }
    }

    onDone();
  }
}

export const aiService = new AIService();
