/**
 * useContentLikes – persisted Like state with Supabase and localStorage fallback.
 * Supports guests (localStorage only) and authenticated users (sync to content_likes).
 *
 * Semantics: content_likes = canonical source of truth (syncs to user_content.likes_count).
 * content_interactions = analytics-only (via track-interaction). Offline queue syncs both.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { supabase } from '@/integrations/supabase/client';

const LIKED_IDS_KEY = 'visuai-liked-content-ids';

/** Optional context for analytics when queueing offline likes. */
export type LikeContext = { tags?: string[]; category?: string | null; contentType?: 'video' | 'image' | 'reel' | 'story' };

const loadLikedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(LIKED_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const persistLikedIds = (ids: Set<string>) => {
  try {
    localStorage.setItem(LIKED_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage full or unavailable
  }
};

export const useContentLikes = () => {
  const { user } = useAuth();
  const { isOffline, queueAction } = useOffline();
  const [likedIds, setLikedIds] = useState<Set<string>>(loadLikedIds);
  const [syncing, setSyncing] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const initialFetchDone = useRef(false);

  // Persist to localStorage on every change
  useEffect(() => {
    persistLikedIds(likedIds);
  }, [likedIds]);

  // When logged in: fetch from Supabase and merge with local
  useEffect(() => {
    if (!user?.id) {
      initialFetchDone.current = false;
      return;
    }

    let cancelled = false;
    const syncFromSupabase = async () => {
      setSyncing(true);
      try {
        const { data: rows, error } = await supabase
          .from('content_likes')
          .select('content_id')
          .eq('user_id', user.id);

        if (cancelled) return;
        if (error) {
          console.warn('[useContentLikes] Fetch failed:', error);
          return;
        }

        const fromServer = new Set((rows || []).map((r) => r.content_id));
        const local = loadLikedIds();

        // Push any local-only likes to Supabase (merge local -> server)
        for (const cid of local) {
          if (fromServer.has(cid)) continue;
          await supabase.from('content_likes').upsert(
            { user_id: user.id, content_id: cid },
            { onConflict: 'user_id,content_id' }
          );
          if (cancelled) return;
        }

        // Merge: server + local (server is source of truth after sync)
        const merged = new Set([...fromServer, ...local]);
        setLikedIds(merged);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    };

    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      syncFromSupabase();
    }
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isLiked = useCallback(
    (contentId: string) => likedIds.has(contentId),
    [likedIds],
  );

  const toggleLike = useCallback(
    async (contentId: string, context?: LikeContext | null): Promise<{ success: boolean; liked: boolean }> => {
      const nextLiked = !likedIds.has(contentId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (nextLiked) next.add(contentId);
        else next.delete(contentId);
        return next;
      });

      // Optimistic update: adjust cached count if we have one (instant UI)
      setLikeCounts((prev) => {
        const cur = prev[contentId];
        if (cur == null) return prev;
        const next = { ...prev };
        next[contentId] = Math.max(0, cur + (nextLiked ? 1 : -1));
        return next;
      });

      if (user?.id) {
        // When offline, queue for sync to content_likes + track-interaction backfill
        if (isOffline) {
          queueAction('like', {
            user_id: user.id,
            content_id: contentId,
            liked: nextLiked,
            ...(context && {
              contentType: context.contentType ?? 'video',
              tags: context.tags ?? [],
              category: context.category ?? null,
            }),
          });
          return { success: true, liked: nextLiked };
        }
        try {
          if (nextLiked) {
            const { error } = await supabase.from('content_likes').upsert(
              { user_id: user.id, content_id: contentId },
              { onConflict: 'user_id,content_id' }
            );
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('content_likes')
              .delete()
              .eq('user_id', user.id)
              .eq('content_id', contentId);
            if (error) throw error;
          }
          return { success: true, liked: nextLiked };
        } catch (e) {
          console.warn('[useContentLikes] Sync failed:', e);
          // Revert on error
          setLikedIds((prev) => {
            const next = new Set(prev);
            if (nextLiked) next.delete(contentId);
            else next.add(contentId);
            return next;
          });
          setLikeCounts((prev) => {
            const cur = prev[contentId];
            if (cur == null) return prev;
            const next = { ...prev };
            next[contentId] = Math.max(0, cur + (nextLiked ? -1 : 1));
            return next;
          });
          return { success: false, liked: !nextLiked };
        }
      }
      return { success: true, liked: nextLiked };
    },
    [user?.id, likedIds, isOffline, queueAction],
  );

  /** Prime like counts from feed data (e.g. user_content.likes_count). Avoids extra fetch when data is fresh. */
  const setLikeCountsFromFeed = useCallback((counts: Record<string, number>) => {
    setLikeCounts((prev) => ({ ...prev, ...counts }));
  }, []);

  /** Fetch like counts for multiple content IDs (server aggregate via RPC). content_id is TEXT: UUIDs and promo IDs both supported. */
  const fetchLikeCounts = useCallback(async (contentIds: string[]) => {
    if (contentIds.length === 0) return;
    const ids = contentIds.map((id) => String(id));
    try {
      const { data, error } = await supabase.rpc('get_content_like_counts', {
        ids,
        p_user_id: user?.id ?? null,
      });
      if (error) {
        console.warn('[useContentLikes] get_content_like_counts failed:', error);
        return;
      }
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.content_id] = Number(row.like_count) || 0;
      }
      setLikeCounts((prev) => ({ ...prev, ...counts }));
    } catch (e) {
      console.warn('[useContentLikes] fetchLikeCounts error:', e);
    }
  }, [user?.id]);

  const getLikeCount = useCallback(
    (contentId: string, baseCount: number = 0): number => {
      const serverCount = likeCounts[contentId];
      if (serverCount != null) return serverCount;
      return baseCount + (likedIds.has(contentId) ? 1 : 0);
    },
    [likeCounts, likedIds],
  );

  return {
    likedIds,
    isLiked,
    toggleLike,
    fetchLikeCounts,
    setLikeCountsFromFeed,
    getLikeCount,
    count: likedIds.size,
    syncing,
  };
};
