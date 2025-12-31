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

// Comprehensive fallback content with mock users and promos (using valid UUIDs)
const fallbackContent: FeedContent[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    type: 'video',
    src: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 15,
    title: 'Amazing street food in Tokyo 🍜',
    creator: {
      id: '00000000-0000-0000-0000-000000000101',
      username: 'foodie_traveler',
      displayName: 'Sarah Chen',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
      postsCount: 42,
      followersCount: 15200,
      followingCount: 234,
      isVerified: true,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    type: 'promo',
    src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 30,
    title: 'Fresh organic meals delivered to your door! 🥗',
    reward: { amount: 25, type: 'vicoin' },
    creator: {
      id: '00000000-0000-0000-0000-000000000102',
      username: 'freshbox_meals',
      displayName: 'FreshBox Meals',
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=freshbox',
      postsCount: 128,
      followersCount: 45000,
      followingCount: 12,
      isVerified: true,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    type: 'video',
    src: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: 20,
    title: 'Morning workout routine 💪 #fitness',
    creator: {
      id: '00000000-0000-0000-0000-000000000103',
      username: 'fit_with_mike',
      displayName: 'Mike Johnson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike',
      postsCount: 89,
      followersCount: 32100,
      followingCount: 156,
      isVerified: true,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    type: 'promo',
    src: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    duration: 25,
    title: 'Get 50% off your first purchase! 🛍️',
    reward: { amount: 50, type: 'icoin' },
    creator: {
      id: '00000000-0000-0000-0000-000000000104',
      username: 'stylemart',
      displayName: 'StyleMart',
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=stylemart',
      postsCount: 256,
      followersCount: 89000,
      followingCount: 45,
      isVerified: true,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    type: 'video',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    duration: 18,
    title: 'Sunrise at the mountains 🏔️ #nature',
    creator: {
      id: '00000000-0000-0000-0000-000000000105',
      username: 'adventure_jules',
      displayName: 'Julia Martinez',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=julia',
      postsCount: 156,
      followersCount: 28400,
      followingCount: 312,
      isVerified: false,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    type: 'image',
    src: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1920&h=1080&fit=crop',
    duration: 10,
    title: 'Late night coding session 💻 #developer',
    creator: {
      id: '00000000-0000-0000-0000-000000000106',
      username: 'dev_alex',
      displayName: 'Alex Kumar',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
      postsCount: 67,
      followersCount: 12300,
      followingCount: 445,
      isVerified: false,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    type: 'promo',
    src: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    duration: 20,
    title: 'Join the premium fitness membership today! 🏋️',
    reward: { amount: 100, type: 'vicoin' },
    creator: {
      id: '00000000-0000-0000-0000-000000000107',
      username: 'elitefit_gym',
      displayName: 'EliteFit Gym',
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=elitefit',
      postsCount: 89,
      followersCount: 67000,
      followingCount: 23,
      isVerified: true,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000008',
    type: 'video',
    src: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    duration: 22,
    title: 'New track dropping next week! 🎵 #music',
    creator: {
      id: '00000000-0000-0000-0000-000000000108',
      username: 'dj_beats',
      displayName: 'DJ Beats',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=djbeats',
      postsCount: 234,
      followersCount: 98700,
      followingCount: 89,
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
