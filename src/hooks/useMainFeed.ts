/**
 * useMainFeed – fetches main feed media from user_content and promotions.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s) on fetch errors.
 * Falls back to curated mock data when all retries fail or the database is empty.
 * Real backend content uses UUID creators; fallback uses non-UUID (creator-1, etc.)
 * so follow works in shell mode only for fallback.
 */
import { useState, useCallback, useEffect } from 'react';
import { MAIN_FEED_STATUS } from '@/constants/contentStatus';
import { supabase } from '@/integrations/supabase/client';
import { isValidFollowTarget } from '@/services/follow.service';

export interface MainFeedCreator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
}

/** When present, this feed item is a promo with location and can be added to a route or watch later */
export interface PromoLocationInfo {
  promotionId: string;
  businessName: string;
  latitude: number;
  longitude: number;
  address?: string;
  category?: string;
  rewardType: 'vicoin' | 'icoin' | 'both';
  rewardAmount: number;
  requiredAction?: string;
}

export interface MainFeedItem {
  id: string;
  type: 'video' | 'image' | 'promo';
  src: string;
  videoSrc?: string;
  duration?: number;
  title?: string;
  /** Like count from user_content.likes_count (synced by triggers from content_likes) or content_likes RPC for promos */
  likes?: number;
  reward?: { amount: number; type: 'vicoin' | 'icoin' };
  creator: MainFeedCreator;
  /** Set for promos that have location (from DB); enables Add to route / Save for later */
  promoLocation?: PromoLocationInfo;
  /** True when creator.id is non-UUID (fallback/mock); follow uses shell mode only. Real backend has UUID creators. */
  isShellCreator?: boolean;
}

// Fallback mock data when DB is empty or fetch fails. Creator IDs are non-UUID so follow uses shell mode only.
const FALLBACK_FEED: MainFeedItem[] = [
  {
    id: 'fallback-1',
    type: 'promo',
    src: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    duration: 8,
    title: 'Holiday Special',
    reward: { amount: 50, type: 'vicoin' },
    creator: {
      id: 'creator-1',
      username: 'holiday_deals',
      displayName: 'Holiday Deals',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
      postsCount: 156,
      followersCount: 24500,
      followingCount: 89,
      isVerified: true,
    },
    isShellCreator: true,
  },
  {
    id: 'fallback-2',
    type: 'video',
    src: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 15,
    title: 'Trending Now',
    creator: {
      id: 'creator-2',
      username: 'alex_creates',
      displayName: 'Alex Rivera',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      postsCount: 89,
      followersCount: 12300,
      followingCount: 234,
      isVerified: false,
    },
    isShellCreator: true,
  },
  {
    id: 'fallback-3',
    type: 'promo',
    src: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: 10,
    title: 'Coffee Shop Reward',
    reward: { amount: 1, type: 'icoin' },
    creator: {
      id: 'creator-3',
      username: 'cafe_central',
      displayName: 'Cafe Central',
      avatarUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&h=100&fit=crop',
      postsCount: 342,
      followersCount: 8700,
      followingCount: 156,
      isVerified: true,
    },
    isShellCreator: true,
  },
  {
    id: 'fallback-4',
    type: 'image',
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    duration: 5,
    title: 'Mountain View',
    creator: {
      id: 'creator-4',
      username: 'nature_shots',
      displayName: 'Maya Thompson',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
      postsCount: 234,
      followersCount: 45600,
      followingCount: 123,
      isVerified: true,
    },
    isShellCreator: true,
  },
  {
    id: 'fallback-5',
    type: 'promo',
    src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1920&h=1080&fit=crop',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 12,
    title: 'Sneaker Drop',
    reward: { amount: 25, type: 'vicoin' },
    creator: {
      id: 'creator-5',
      username: 'sneaker_drops',
      displayName: 'Sneaker Drops',
      avatarUrl: 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=100&h=100&fit=crop',
      postsCount: 567,
      followersCount: 89000,
      followingCount: 45,
      isVerified: true,
    },
    isShellCreator: true,
  },
];

const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapUserContentToFeedItem(
  row: {
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
    likes_count?: number | null;
  },
  profileMap: Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>
): MainFeedItem {
  const creatorId = row.user_id;
  const profile = profileMap.get(creatorId);
  const username = profile?.username || `user_${creatorId.slice(0, 8)}`;
  const displayName = profile?.display_name || username;
  const avatarUrl = profile?.avatar_url || `${DEFAULT_AVATAR}${username}`;

  const mediaType = row.media_type || 'video';
  const type: MainFeedItem['type'] =
    row.content_type === 'promotion'
      ? 'promo'
      : mediaType === 'image' || mediaType === 'carousel'
        ? 'image'
        : 'video';

  const primaryUrl =
    row.thumbnail_url ||
    (() => {
      if (!row.media_url) return null;
      if (row.media_url.startsWith('[')) {
        try {
          const arr = JSON.parse(row.media_url) as unknown[];
          return Array.isArray(arr) && arr.length ? String(arr[0]) : row.media_url;
        } catch {
          return row.media_url;
        }
      }
      return row.media_url;
    })();
  const src = primaryUrl || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1920&h=1080&fit=crop';
  const videoSrc = mediaType === 'video' ? primaryUrl ?? undefined : undefined;

  // user_content: when reward_type is set, use reward_amount if present else default 10.
  const rewardAmount = row.reward_amount ?? 10;
  return {
    id: row.id,
    type,
    src,
    videoSrc,
    duration: 30,
    title: row.title || row.caption || 'Untitled',
    likes: row.likes_count ?? 0,
    reward:
      row.reward_type && row.content_type === 'promotion'
        ? { amount: rewardAmount, type: (row.reward_type as 'vicoin' | 'icoin') || 'vicoin' }
        : undefined,
    creator: {
      id: creatorId,
      username,
      displayName,
      avatarUrl,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      isVerified: false,
    },
    isShellCreator: false, // user_content.user_id is always UUID
  };
}

function mapPromotionToFeedItem(promo: {
  id: string;
  business_id: string | null;
  business_name: string;
  description: string | null;
  image_url: string | null;
  video_url?: string | null;
  reward_type: string;
  reward_amount: number;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  category?: string | null;
  required_action?: string | null;
}): MainFeedItem {
  // Real backend: only use UUID creator when business_id is a valid user UUID (so follow persists).
  // Otherwise use non-UUID id so follow uses shell mode only.
  const creatorId =
    promo.business_id && isValidFollowTarget(promo.business_id)
      ? promo.business_id
      : `promo-${promo.id}`;
  const isShellCreator = !isValidFollowTarget(creatorId);
  const rewardType = (promo.reward_type === 'both' ? 'both' : promo.reward_type === 'icoin' ? 'icoin' : 'vicoin') as 'vicoin' | 'icoin' | 'both';
  const item: MainFeedItem = {
    id: promo.id,
    type: 'promo',
    src: promo.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&h=1080&fit=crop',
    videoSrc: promo.video_url || undefined,
    duration: 10,
    title: promo.business_name,
    reward: {
      amount: promo.reward_amount,
      type: rewardType === 'both' ? 'vicoin' : rewardType,
    },
    creator: {
      id: creatorId,
      username: promo.business_name.toLowerCase().replace(/\s+/g, '_'),
      displayName: promo.business_name,
      avatarUrl: promo.image_url,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      isVerified: true,
    },
    isShellCreator,
  };
  if (promo.latitude != null && promo.longitude != null) {
    item.promoLocation = {
      promotionId: promo.id,
      businessName: promo.business_name,
      latitude: promo.latitude,
      longitude: promo.longitude,
      address: promo.address ?? undefined,
      category: promo.category ?? undefined,
      rewardType,
      rewardAmount: promo.reward_amount,
      requiredAction: promo.required_action ?? undefined,
    };
  }
  return item;
}

/** Fetch a single feed item by ID from user_content or promotions. */
export async function fetchContentById(id: string): Promise<MainFeedItem | null> {
  if (!id) return null;

  const { data: contentRow, error: contentError } = await supabase
    .from('user_content')
    .select('id, title, caption, media_url, thumbnail_url, media_type, reward_type, reward_amount, content_type, user_id, likes_count')
    .eq('id', id)
    .eq('is_public', true)
    .eq('status', MAIN_FEED_STATUS)
    .eq('is_draft', false)
    .not('media_url', 'is', null)
    .maybeSingle();

  if (!contentError && contentRow) {
    const profileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url')
      .eq('user_id', contentRow.user_id);
    for (const p of profiles || []) {
      profileMap.set(p.user_id, {
        username: p.username ?? null,
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
      });
    }
    return mapUserContentToFeedItem(contentRow, profileMap);
  }

  const { data: promo, error: promoError } = await supabase
    .from('promotions')
    .select('id, business_id, business_name, description, image_url, video_url, reward_type, reward_amount, latitude, longitude, address, category, required_action')
    .eq('id', id)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.now()')
    .maybeSingle();

  if (!promoError && promo) {
    return mapPromotionToFeedItem(promo);
  }

  return null;
}

export function useContentById(contentId: string | null) {
  const [item, setItem] = useState<MainFeedItem | null>(null);
  const [isLoading, setIsLoading] = useState(!!contentId);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contentId) {
      setItem(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchContentById(contentId);
      if (result) {
        setItem(result);
        setError(null);
      } else {
        setItem(null);
        setError('Content not found');
      }
    } catch (err) {
      console.error('[useContentById]', err);
      setError(err instanceof Error ? err.message : 'Failed to load content');
      setItem(null);
    } finally {
      setIsLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { item, isLoading, error, refresh };
}

export function useMainFeed() {
  const [items, setItems] = useState<MainFeedItem[]>(FALLBACK_FEED);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const feedItems: MainFeedItem[] = [];

        // 1. Fetch user_content (posts, stories, promotions)
        const contentResult = await supabase
          .from('user_content')
          .select('id, title, caption, media_url, thumbnail_url, media_type, reward_type, reward_amount, content_type, user_id, likes_count')
          .eq('is_public', true)
          .eq('status', MAIN_FEED_STATUS)
          .eq('is_draft', false)
          .not('media_url', 'is', null)
          .order('published_at', { ascending: false })
          .limit(30);

        const { data: contentRows, error: ce } = contentResult;
        const profileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();

        if (ce) {
          console.warn('[useMainFeed] user_content fetch error (attempt', attempt + 1, '):', ce);
        } else if (contentRows && contentRows.length > 0) {
          const userIds = [...new Set(contentRows.map((r: { user_id: string }) => r.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url')
            .in('user_id', userIds);

          for (const p of profiles || []) {
            profileMap.set(p.user_id, {
              username: p.username ?? null,
              display_name: p.display_name ?? null,
              avatar_url: p.avatar_url ?? null,
            });
          }

          for (const row of contentRows) {
            const item = mapUserContentToFeedItem(row, profileMap);
            feedItems.push(item);
          }
        }

        // 2. Fetch promotions with location (for route builder / watch later)
        const promosResult = await supabase
          .from('promotions')
          .select('id, business_id, business_name, description, image_url, video_url, reward_type, reward_amount, latitude, longitude, address, category, required_action')
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.now()')
          .limit(15);

        const { data: promos, error: pe } = promosResult;

        if (pe) {
          console.warn('[useMainFeed] promotions fetch error (attempt', attempt + 1, '):', pe);
        } else if (promos && promos.length > 0) {
          for (const p of promos) {
            feedItems.push(mapPromotionToFeedItem(p));
          }
        }

        // Success: we have data
        if (feedItems.length > 0) {
          setItems(feedItems);
          setIsLoading(false);
          return {};
        }

        // Empty result with no fetch errors: DB is empty, keep fallback
        if (!ce && !pe) {
          setIsLoading(false);
          return {};
        }

        lastError = new Error(ce ? String(ce) : pe ? String(pe) : 'Failed to load feed');
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error('[useMainFeed] Load error (attempt', attempt + 1, '):', err);
      }

      // Retry with backoff
      if (attempt < MAX_RETRIES) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await delay(backoffMs);
      }
    }

    // All retries exhausted: fall back to mock
    const msg = lastError instanceof Error ? lastError.message : 'Failed to load feed';
    setError(msg);
    setItems(FALLBACK_FEED);
    setIsLoading(false);
    return { error: msg };
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  return {
    items,
    isLoading,
    error,
    refresh: loadFeed,
  };
}
