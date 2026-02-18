/**
 * usePromoFeed – Fetches promo feed for the right-swipe Promo Videos screen.
 * Tries backend (promotions + user_content promotions), falls back to rich mock data.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VideoTheme } from '@/components/ui/Neu3DButton';

const SAMPLE_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
];

const THEMES: VideoTheme[] = ['rose', 'gold', 'cyan', 'emerald', 'purple', 'magenta'];

/**
 * Product rule: Promo feed (right-swipe Promo Videos) shows only "watch-to-earn" promos.
 * required_action = 'view' → eligible (watch video to earn).
 * required_action = 'visit' | 'purchase' | 'scan' → excluded; those appear in Discovery Map,
 * check-in flow, routes, etc. If product later allows other actions in feed, add them here.
 */
const PROMO_FEED_REQUIRED_ACTIONS: string[] = ['view'];

export interface PromoFeedItem {
  id: string;
  type: 'promo' | 'user_post';
  brandName?: string;
  username?: string;
  brandLogo?: string;
  avatar?: string;
  videoUrl: string;
  thumbnail: string;
  title: string;
  description: string;
  duration: number;
  reward?: { amount: number; type: 'vicoin' | 'icoin' };
  claimed?: boolean;
  theme: VideoTheme;
  likes?: number;
  comments?: number;
  category?: string;
}

function pickTheme(index: number): VideoTheme {
  return THEMES[index % THEMES.length];
}

function pickVideo(index: number): string {
  return SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length];
}

/** Rich mock feed (25 items) – used when backend is empty or fails */
function getMockFeedItems(): PromoFeedItem[] {
  const base: Omit<PromoFeedItem, 'theme' | 'videoUrl'>[] = [
    { id: 'coca-cola-1', type: 'promo', brandName: 'Coca-Cola', brandLogo: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=1080&h=1920&fit=crop', title: 'Share a Coke This Summer', description: 'Refresh your moments with the taste of happiness!', duration: 8, reward: { amount: 100, type: 'vicoin' }, claimed: false },
    { id: 'user-1', type: 'user_post', username: '@travel_adventures', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1080&h=1920&fit=crop', title: 'Sunrise in Bali', description: 'Woke up to this incredible view! #travel', duration: 15, likes: 12400, comments: 342 },
    { id: 'emirates-1', type: 'promo', brandName: 'Emirates Airlines', brandLogo: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1080&h=1920&fit=crop', title: 'Fly Better with Emirates', description: 'Experience world-class luxury. Book now - 20% off!', duration: 8, reward: { amount: 150, type: 'vicoin' }, claimed: false },
    { id: 'user-2', type: 'user_post', username: '@fitness_queen', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1080&h=1920&fit=crop', title: 'Morning Workout', description: 'Start your day right! 💪', duration: 20, likes: 8900, comments: 156 },
    { id: 'pool-party-1', type: 'promo', brandName: 'Wet Republic', brandLogo: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?w=1080&h=1920&fit=crop', title: 'Ultimate Pool Party', description: 'Vegas hottest pool party! Use code SWIM50', duration: 8, reward: { amount: 75, type: 'vicoin' }, claimed: false },
    { id: 'wellness-1', type: 'promo', brandName: 'Serenity Spa', brandLogo: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1080&h=1920&fit=crop', title: 'Find Your Inner Peace', description: 'Luxury wellness retreat from $99!', duration: 8, reward: { amount: 2, type: 'icoin' }, claimed: false },
    { id: 'user-3', type: 'user_post', username: '@chef_marco', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1080&h=1920&fit=crop', title: 'Perfect Italian Pasta', description: 'Secret family recipe 🍝', duration: 12, likes: 45200, comments: 892 },
    { id: 'nike-1', type: 'promo', brandName: 'Nike', brandLogo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1080&h=1920&fit=crop', title: 'Just Do It - New Collection', description: 'Unleash your potential!', duration: 8, reward: { amount: 80, type: 'vicoin' }, claimed: false },
    { id: 'starbucks-1', type: 'promo', brandName: 'Starbucks', brandLogo: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1080&h=1920&fit=crop', title: 'Fall Favorites Are Back', description: 'Pumpkin Spice Latte season!', duration: 8, reward: { amount: 50, type: 'vicoin' }, claimed: false },
    { id: 'user-4', type: 'user_post', username: '@dance_vibes', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=1080&h=1920&fit=crop', title: 'New Choreography', description: 'Learn this dance! 💃', duration: 18, likes: 67800, comments: 1204 },
    { id: 'apple-1', type: 'promo', brandName: 'Apple', brandLogo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1080&h=1920&fit=crop', title: 'iPhone 16 Pro', description: 'The most powerful iPhone ever!', duration: 8, reward: { amount: 3, type: 'icoin' }, claimed: false },
    { id: 'marriott-1', type: 'promo', brandName: 'Marriott Hotels', brandLogo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1080&h=1920&fit=crop', title: 'Luxury Awaits', description: 'Members save up to 25%!', duration: 8, reward: { amount: 120, type: 'vicoin' }, claimed: false },
    { id: 'user-5', type: 'user_post', username: '@mountain_explorer', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&h=1920&fit=crop', title: 'Summit Reached!', description: '14,000 ft above sea level 🏔️', duration: 10, likes: 23100, comments: 456 },
    { id: 'samsung-1', type: 'promo', brandName: 'Samsung', brandLogo: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=1080&h=1920&fit=crop', title: 'Galaxy Z Fold 6', description: 'Unfold the future!', duration: 8, reward: { amount: 90, type: 'vicoin' }, claimed: false },
    { id: 'tesla-1', type: 'promo', brandName: 'Tesla', brandLogo: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1617886322168-72b886573c35?w=1080&h=1920&fit=crop', title: 'Model S Plaid', description: 'Quickest production car ever!', duration: 8, reward: { amount: 200, type: 'vicoin' }, claimed: false },
    { id: 'user-6', type: 'user_post', username: '@art_gallery', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1080&h=1920&fit=crop', title: 'Digital Art Process', description: 'Watch me create! 🎨', duration: 25, likes: 34500, comments: 678 },
    { id: 'mcdonalds-1', type: 'promo', brandName: "McDonald's", brandLogo: 'https://images.unsplash.com/photo-1586816001966-79b736744398?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1080&h=1920&fit=crop', title: "I'm Lovin' It", description: 'New crispy chicken sandwich!', duration: 8, reward: { amount: 40, type: 'vicoin' }, claimed: false },
    { id: 'adidas-1', type: 'promo', brandName: 'Adidas', brandLogo: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=1080&h=1920&fit=crop', title: 'Impossible Is Nothing', description: 'New Ultraboost collection!', duration: 8, reward: { amount: 70, type: 'vicoin' }, claimed: false },
    { id: 'user-7', type: 'user_post', username: '@pet_lover', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1080&h=1920&fit=crop', title: 'Meet My New Puppy!', description: 'Welcome home buddy! 🐕', duration: 8, likes: 89200, comments: 2341 },
    { id: 'rolex-1', type: 'promo', brandName: 'Rolex', brandLogo: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=1080&h=1920&fit=crop', title: 'Perpetual Excellence', description: 'Discover the art of watchmaking', duration: 8, reward: { amount: 5, type: 'icoin' }, claimed: false },
    { id: 'spotify-1', type: 'promo', brandName: 'Spotify', brandLogo: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1080&h=1920&fit=crop', title: 'Premium Free 3 Months', description: 'Ad-free music, offline listening!', duration: 8, reward: { amount: 60, type: 'vicoin' }, claimed: false },
    { id: 'user-8', type: 'user_post', username: '@fashion_forward', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1080&h=1920&fit=crop', title: 'OOTD - Street Style', description: 'Under $50 thrifted! 🛍️', duration: 12, likes: 15600, comments: 289 },
    { id: 'delta-1', type: 'promo', brandName: 'Delta Airlines', brandLogo: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1080&h=1920&fit=crop', title: 'Keep Climbing', description: 'Double miles on international!', duration: 8, reward: { amount: 130, type: 'vicoin' }, claimed: false },
    { id: 'equinox-1', type: 'promo', brandName: 'Equinox', brandLogo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1920&fit=crop', title: 'Elevate Your Fitness', description: 'First month free!', duration: 8, reward: { amount: 85, type: 'vicoin' }, claimed: false },
    { id: 'bmw-1', type: 'promo', brandName: 'BMW', brandLogo: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=100&h=100&fit=crop', thumbnail: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1080&h=1920&fit=crop', title: 'Ultimate Driving Machine', description: 'New M4 Competition!', duration: 8, reward: { amount: 180, type: 'vicoin' }, claimed: false },
  ];
  return base.map((item, i) => ({
    ...item,
    videoUrl: item.type === 'promo' ? pickVideo(i) : pickVideo(i + 1),
    theme: pickTheme(i),
  })) as PromoFeedItem[];
}

function mapPromotionRow(row: {
  id: string;
  business_name: string;
  description: string | null;
  image_url: string | null;
  video_url?: string | null;
  reward_type: string;
  reward_amount: number;
  required_action: string;
  category: string | null;
}, index: number): PromoFeedItem | null {
  if (!PROMO_FEED_REQUIRED_ACTIONS.includes(row.required_action)) return null;
  const theme = pickTheme(parseInt(row.id.slice(-2), 16) || 0);
  const thumbnail = row.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1080&h=1920&fit=crop';
  return {
    id: row.id,
    type: 'promo',
    brandName: row.business_name,
    brandLogo: row.image_url || undefined,
    videoUrl: (row.video_url && row.video_url.trim()) ? row.video_url.trim() : pickVideo(index),
    thumbnail,
    title: row.business_name,
    description: row.description || 'Watch to earn rewards!',
    duration: 8,
    reward: {
      amount: row.reward_amount,
      type: row.reward_type === 'icoin' ? 'icoin' : 'vicoin',
    },
    claimed: false,
    theme,
    category: row.category || undefined,
  };
}

function mapUserContentRow(row: {
  id: string;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  media_type: string;
  reward_type: string | null;
  reward_amount?: number | null;
  content_type: string;
  user_id: string;
}, profile?: { username: string | null; display_name: string | null; avatar_url: string | null }, fallbackVideoIndex?: number): PromoFeedItem | null {
  if (row.content_type !== 'promotion') return null;
  const theme = pickTheme(parseInt(row.id.slice(-2), 16) || 0);
  const username = profile?.username || `user_${row.user_id.slice(0, 8)}`;
  const displayName = profile?.display_name || username;
  const hasVideoUrl = row.media_type === 'video' && row.media_url && row.media_url.trim();
  const thumbnail = row.thumbnail_url || row.media_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1080&h=1920&fit=crop';
  const rewardAmount = row.reward_amount ?? 10;
  return {
    id: row.id,
    type: 'promo',
    brandName: displayName,
    username: `@${username}`,
    brandLogo: profile?.avatar_url || undefined,
    avatar: profile?.avatar_url,
    videoUrl: hasVideoUrl ? row.media_url! : (typeof fallbackVideoIndex === 'number' ? pickVideo(fallbackVideoIndex) : ''),
    thumbnail,
    title: row.title || row.caption || 'Promo',
    description: row.caption || '',
    duration: 10,
    reward: row.reward_type ? { amount: rewardAmount, type: (row.reward_type as 'vicoin' | 'icoin') || 'vicoin' } : undefined,
    claimed: false,
    theme,
  };
}

export type PromoFeedRewardFilter = 'all' | 'vicoin' | 'icoin';

export interface UsePromoFeedOptions {
  rewardFilter?: PromoFeedRewardFilter;
  enabled?: boolean;
}

export interface UsePromoFeedReturn {
  items: PromoFeedItem[];
  isLoading: boolean;
  error: string | null;
  fromBackend: boolean;
  refresh: () => Promise<void>;
}

export function usePromoFeed(options: UsePromoFeedOptions = {}): UsePromoFeedReturn {
  const { rewardFilter = 'all', enabled = true } = options;
  const [items, setItems] = useState<PromoFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromBackend, setFromBackend] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const feedItems: PromoFeedItem[] = [];

      // 1. Promotions eligible for promo feed (see PROMO_FEED_REQUIRED_ACTIONS)
      const { data: promos, error: promosErr } = await supabase
        .from('promotions')
        .select('id, business_name, description, image_url, video_url, reward_type, reward_amount, required_action, category')
        .eq('is_active', true)
        .in('required_action', PROMO_FEED_REQUIRED_ACTIONS)
        .or('expires_at.is.null,expires_at.gt.now()')
        .limit(50);

      if (!promosErr && promos?.length) {
        for (let i = 0; i < promos.length; i++) {
          const mapped = mapPromotionRow(promos[i], i);
          if (mapped) feedItems.push(mapped);
        }
      }

      // 2. user_content promotions (video promos from creators)
      const { data: contentRows, error: contentErr } = await supabase
        .from('user_content')
        .select('id, title, caption, media_url, thumbnail_url, media_type, reward_type, reward_amount, content_type, user_id')
        .eq('is_public', true)
        .eq('status', 'active')
        .eq('is_draft', false)
        .eq('content_type', 'promotion')
        .not('media_url', 'is', null)
        .order('published_at', { ascending: false })
        .limit(20);

      if (!contentErr && contentRows?.length) {
        const userIds = [...new Set(contentRows.map((r: { user_id: string }) => r.user_id))];
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', userIds);
        const profileMap = new Map(
          (profiles || []).map((p: { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => [p.user_id, p])
        );
        contentRows.forEach((row: { user_id: string }, i: number) => {
          const mapped = mapUserContentRow(row, profileMap.get(row.user_id), feedItems.length + i);
          if (mapped) feedItems.push(mapped);
        });
      }

      if (feedItems.length > 0) {
        setItems(feedItems);
        setFromBackend(true);
      } else {
        const mock = getMockFeedItems();
        setItems(mock);
        setFromBackend(false);
      }
    } catch (err) {
      console.warn('[usePromoFeed] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setItems(getMockFeedItems());
      setFromBackend(false);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const filteredItems =
    rewardFilter === 'all'
      ? items
      : items.filter((item) => {
          if (item.type !== 'promo' || !item.reward) return true;
          return item.reward.type === rewardFilter;
        });

  return {
    items: filteredItems,
    isLoading,
    error,
    fromBackend,
    refresh,
  };
}
