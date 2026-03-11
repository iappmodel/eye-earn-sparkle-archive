/**
 * usePromoFeed – Fetches promo feed for the right-swipe Promo Videos screen.
 * Tries backend (promotions + user_content promotions), falls back to rich mock data.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VideoTheme } from '@/components/ui/Neu3DButton';
import { PROMOS_VIDEOS } from '@/lib/mockupVideos';

const THEMES: VideoTheme[] = ['rose', 'gold', 'cyan', 'emerald', 'purple', 'magenta'];
const PROMO_BRANDS = ['Brand One', 'Brand Two', 'Brand Three', 'Brand Four', 'Brand Five', 'Brand Six', 'Brand Seven', 'Brand Eight', 'Brand Nine', 'Brand Ten'];

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
  return PROMOS_VIDEOS[index % PROMOS_VIDEOS.length];
}

/** Rich mock feed (10 PROMOS videos) – used when backend is empty or fails */
function getMockFeedItems(): PromoFeedItem[] {
  return PROMOS_VIDEOS.map((videoUrl, i) => ({
    id: `promo-mock-${i + 1}`,
    type: 'promo' as const,
    brandName: PROMO_BRANDS[i] ?? `Promo ${i + 1}`,
    brandLogo: `https://api.dicebear.com/7.x/initials/svg?seed=${i + 1}`,
    thumbnail: videoUrl,
    videoUrl,
    title: `${PROMO_BRANDS[i] ?? 'Promo'} – Watch to Earn`,
    description: 'Watch the full video to earn rewards!',
    duration: 10,
    reward: { amount: 50 + i * 10, type: 'vicoin' as const },
    claimed: false,
    theme: pickTheme(i),
  }));
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
