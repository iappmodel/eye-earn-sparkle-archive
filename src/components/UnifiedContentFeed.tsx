import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImportedMediaRealtime } from '@/hooks/useImportedMediaRealtime';
import { 
  Play, Heart, Share2, ThumbsUp, ThumbsDown, Sparkles, TrendingUp, 
  MapPin, RefreshCw, Instagram, Youtube, Facebook, Music2, Camera, 
  Tv2, Twitter, ExternalLink, Video, Globe, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface NativeFeedItem {
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
  source: 'native';
}

interface ImportedFeedItem {
  id: string;
  title: string | null;
  description: string | null;
  platform: string;
  original_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  original_views: number | null;
  original_likes: number | null;
  media_type: string;
  imported_at: string;
  status: string;
  source: 'imported';
}

type UnifiedFeedItem = NativeFeedItem | ImportedFeedItem;

interface UnifiedContentFeedProps {
  onSelectContent?: (content: UnifiedFeedItem) => void;
  showOnlyImported?: boolean;
}

const PLATFORM_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  instagram: { 
    icon: <Instagram className="w-3 h-3" />, 
    color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    label: 'Instagram'
  },
  tiktok: { 
    icon: <Music2 className="w-3 h-3" />, 
    color: 'bg-black',
    label: 'TikTok'
  },
  youtube: { 
    icon: <Youtube className="w-3 h-3" />, 
    color: 'bg-red-600',
    label: 'YouTube'
  },
  facebook: { 
    icon: <Facebook className="w-3 h-3" />, 
    color: 'bg-blue-600',
    label: 'Facebook'
  },
  twitch: { 
    icon: <Tv2 className="w-3 h-3" />, 
    color: 'bg-purple-600',
    label: 'Twitch'
  },
  twitter: { 
    icon: <Twitter className="w-3 h-3" />, 
    color: 'bg-black',
    label: 'X/Twitter'
  },
  snapchat: {
    icon: <Camera className="w-3 h-3" />,
    color: 'bg-yellow-400',
    label: 'Snapchat'
  },
  other: {
    icon: <Globe className="w-3 h-3" />,
    color: 'bg-muted',
    label: 'Other'
  }
};

export const UnifiedContentFeed: React.FC<UnifiedContentFeedProps> = ({ 
  onSelectContent,
  showOnlyImported = false 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feed, setFeed] = useState<UnifiedFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'native' | 'imported'>('all');

  // Real-time updates for imported media (callbacks must be stable to avoid re-subscribing every render)
  const handleRealtimeInsert = useCallback((newMedia: any) => {
    setFeed((prev) => [
      {
        ...newMedia,
        source: 'imported' as const,
      },
      ...prev,
    ]);
    toast.success('New media imported!', { description: newMedia?.title || 'Media ready' });
  }, []);

  const handleRealtimeUpdate = useCallback((updatedMedia: any) => {
    setFeed((prev) =>
      prev.map((item) =>
        item.id === updatedMedia.id
          ? { ...updatedMedia, source: 'imported' as const }
          : item
      )
    );
  }, []);

  const handleRealtimeDelete = useCallback((deletedId: string) => {
    setFeed((prev) => prev.filter((item) => item.id !== deletedId));
  }, []);

  useImportedMediaRealtime({
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete,
  });

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const results: UnifiedFeedItem[] = [];

      // Load native content from personalized feed
      if (!showOnlyImported && activeFilter !== 'imported') {
        try {
          const { data: nativeData, error: nativeError } = await supabase.functions.invoke('get-personalized-feed', {
            body: {},
          });

          if (!nativeError && nativeData?.feed) {
            const nativeItems = nativeData.feed.map((item: any) => ({
              ...item,
              source: 'native' as const
            }));
            results.push(...nativeItems);
          }
        } catch (err) {
          console.error('Error loading native feed:', err);
        }
      }

      // Load imported media
      if (user && activeFilter !== 'native') {
        const { data: importedData, error: importedError } = await supabase
          .from('imported_media')
          .select('*')
          .eq('user_id', user.id)
          .order('imported_at', { ascending: false })
          .limit(20);

        if (!importedError && importedData) {
          const importedItems = importedData.map((item: any) => ({
            ...item,
            source: 'imported' as const
          }));
          results.push(...importedItems);
        }
      }

      // Sort by date (newest first) for mixed feed
      if (activeFilter === 'all') {
        results.sort((a, b) => {
          const dateA = 'imported_at' in a ? new Date(a.imported_at).getTime() : Date.now();
          const dateB = 'imported_at' in b ? new Date(b.imported_at).getTime() : Date.now();
          return dateB - dateA;
        });
      }

      setFeed(results);
    } catch (error) {
      console.error('Error loading unified feed:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [user, activeFilter, showOnlyImported]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleInteraction = async (contentId: string, action: 'like' | 'unlike' | 'share' | 'feedback', feedback?: 'more' | 'less') => {
    if (!user) {
      toast.error('Please sign in to interact');
      return;
    }

    const item = feed.find(f => f.id === contentId);
    if (!item) return;

    try {
       if (item.source === 'native') {
         const nativeItem = item as NativeFeedItem;
         const tags = Array.isArray(nativeItem.tags) ? nativeItem.tags : [];

         await supabase.functions.invoke('track-interaction', {
           body: {
             contentId,
             contentType: 'video',
             action,
             feedback,
             tags,
             category: nativeItem.category,
           },
         });
       }

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
        toast.success('Shared!');
      } else if (action === 'feedback') {
        toast.success(feedback === 'more' ? 'Showing more like this' : 'Showing less like this');
        setTimeout(loadFeed, 500);
      }
    } catch (error) {
      console.error('Interaction error:', error);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
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

  const getPlatformBadge = (platform: string) => {
    const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.other;
    return (
      <div className={cn(
        'absolute top-2 left-2 px-2 py-1 rounded-lg flex items-center gap-1.5 text-white text-xs font-medium shadow-lg',
        config.color
      )}>
        {config.icon}
        <span>{config.label}</span>
      </div>
    );
  };

  const renderNativeItem = (item: NativeFeedItem) => (
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
        
        {/* Native badge */}
        <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground">
          <Sparkles className="w-3 h-3 mr-1" />
          Native
        </Badge>
        
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {formatDuration(item.duration)}
        </div>

        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
          item.coinType === 'vicoin' ? 'bg-blue-500 text-white' : 'bg-white text-gray-900'
        }`}>
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
          {(Array.isArray(item.tags) ? item.tags : []).slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 ${likedItems.has(item.id) ? 'text-red-500' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction(item.id, likedItems.has(item.id) ? 'unlike' : 'like');
              }}
            >
              <Heart className={`w-4 h-4 ${likedItems.has(item.id) ? 'fill-red-500' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction(item.id, 'share');
              }}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-green-500"
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction(item.id, 'feedback', 'more');
              }}
            >
              <ThumbsUp className="w-3 h-3 mr-1" />
              More
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction(item.id, 'feedback', 'less');
              }}
            >
              <ThumbsDown className="w-3 h-3 mr-1" />
              Less
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderImportedItem = (item: ImportedFeedItem) => (
    <div
      key={item.id}
      className="bg-card rounded-xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-shadow"
    >
      <div 
        className="relative aspect-video bg-muted cursor-pointer group"
        onClick={() => onSelectContent?.(item)}
      >
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title || 'Imported media'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Video className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-8 h-8 text-primary fill-primary" />
          </div>
        </div>
        
        {/* Platform badge */}
        {getPlatformBadge(item.platform)}
        
        {item.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {formatDuration(item.duration)}
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-2">
          {item.title || 'Untitled Media'}
        </h3>
        
        {item.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {item.original_views !== null && (
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              {item.original_views.toLocaleString()}
            </span>
          )}
          {item.original_likes !== null && (
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {item.original_likes.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
          <Badge variant={item.status === 'processed' ? 'default' : 'secondary'} className="text-xs">
            {item.status === 'processed' ? 'Ready' : item.status}
          </Badge>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/studio?importedMediaId=${item.id}`);
              }}
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(item.original_url, '_blank');
              }}
            >
            <ExternalLink className="w-3 h-3 mr-1" />
              View Original
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

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
      <div className="flex flex-col gap-3 p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Unified Feed
            </h2>
            <p className="text-xs text-muted-foreground">
              All your content in one place
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={loadFeed} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filter tabs */}
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="native" className="flex-1">Native</TabsTrigger>
            <TabsTrigger value="imported" className="flex-1">Imported</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Video className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">No content yet</h3>
            <p className="text-sm text-muted-foreground">
              Import media from your social accounts or create native content
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {feed.map((item) => 
              item.source === 'native' 
                ? renderNativeItem(item as NativeFeedItem)
                : renderImportedItem(item as ImportedFeedItem)
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedContentFeed;
