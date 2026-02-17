import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { rewardsService } from '@/services/rewards.service';

/** Promo location info stored when saving a promo for add-to-route with real coordinates */
export interface SavedPromoLocation {
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

export interface SavedVideo {
  id: string;
  contentId: string;
  title: string;
  thumbnail: string;
  type: 'promo' | 'video' | 'image';
  /** Actual video source URL for playback */
  videoSrc?: string;
  /** Image / poster source URL */
  src?: string;
  creator?: {
    id?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  reward?: { amount: number; type: 'vicoin' | 'icoin' };
  duration?: number;
  savedAt: number;
  /** Whether this promo requires a physical visit / action */
  requiresPhysicalAction?: boolean;
  /** Whether this video has been added to a route */
  addedToRoute?: boolean;
  /** Real promo location (for add-to-route); stored at save time when available */
  promoLocation?: SavedPromoLocation;
}

/** Metadata we store in Supabase (snapshot at save time) */
interface SavedVideoMetadata {
  title: string;
  thumbnail: string;
  type: 'promo' | 'video' | 'image';
  videoSrc?: string;
  src?: string;
  creator?: SavedVideo['creator'];
  reward?: SavedVideo['reward'];
  duration?: number;
  requiresPhysicalAction?: boolean;
  addedToRoute?: boolean;
  promoLocation?: SavedPromoLocation;
}

const SAVED_VIDEOS_KEY = 'visuai-saved-videos';

/**
 * Saved videos sync rules (server is source of truth after sync):
 *
 * 1. List & content metadata (title, thumbnail, type, etc.): server wins after sync.
 * 2. Local-only metadata (e.g. addedToRoute): can diverge if set offline or before sync.
 *    Conflict resolution: for items present on both local and server, we merge local-only
 *    fields with "local wins if true" (user intent to mark e.g. addedToRoute is preserved),
 *    then push merged metadata to server so server becomes source of truth.
 * 3. New local-only items: pushed to server on sync, then list is refetched from server.
 */
const LOCAL_ONLY_METADATA_KEYS: (keyof SavedVideoMetadata)[] = ['addedToRoute'];

function mergeLocalOnlyMetadata(
  serverMeta: SavedVideoMetadata | null,
  localMeta: SavedVideoMetadata | null,
): SavedVideoMetadata {
  const base = serverMeta || localMeta || {};
  const merged = { ...base };
  for (const key of LOCAL_ONLY_METADATA_KEYS) {
    const localVal = localMeta?.[key];
    const serverVal = serverMeta?.[key];
    // Local wins when it's explicitly true (user action we don't want to lose)
    if (localVal === true && serverVal !== true) {
      (merged as Record<string, unknown>)[key] = true;
    } else if (serverVal !== undefined) {
      (merged as Record<string, unknown>)[key] = serverVal;
    }
  }
  return merged as SavedVideoMetadata;
}

const loadSavedVideos = (): SavedVideo[] => {
  try {
    const raw = localStorage.getItem(SAVED_VIDEOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persistSavedVideos = (videos: SavedVideo[]) => {
  try {
    localStorage.setItem(SAVED_VIDEOS_KEY, JSON.stringify(videos));
  } catch {
    // Storage full or unavailable
  }
};

function rowToSavedVideo(row: { content_id: string; created_at: string; metadata: SavedVideoMetadata | null }): SavedVideo {
  const meta = row.metadata || {};
  return {
    id: `saved-${row.content_id}`,
    contentId: row.content_id,
    title: meta.title ?? 'Untitled',
    thumbnail: meta.thumbnail ?? '',
    type: meta.type ?? 'video',
    videoSrc: meta.videoSrc,
    src: meta.src,
    creator: meta.creator,
    reward: meta.reward,
    duration: meta.duration,
    requiresPhysicalAction: meta.requiresPhysicalAction,
    addedToRoute: meta.addedToRoute,
    promoLocation: meta.promoLocation,
    savedAt: new Date(row.created_at).getTime(),
  };
}

function videoToMetadata(video: Omit<SavedVideo, 'savedAt'>): SavedVideoMetadata {
  return {
    title: video.title,
    thumbnail: video.thumbnail,
    type: video.type,
    videoSrc: video.videoSrc,
    src: video.src,
    creator: video.creator,
    reward: video.reward,
    duration: video.duration,
    requiresPhysicalAction: video.requiresPhysicalAction,
    addedToRoute: video.addedToRoute,
    promoLocation: video.promoLocation,
  };
}

export const useSavedVideos = () => {
  const { user } = useAuth();
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>(loadSavedVideos);
  const [syncing, setSyncing] = useState(false);
  const initialFetchDone = useRef(false);

  // Persist to localStorage on every change
  useEffect(() => {
    persistSavedVideos(savedVideos);
  }, [savedVideos]);

  // When logged in: fetch from Supabase and merge with local; then use server as source of truth
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
          .from('saved_content')
          .select('content_id, created_at, metadata')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (error) {
          console.warn('Saved videos fetch failed:', error);
          return;
        }

        const fromServer = (rows || []).map(rowToSavedVideo);
        const local = loadSavedVideos();
        const localByContentId = new Map(local.map((v) => [v.contentId, v]));
        const serverIds = new Set(fromServer.map((v) => v.contentId));

        // Push any local-only items to Supabase (merge local -> server)
        for (const v of local) {
          if (serverIds.has(v.contentId)) continue;
          await supabase.from('saved_content').upsert(
            {
              user_id: user.id,
              content_id: v.contentId,
              metadata: videoToMetadata(v),
            },
            { onConflict: 'user_id,content_id' }
          );
          if (cancelled) return;
        }

        // Conflict resolution: for items on both server and local, merge local-only metadata
        // (e.g. addedToRoute) and push to server so server stays source of truth
        const serverByContentId = new Map(
          (rows || []).map((r) => [r.content_id, r.metadata as SavedVideoMetadata | null]),
        );
        for (const v of fromServer) {
          const localItem = localByContentId.get(v.contentId);
          if (!localItem) continue;
          const serverMeta = serverByContentId.get(v.contentId) || null;
          const localMeta = videoToMetadata(localItem);
          const resolvedMeta = mergeLocalOnlyMetadata(serverMeta, localMeta);
          if (JSON.stringify(resolvedMeta) === JSON.stringify(serverMeta)) continue;
          await supabase
            .from('saved_content')
            .update({ metadata: resolvedMeta })
            .eq('user_id', user.id)
            .eq('content_id', v.contentId);
          if (cancelled) return;
        }

        // Refetch after upserts/updates to get final list (server is source of truth)
        const { data: afterRows } = await supabase
          .from('saved_content')
          .select('content_id, created_at, metadata')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (cancelled) return;
        const merged = (afterRows || []).map(rowToSavedVideo);
        setSavedVideos(merged);
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

  const isSaved = useCallback(
    (contentId: string) => savedVideos.some((v) => v.contentId === contentId),
    [savedVideos],
  );

  const saveVideo = useCallback(
    async (video: Omit<SavedVideo, 'savedAt'>) => {
      setSavedVideos((prev) => {
        if (prev.some((v) => v.contentId === video.contentId)) return prev;
        return [{ ...video, savedAt: Date.now() }, ...prev];
      });

      if (user?.id) {
        try {
          await supabase.from('saved_content').upsert(
            {
              user_id: user.id,
              content_id: video.contentId,
              metadata: videoToMetadata(video),
            },
            { onConflict: 'user_id,content_id' }
          );
          rewardsService.issueReward('save', video.contentId, {}).catch(() => {});
        } catch (e) {
          console.warn('Save for later sync failed:', e);
        }
      }
    },
    [user?.id],
  );

  const unsaveVideo = useCallback(
    async (contentId: string) => {
      setSavedVideos((prev) => prev.filter((v) => v.contentId !== contentId));

      if (user?.id) {
        try {
          await supabase.from('saved_content').delete().eq('user_id', user.id).eq('content_id', contentId);
        } catch (e) {
          console.warn('Unsave sync failed:', e);
        }
      }
    },
    [user?.id],
  );

  const toggleSave = useCallback(
    (video: Omit<SavedVideo, 'savedAt'>) => {
      const alreadySaved = savedVideos.some((v) => v.contentId === video.contentId);
      if (alreadySaved) {
        unsaveVideo(video.contentId);
        return false; // now unsaved
      }
      saveVideo(video);
      return true; // now saved
    },
    [savedVideos, saveVideo, unsaveVideo],
  );

  const markAddedToRoute = useCallback(
    async (contentId: string) => {
      setSavedVideos((prev) =>
        prev.map((v) => (v.contentId === contentId ? { ...v, addedToRoute: true } : v)),
      );

      if (user?.id) {
        const item = savedVideos.find((v) => v.contentId === contentId);
        if (item) {
          try {
            await supabase
              .from('saved_content')
              .update({ metadata: { ...videoToMetadata(item), addedToRoute: true } })
              .eq('user_id', user.id)
              .eq('content_id', contentId);
          } catch (e) {
            console.warn('markAddedToRoute sync failed:', e);
          }
        }
      }
    },
    [user?.id, savedVideos],
  );

  /** Remove multiple items at once (e.g. from multi-select) */
  const unsaveVideos = useCallback(
    async (contentIds: string[]) => {
      const set = new Set(contentIds);
      setSavedVideos((prev) => prev.filter((v) => !set.has(v.contentId)));
      if (user?.id) {
        try {
          await supabase
            .from('saved_content')
            .delete()
            .eq('user_id', user.id)
            .in('content_id', contentIds);
        } catch (e) {
          console.warn('Bulk unsave sync failed:', e);
        }
      }
    },
    [user?.id],
  );

  /** Export all saved videos as JSON (backup / transfer) */
  const exportAsJson = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      count: savedVideos.length,
      videos: savedVideos,
    };
    return JSON.stringify(payload, null, 2);
  }, [savedVideos]);

  /** Import from previously exported JSON; merges by contentId, skips duplicates */
  const importFromJson = useCallback(
    (json: string): { imported: number; skipped: number; errors: string[] } => {
      const errors: string[] = [];
      let imported = 0;
      let skipped = 0;
      try {
        const data = JSON.parse(json) as { videos?: SavedVideo[]; version?: number };
        const list = Array.isArray(data.videos) ? data.videos : [];
        const existingIds = new Set(savedVideos.map((v) => v.contentId));
        const toAdd: SavedVideo[] = [];
        for (const v of list) {
          if (!v?.contentId) {
            errors.push('Invalid item missing contentId');
            continue;
          }
          if (existingIds.has(v.contentId)) {
            skipped++;
            continue;
          }
          toAdd.push({
            ...v,
            id: v.id || `saved-${v.contentId}`,
            savedAt: v.savedAt || Date.now(),
          });
          existingIds.add(v.contentId);
          imported++;
        }
        if (toAdd.length > 0) {
          setSavedVideos((prev) => [...toAdd, ...prev]);
          if (user?.id) {
            toAdd.forEach((video) => {
              supabase
                .from('saved_content')
                .upsert(
                  {
                    user_id: user.id,
                    content_id: video.contentId,
                    metadata: videoToMetadata(video),
                  },
                  { onConflict: 'user_id,content_id' },
                )
                .then(() => {})
                .catch((e) => console.warn('Import sync failed for', video.contentId, e));
            });
          }
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return { imported, skipped, errors };
    },
    [savedVideos, user?.id],
  );

  /** Trigger a manual re-sync from Supabase (e.g. pull-to-refresh). Uses same sync rules: server list + conflict resolution for local-only metadata. */
  const refreshFromServer = useCallback(async () => {
    if (!user?.id) return;
    setSyncing(true);
    try {
      const { data: rows, error } = await supabase
        .from('saved_content')
        .select('content_id, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const fromServer = (rows || []).map(rowToSavedVideo);
      const local = loadSavedVideos();
      const localByContentId = new Map(local.map((v) => [v.contentId, v]));
      const serverByContentId = new Map(
        (rows || []).map((r) => [r.content_id, r.metadata as SavedVideoMetadata | null]),
      );
      // Resolve local-only metadata and push to server so server stays source of truth
      for (const v of fromServer) {
        const localItem = localByContentId.get(v.contentId);
        if (!localItem) continue;
        const serverMeta = serverByContentId.get(v.contentId) || null;
        const localMeta = videoToMetadata(localItem);
        const resolvedMeta = mergeLocalOnlyMetadata(serverMeta, localMeta);
        if (JSON.stringify(resolvedMeta) === JSON.stringify(serverMeta)) continue;
        await supabase
          .from('saved_content')
          .update({ metadata: resolvedMeta })
          .eq('user_id', user.id)
          .eq('content_id', v.contentId);
      }
      const { data: afterRows, error: refetchError } = await supabase
        .from('saved_content')
        .select('content_id, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (refetchError) throw refetchError;
      const merged = (afterRows || []).map(rowToSavedVideo);
      setSavedVideos(merged);
    } catch (e) {
      console.warn('Refresh from server failed:', e);
    } finally {
      setSyncing(false);
    }
  }, [user?.id]);

  return {
    savedVideos,
    isSaved,
    saveVideo,
    unsaveVideo,
    unsaveVideos,
    toggleSave,
    markAddedToRoute,
    count: savedVideos.length,
    syncing,
    exportAsJson,
    importFromJson,
    refreshFromServer,
  };
};
