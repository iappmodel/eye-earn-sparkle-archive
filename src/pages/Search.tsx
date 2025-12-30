import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, ArrowLeft, User, Video, Hash, TrendingUp, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'user' | 'content' | 'hashtag';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  count?: number;
}

const Search = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);

  // Load trending tags
  useEffect(() => {
    const loadTrending = async () => {
      const { data } = await supabase
        .from('user_content')
        .select('tags')
        .not('tags', 'is', null)
        .limit(50);
      
      if (data) {
        const tagCounts: Record<string, number> = {};
        data.forEach(item => {
          (item.tags || []).forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        const sorted = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag]) => tag);
        setTrendingTags(sorted);
      }
    };
    loadTrending();
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const allResults: SearchResult[] = [];

    try {
      // Search users
      if (activeTab === 'all' || activeTab === 'users') {
        const { data: users } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url, followers_count')
          .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
          .limit(10);

        users?.forEach(user => {
          allResults.push({
            id: user.user_id,
            type: 'user',
            title: user.display_name || user.username || 'User',
            subtitle: `@${user.username || 'user'} · ${user.followers_count || 0} followers`,
            imageUrl: user.avatar_url || undefined,
          });
        });
      }

      // Search content
      if (activeTab === 'all' || activeTab === 'content') {
        const { data: content } = await supabase
          .from('user_content')
          .select('id, title, caption, thumbnail_url, views_count')
          .eq('is_public', true)
          .or(`title.ilike.%${searchQuery}%,caption.ilike.%${searchQuery}%`)
          .limit(10);

        content?.forEach(item => {
          allResults.push({
            id: item.id,
            type: 'content',
            title: item.title || item.caption?.slice(0, 50) || 'Untitled',
            subtitle: `${item.views_count || 0} views`,
            imageUrl: item.thumbnail_url || undefined,
          });
        });
      }

      // Search hashtags
      if (activeTab === 'all' || activeTab === 'hashtags') {
        const { data: tagContent } = await supabase
          .from('user_content')
          .select('tags')
          .contains('tags', [searchQuery.replace('#', '')])
          .limit(20);

        if (tagContent && tagContent.length > 0) {
          allResults.push({
            id: searchQuery.replace('#', ''),
            type: 'hashtag',
            title: `#${searchQuery.replace('#', '')}`,
            count: tagContent.length,
          });
        }
      }

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query);
      if (query) {
        setSearchParams({ q: query });
      } else {
        setSearchParams({});
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, performSearch]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'user':
        navigate(`/u/${result.id}`);
        break;
      case 'content':
        navigate(`/v/${result.id}`);
        break;
      case 'hashtag':
        navigate(`/tag/${result.title.replace('#', '')}`);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, videos, hashtags..."
              className="pl-10 pr-10"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 max-w-2xl mx-auto">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
            <TabsTrigger value="content" className="flex-1">Videos</TabsTrigger>
            <TabsTrigger value="hashtags" className="flex-1">Tags</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Trending Tags (when no query) */}
        {!query && trendingTags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trending
            </h3>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setQuery(tag)}
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Results */}
        {!isLoading && results.length > 0 && (
          <div className="space-y-2">
            {results.map(result => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
                {result.type === 'user' && (
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={result.imageUrl} />
                    <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                  </Avatar>
                )}
                {result.type === 'content' && (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {result.imageUrl ? (
                      <img src={result.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                )}
                {result.type === 'hashtag' && (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{result.title}</p>
                  {result.subtitle && (
                    <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                  )}
                  {result.count !== undefined && (
                    <p className="text-sm text-muted-foreground">{result.count} posts</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {!isLoading && query && results.length === 0 && (
          <div className="text-center py-12">
            <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No results found for "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
