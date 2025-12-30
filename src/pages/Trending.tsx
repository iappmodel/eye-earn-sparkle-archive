import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Hash, Video, Users, Music, Flame, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TrendingHashtag {
  tag: string;
  postCount: number;
  viewCount: number;
  trend: 'up' | 'stable' | 'new';
}

interface TrendingCreator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followersCount: number;
  isVerified: boolean;
}

interface TrendingVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  viewsCount: number;
  likesCount: number;
  creatorName: string;
}

const Trending = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('hashtags');
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [creators, setCreators] = useState<TrendingCreator[]>([]);
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrendingData();
  }, []);

  const loadTrendingData = async () => {
    setIsLoading(true);
    try {
      // Load trending hashtags from content
      const { data: tagData } = await supabase
        .from('user_content')
        .select('tags, views_count')
        .eq('is_public', true)
        .not('tags', 'is', null)
        .limit(100);

      if (tagData) {
        const tagStats: Record<string, { count: number; views: number }> = {};
        tagData.forEach(item => {
          (item.tags || []).forEach((tag: string) => {
            if (!tagStats[tag]) tagStats[tag] = { count: 0, views: 0 };
            tagStats[tag].count++;
            tagStats[tag].views += item.views_count || 0;
          });
        });

        const sortedTags = Object.entries(tagStats)
          .sort((a, b) => b[1].views - a[1].views)
          .slice(0, 20)
          .map(([tag, stats], index) => ({
            tag,
            postCount: stats.count,
            viewCount: stats.views,
            trend: index < 3 ? 'new' as const : index < 10 ? 'up' as const : 'stable' as const,
          }));
        setHashtags(sortedTags);
      }

      // Load trending creators
      const { data: creatorData } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, followers_count, is_verified')
        .order('followers_count', { ascending: false })
        .limit(20);

      if (creatorData) {
        setCreators(creatorData.map(c => ({
          id: c.user_id,
          username: c.username || 'user',
          displayName: c.display_name || c.username || 'User',
          avatarUrl: c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}`,
          followersCount: c.followers_count || 0,
          isVerified: c.is_verified || false,
        })));
      }

      // Load trending videos
      const { data: videoData } = await supabase
        .from('user_content')
        .select('id, title, caption, thumbnail_url, views_count, likes_count, user_id')
        .eq('is_public', true)
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(20);

      if (videoData) {
        setVideos(videoData.map(v => ({
          id: v.id,
          title: v.title || v.caption?.slice(0, 40) || 'Untitled',
          thumbnailUrl: v.thumbnail_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&h=300&fit=crop',
          viewsCount: v.views_count || 0,
          likesCount: v.likes_count || 0,
          creatorName: 'Creator',
        })));
      }
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Trending
            </h1>
            <p className="text-sm text-muted-foreground">Discover what's hot right now</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="hashtags" className="flex-1">
              <Hash className="w-4 h-4 mr-1.5" />
              Hashtags
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex-1">
              <Video className="w-4 h-4 mr-1.5" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="creators" className="flex-1">
              <Users className="w-4 h-4 mr-1.5" />
              Creators
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        {/* Hashtags Tab */}
        {activeTab === 'hashtags' && (
          <div className="p-4 space-y-2">
            {hashtags.map((item, index) => (
              <button
                key={item.tag}
                onClick={() => navigate(`/tag/${item.tag}`)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <span className="text-2xl font-bold text-muted-foreground w-8">
                  {index + 1}
                </span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Hash className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">#{item.tag}</span>
                    {item.trend === 'new' && (
                      <Badge className="bg-orange-500 text-white text-xs">NEW</Badge>
                    )}
                    {item.trend === 'up' && (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatCount(item.postCount)} posts · {formatCount(item.viewCount)} views
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div className="p-4 grid grid-cols-2 gap-3">
            {videos.map((video, index) => (
              <button
                key={video.id}
                onClick={() => navigate(`/v/${video.id}`)}
                className="relative rounded-xl overflow-hidden aspect-[9/16] group"
              >
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                {/* Rank Badge */}
                <div className="absolute top-2 left-2 bg-black/60 rounded-full px-2 py-0.5 text-xs font-bold text-white">
                  #{index + 1}
                </div>

                {/* Stats */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-sm font-medium line-clamp-2">{video.title}</p>
                  <p className="text-white/70 text-xs mt-1">
                    {formatCount(video.viewsCount)} views
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Creators Tab */}
        {activeTab === 'creators' && (
          <div className="p-4 space-y-2">
            {creators.map((creator, index) => (
              <button
                key={creator.id}
                onClick={() => navigate(`/u/${creator.id}`)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <span className="text-2xl font-bold text-muted-foreground w-8">
                  {index + 1}
                </span>
                <Avatar className="w-12 h-12">
                  <AvatarImage src={creator.avatarUrl} />
                  <AvatarFallback>{creator.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{creator.displayName}</span>
                    {creator.isVerified && (
                      <Badge variant="secondary" className="text-xs">✓</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{creator.username} · {formatCount(creator.followersCount)} followers
                  </p>
                </div>
                <Button size="sm" variant="outline">Follow</Button>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default Trending;
