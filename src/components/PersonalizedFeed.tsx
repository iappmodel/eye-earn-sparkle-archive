import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Play, Heart, Share2, ThumbsUp, ThumbsDown, Sparkles, TrendingUp, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FeedItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  reward: number;
  coinType: 'icoin' | 'vicoin';
  thumbnail: string;
  duration: number;
  score: number;
  reason: string;
  position: number;
  personalized: boolean;
}

interface FeedMeta {
  userId: string | null;
  personalized: boolean;
  interactionCount: number;
  coldStart: boolean;
}

interface PersonalizedFeedProps {
  onSelectContent?: (content: FeedItem) => void;
}

export const PersonalizedFeed: React.FC<PersonalizedFeedProps> = ({ onSelectContent }) => {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-personalized-feed', {
        body: {},
      });

      if (error) throw error;

      if (data?.feed) {
        setFeed(data.feed);
        setMeta(data.meta);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      toast.error('Failed to load personalized feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleInteraction = async (contentId: string, action: 'like' | 'unlike' | 'share' | 'feedback', feedback?: 'more' | 'less') => {
    if (!user) {
      toast.error('Please sign in to personalize your feed');
      return;
    }

    const item = feed.find(f => f.id === contentId);
    if (!item) return;

    try {
      await supabase.functions.invoke('track-interaction', {
        body: {
          contentId,
          contentType: 'video',
          action,
          feedback,
          tags: item.tags,
          category: item.category,
        },
      });

      if (action === 'like') {
        setLikedItems(prev => new Set([...prev, contentId]));
        toast.success('Added to your likes!');
      } else if (action === 'unlike') {
        setLikedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(contentId);
          return newSet;
        });
      } else if (action === 'share') {
        toast.success('Shared! +2 bonus coins');
      } else if (action === 'feedback') {
        toast.success(feedback === 'more' ? 'Showing more like this' : 'Showing less like this');
        // Refresh feed after feedback
        setTimeout(loadFeed, 500);
      }
    } catch (error) {
      console.error('Interaction error:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getReasonIcon = (reason: string) => {
    if (reason.includes('Near')) return <MapPin className="w-3 h-3" />;
    if (reason.includes('Trending')) return <TrendingUp className="w-3 h-3" />;
    if (reason.includes('Discover')) return <Sparkles className="w-3 h-3" />;
    return <Sparkles className="w-3 h-3" />;
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="bg-muted rounded-xl h-48 w-full" />
            <div className="mt-2 h-4 bg-muted rounded w-3/4" />
            <div className="mt-1 h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            For You
          </h2>
          <p className="text-xs text-muted-foreground">
            {meta?.personalized 
              ? `Personalized from ${meta.interactionCount} interactions` 
              : meta?.coldStart 
                ? 'Trending content to get you started'
                : 'Curated just for you'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadFeed} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {feed.map((item) => (
            <div
              key={item.id}
              className="bg-card rounded-xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div 
                className="relative aspect-video bg-muted cursor-pointer group"
                onClick={() => onSelectContent?.(item)}
              >
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-8 h-8 text-primary fill-primary" />
                  </div>
                </div>
                
                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(item.duration)}
                </div>

                {/* Reward badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                  item.coinType === 'vicoin' ? 'bg-blue-500 text-white' : 'bg-white text-gray-900'
                }`}>
                  <span className="text-sm">{item.coinType === 'vicoin' ? 'V' : 'i'}</span>
                  +{item.reward}
                </div>
              </div>

              {/* Content Info */}
              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
                
                {/* Reason tag */}
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  {getReasonIcon(item.reason)}
                  <span>{item.reason}</span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 px-2 ${likedItems.has(item.id) ? 'text-red-500' : ''}`}
                      onClick={() => handleInteraction(item.id, likedItems.has(item.id) ? 'unlike' : 'like')}
                    >
                      <Heart className={`w-4 h-4 ${likedItems.has(item.id) ? 'fill-red-500' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => handleInteraction(item.id, 'share')}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Feedback buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-green-500"
                      onClick={() => handleInteraction(item.id, 'feedback', 'more')}
                    >
                      <ThumbsUp className="w-3 h-3 mr-1" />
                      More
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-red-500"
                      onClick={() => handleInteraction(item.id, 'feedback', 'less')}
                    >
                      <ThumbsDown className="w-3 h-3 mr-1" />
                      Less
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonalizedFeed;
