import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeedContent {
  id: string;
  type: 'video' | 'image' | 'promo';
  src: string;
  videoSrc?: string;
  duration?: number;
  reward?: { amount: number; type: 'vicoin' | 'icoin' };
  title?: string;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    postsCount: number;
    followersCount: number;
    followingCount: number;
    isVerified: boolean;
  };
}

// Fallback content when database is empty
const fallbackContent: FeedContent[] = [
  {
    id: 'fallback-1',
    type: 'video',
    src: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 15,
    title: 'Welcome to the app!',
    creator: {
      id: 'system',
      username: 'app_team',
      displayName: 'App Team',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=app',
      postsCount: 1,
      followersCount: 0,
      followingCount: 0,
      isVerified: true,
    },
  },
];

export const useContentFeed = () => {
  const [content, setContent] = useState<FeedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch published content with creator profiles
      const { data: contentData, error: contentError } = await supabase
        .from('user_content')
        .select(`
          id,
          content_type,
          media_url,
          thumbnail_url,
          title,
          caption,
          reward_type,
          budget,
          user_id,
          views_count,
          likes_count
        `)
        .eq('status', 'published')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (contentError) {
        console.error('[useContentFeed] Error fetching content:', contentError);
        setError(contentError.message);
        setContent(fallbackContent);
        return;
      }

      if (!contentData || contentData.length === 0) {
        console.log('[useContentFeed] No content found, using fallback');
        setContent(fallbackContent);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(contentData.map(c => c.user_id))];
      
      // Fetch creator profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, followers_count, following_count, is_verified')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Transform to FeedContent format
      const feedContent: FeedContent[] = contentData.map(item => {
        const profile = profileMap.get(item.user_id);
        const isVideo = item.content_type === 'video' || item.media_url?.includes('.mp4');
        const isPromo = item.content_type === 'promo' || item.reward_type;

        return {
          id: item.id,
          type: isPromo ? 'promo' : isVideo ? 'video' : 'image',
          src: item.thumbnail_url || item.media_url || '',
          videoSrc: isVideo ? item.media_url : undefined,
          duration: isVideo ? 15 : undefined, // Default duration
          title: item.title || item.caption || '',
          reward: isPromo && item.budget ? {
            amount: item.budget,
            type: (item.reward_type === 'icoin' ? 'icoin' : 'vicoin') as 'vicoin' | 'icoin',
          } : undefined,
          creator: {
            id: item.user_id,
            username: profile?.username || 'user',
            displayName: profile?.display_name || profile?.username || 'Creator',
            avatarUrl: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`,
            postsCount: 0,
            followersCount: profile?.followers_count || 0,
            followingCount: profile?.following_count || 0,
            isVerified: profile?.is_verified || false,
          },
        };
      });

      setContent(feedContent.length > 0 ? feedContent : fallbackContent);
    } catch (err) {
      console.error('[useContentFeed] Unexpected error:', err);
      setError('Failed to load content');
      setContent(fallbackContent);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return {
    content,
    isLoading,
    error,
    refresh: fetchContent,
  };
};
