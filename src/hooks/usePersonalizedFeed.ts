/**
 * usePersonalizedFeed – personalized "For You" feed with pagination, location boost, and refresh.
 * Uses get-personalized-feed (real DB + scoring); falls back to SAMPLE_CONTENT when DB is empty.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PersonalizedFeedCreator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PersonalizedFeedItem {
  id: string;
  source?: 'user_content' | 'promotion';
  type: 'video' | 'image' | 'promo';
  title: string;
  category: string;
  tags: string[];
  reward: number;
  coinType: 'icoin' | 'vicoin';
  thumbnail: string;
  videoSrc?: string | null;
  duration: number;
  score?: number;
  reason: string;
  position?: number;
  personalized?: boolean;
  creator: PersonalizedFeedCreator;
}

export interface PersonalizedFeedMeta {
  userId: string | null;
  personalized: boolean;
  interactionCount: number;
  coldStart: boolean;
  hasMore: boolean;
  nextCursor: string[] | null;
}

export function usePersonalizedFeed(options?: {
  /** Optional geo for "near you" boost */
  latitude?: number | null;
  longitude?: number | null;
  /** Auto-load on mount */
  enabled?: boolean;
}) {
  const { latitude, longitude, enabled = true } = options ?? {};
  const [items, setItems] = useState<PersonalizedFeedItem[]>([]);
  const [meta, setMeta] = useState<PersonalizedFeedMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (excludeIds: string[] = [], isLoadMore = false) => {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-personalized-feed', {
          body: {
            latitude: latitude ?? undefined,
            longitude: longitude ?? undefined,
            limit: 15,
            excludeIds: excludeIds.length ? excludeIds : undefined,
          },
        });

        if (fnError) throw fnError;
        if (!data?.success) throw new Error(data?.error || 'Failed to load feed');

        const feed = (data.feed ?? []) as PersonalizedFeedItem[];
        const nextMeta = data.meta ?? null;

        if (isLoadMore) {
          setItems((prev) => {
            const seen = new Set(prev.map((i) => i.id));
            const newItems = feed.filter((i) => !seen.has(i.id));
            return [...prev, ...newItems];
          });
        } else {
          setItems(feed);
        }
        setMeta(nextMeta);
        return { feed, meta: nextMeta };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load feed';
        setError(message);
        throw e;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [latitude, longitude]
  );

  const refresh = useCallback(() => {
    return loadPage([], false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !meta?.hasMore || !meta?.nextCursor?.length) return;
    return loadPage(meta.nextCursor!, true);
  }, [loadPage, loading, loadingMore, meta?.hasMore, meta?.nextCursor]);

  useEffect(() => {
    if (enabled) loadPage([], false).catch(() => {});
  }, [enabled, loadPage]);

  return {
    items,
    meta,
    loading,
    loadingMore,
    error,
    hasMore: meta?.hasMore ?? false,
    refresh,
    loadMore,
  };
}
