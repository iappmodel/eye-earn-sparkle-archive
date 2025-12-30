import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
}

interface ChatSearchProps {
  conversationId: string;
  onResultSelect: (messageId: string) => void;
  onClose: () => void;
}

export const ChatSearch: React.FC<ChatSearchProps> = ({
  conversationId,
  onResultSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at')
        .eq('conversation_id', conversationId)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setResults(data || []);
      setCurrentIndex(0);
      
      // Navigate to first result
      if (data && data.length > 0) {
        onResultSelect(data[0].id);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, onResultSelect]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const navigateResults = (direction: 'up' | 'down') => {
    if (results.length === 0) return;
    
    let newIndex = currentIndex;
    if (direction === 'up' && currentIndex < results.length - 1) {
      newIndex = currentIndex + 1;
    } else if (direction === 'down' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    }
    
    setCurrentIndex(newIndex);
    onResultSelect(results[newIndex].id);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 border-b border-border">
      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
      <Input
        placeholder="Search in conversation..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 h-8 bg-transparent border-none focus-visible:ring-0"
        autoFocus
      />
      
      {results.length > 0 && (
        <span className="text-xs text-muted-foreground shrink-0">
          {currentIndex + 1} of {results.length}
        </span>
      )}
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={() => navigateResults('up')}
          disabled={results.length === 0 || currentIndex >= results.length - 1}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={() => navigateResults('down')}
          disabled={results.length === 0 || currentIndex <= 0}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="w-7 h-7"
        onClick={onClose}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};
