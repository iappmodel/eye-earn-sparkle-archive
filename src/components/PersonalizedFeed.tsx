import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Play,
  Heart,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  TrendingUp,
  MapPin,
  RefreshCw,
  AlertCircle,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  usePersonalizedFeed,
  type PersonalizedFeedItem,
} from '@/hooks/usePersonalizedFeed';
import { useFeedInteraction } from '@/hooks/useFeedInteraction';

interface PersonalizedFeedProps {
  onSelectContent?: (content: PersonalizedFeedItem) => void;
}

/** Optional one-time geo for "Near you" boost */
function useFeedLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);
  return coords;
}

export const PersonalizedFeed: React.FC<PersonalizedFeedProps> = ({ onSelectContent }) => {
  const { user } = useAuth();
  const location = useFeedLocation();
  const {
    items,
    meta,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  } = usePersonalizedFeed({
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    enabled: true,
  });

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const feedInteraction = useFeedInteraction();
  const { isLiked, handleLike, trackShare, trackFeedback, setLikeCountsFromFeed, getLikeCount, fetchLikeCounts } = feedInteraction;

  // Prime like counts from feed when items load (if backend adds likes_count to items later)
  useEffect(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => {
      if ('likes_count' in i && typeof (i as { likes_count?: number }).likes_count === 'number') {
        counts[i.id] = (i as { likes_count: number }).likes_count;
      }
    });
    if (Object.keys(counts).length > 0) setLikeCountsFromFeed(counts);
  }, [items, setLikeCountsFromFeed]);

  // Fetch like counts from server for visible items so counts display correctly
  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.slice(0, 30).map((i) => i.id);
    fetchLikeCounts(ids);
  }, [items, fetchLikeCounts]);

  const onLike = useCallback(
    async (item: PersonalizedFeedItem) => {
      if (!user) {
        toast.error('Please sign in to personalize your feed');
        return;
      }
      const result = await handleLike(item.id, {
        tags: item.tags,
        category: item.category,
        contentType: item.type === 'image' ? 'image' : 'video',
      });
      if (result.success) {
        if (result.liked) toast.success('Liked! Synced across your feeds');
        else toast('Unliked', { description: 'Removed from favorites' });
      } else {
        toast.error('Could not update like');
      }
    },
    [user, handleLike]
  );

  const onShare = useCallback(
    async (item: PersonalizedFeedItem) => {
      if (!user) {
        toast.error('Please sign in to interact');
        return;
      }
      await trackShare(item.id, {
        tags: item.tags,
        category: item.category,
        contentType: item.type === 'image' ? 'image' : 'video',
      });
      toast.success('Shared! +2 bonus coins');
    },
    [user, trackShare]
  );

  const onFeedback = useCallback(
    async (item: PersonalizedFeedItem, feedback: 'more' | 'less') => {
      if (!user) {
        toast.error('Please sign in to personalize your feed');
        return;
      }
      await trackFeedback(item.id, feedback, {
        tags: item.tags,
        category: item.category,
        contentType: item.type === 'image' ? 'image' : 'video',
      });
      toast.success(
        feedback === 'more' ? 'Showing more like this' : 'Showing less like this'
      );
      setTimeout(() => refresh(), 500);
    },
    [user, trackFeedback, refresh]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filteredItems =
    categoryFilter && categoryFilter !== 'all'
      ? items.filter((i) => i.category === categoryFilter)
      : items;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getReasonIcon = (reason: string) => {
    if (reason.includes('Near')) return <MapPin className="w-3 h-3 shrink-0" />;
    if (reason.includes('Trending')) return <TrendingUp className="w-3 h-3 shrink-0" />;
    if (reason.includes('Discover')) return <Sparkles className="w-3 h-3 shrink-0" />;
    return <Sparkles className="w-3 h-3 shrink-0" />;
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border/50">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 mt-1 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex flex-col gap-4 p-4 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-muted rounded-xl aspect-video w-full" />
              <div className="mt-2 h-4 bg-muted rounded w-3/4" />
              <div className="mt-1 h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-3" />
        <p className="text-sm font-medium">Couldn&apos;t load your feed</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => refresh()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-border/50">
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refresh()}
          disabled={loading}
          aria-label="Refresh feed"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Category chips */}
      {categories.length > 1 && (
        <div className="shrink-0 px-4 py-2 border-b border-border/30 overflow-x-auto">
          <div className="flex gap-2 min-w-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  (categoryFilter === cat || (cat === 'all' && !categoryFilter))
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {cat === 'all' ? 'All' : cat.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed with pull-to-refresh and infinite scroll */}
      <PullToRefresh onRefresh={refresh} disabled={loading} className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Film className="w-12 h-12 text-muted-foreground/60 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No content in this category yet
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Try &quot;All&quot; or pull to refresh
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCategoryFilter(null)}
                >
                  Show all
                </Button>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-card rounded-xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                >
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
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(item.duration)}
                    </div>
                    <div
                      className={cn(
                        'absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1',
                        item.coinType === 'vicoin' ? 'bg-blue-500 text-white' : 'bg-white text-gray-900'
                      )}
                    >
                      <span className="text-sm">{item.coinType === 'vicoin' ? 'V' : 'i'}</span>
                      +{item.reward}
                    </div>
                  </div>

                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      {getReasonIcon(item.reason)}
                      <span>{item.reason}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-muted px-2 py-0.5 rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn('h-8 px-2', isLiked(item.id) && 'text-red-500')}
                          onClick={() => onLike(item)}
                          aria-label={isLiked(item.id) ? 'Unlike' : 'Like'}
                        >
                          <Heart
                            className={cn('w-4 h-4', isLiked(item.id) && 'fill-red-500')}
                          />
                          {getLikeCount(item.id, 0) > 0 && (
                            <span className="ml-1 text-xs tabular-nums">
                              {getLikeCount(item.id, 0)}
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => onShare(item)}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-green-500"
                          onClick={() => onFeedback(item, 'more')}
                        >
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          More
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-red-500"
                          onClick={() => onFeedback(item, 'less')}
                        >
                          <ThumbsDown className="w-3 h-3 mr-1" />
                          Less
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Infinite scroll sentinel */}
            {filteredItems.length > 0 && (
              <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                {loadingMore && (
                  <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                )}
                {!hasMore && items.length > 0 && (
                  <p className="text-xs text-muted-foreground">You&apos;re all caught up</p>
                )}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </div>
  );
};

export default PersonalizedFeed;
