/**
 * useMainFeed – fetches main feed media from user_content and promotions.
 * Uses React Query for deduplication, caching, and background refetch.
 * Retries up to 3 times with exponential backoff on fetch errors.
 * Falls back to curated mock data when all retries fail or the database is empty.
 */
import { useQuery } from '@tanstack/react-query';
import { MAIN_FEED_STATUS } from '@/constants/contentStatus';
import { supabase } from '@/integrations/supabase/client';
import { isDemoMode } from '@/lib/appMode';
import { isValidFollowTarget } from '@/services/follow.service';
import { SAVED_VIDEOS } from '@/lib/mockupVideos';

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

// Fallback mock data (SCIENCE videos) when DB is empty or demo mode. Creator IDs are non-UUID so follow uses shell mode only.
const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=';
const SCIENCE_TITLES = ['Lab Discovery', 'Space Tech', 'Quantum View', 'Neural Networks', 'Climate Data', 'Bio Lab', 'Physics Demo', 'Robot Workshop', 'Future Science'];
const SCIENCE_CREATORS = ['science_lab', 'space_tech', 'quantum_lab', 'neural_ai', 'climate_study', 'bio_research', 'physics_demo', 'robotics_hub', 'future_sci'];

function buildFallbackFeed(): MainFeedItem[] {
  return SAVED_VIDEOS.map((videoSrc, i) => {
    const isPromo = i % 3 === 0;
    const creatorId = `creator-main-${i + 1}`;
    return {
      id: `fallback-main-${i + 1}`,
      type: isPromo ? 'promo' : 'video',
      src: videoSrc,
      videoSrc,
      duration: 12,
      title: SCIENCE_TITLES[i] ?? `Science #${i + 1}`,
      ...(isPromo && { reward: { amount: 25 + i * 10, type: 'vicoin' as const } }),
      creator: {
        id: creatorId,
        username: SCIENCE_CREATORS[i] ?? `science_${i + 1}`,
        displayName: SCIENCE_TITLES[i] ?? `Science Creator ${i + 1}`,
        avatarUrl: `${DEFAULT_AVATAR}${i + 10}`,
        postsCount: 50 + i * 20,
        followersCount: 1000 + i * 500,
        followingCount: 50,
        isVerified: isPromo,
      },
      isShellCreator: true,
    };
  });
}

const FALLBACK_FEED: MainFeedItem[] = buildFallbackFeed();

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
  if (isDemoMode) {
    return FALLBACK_FEED.find((item) => item.id === id) ?? FALLBACK_FEED[0] ?? null;
  }

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
      .from('public_profiles')
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
  const {
    data: item,
    isLoading,
    error,
    refetch: refresh,
  } = useQuery({
    queryKey: ['content', contentId],
    queryFn: () => fetchContentById(contentId!),
    enabled: !!contentId,
    staleTime: 60 * 1000,
  });

  return {
    item: item ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load content') : null,
    refresh,
  };
}

async function loadMainFeed(): Promise<MainFeedItem[]> {
  if (isDemoMode) {
    return FALLBACK_FEED;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const feedItems: MainFeedItem[] = [];

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
          .from('public_profiles')
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
          feedItems.push(mapUserContentToFeedItem(row, profileMap));
        }
      }

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

      if (feedItems.length > 0) return feedItems;
      // Empty DB: return fallback so the feed never shows a black screen
      if (!ce && !pe) return FALLBACK_FEED;
      lastError = new Error(ce ? String(ce) : pe ? String(pe) : 'Failed to load feed');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error('[useMainFeed] Load error (attempt', attempt + 1, '):', err);
    }

    if (attempt < MAX_RETRIES) {
      await delay(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error('Failed to load feed');
}

export function useMainFeed() {
  const {
    data: items,
    isLoading,
    error,
    refetch: refresh,
  } = useQuery({
    queryKey: ['mainFeed'],
    queryFn: loadMainFeed,
    staleTime: 2 * 60 * 1000,
    placeholderData: FALLBACK_FEED,
    retry: MAX_RETRIES,
    retryDelay: (attemptIndex) => INITIAL_BACKOFF_MS * Math.pow(2, attemptIndex),
  });

  return {
    items: (items?.length ? items : undefined) ?? FALLBACK_FEED,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load feed') : null,
    refresh,
  };
}
