// AI Service for Lovable AI Gateway Integration
import { supabase } from '@/integrations/supabase/client';
import type { AISuggestion, AIFeedPreference, MediaContent } from '@/types/app.types';

const AI_FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

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

  // Analyze content for auto-tagging and categorization
  async analyzeContent(
    contentUrl: string,
    contentType: 'video' | 'image'
  ): Promise<{ tags: string[]; category: string; quality_score: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-content-analyzer', {
        body: {
          contentUrl,
          contentType,
        },
      });

      if (error) throw error;
      return data || { tags: [], category: 'general', quality_score: 0 };
    } catch (error) {
      console.error('[AI] Content analysis error:', error);
      return { tags: [], category: 'general', quality_score: 0 };
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
