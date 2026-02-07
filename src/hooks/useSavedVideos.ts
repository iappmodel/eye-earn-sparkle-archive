import { useState, useCallback, useEffect } from 'react';

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
}

const SAVED_VIDEOS_KEY = 'visuai-saved-videos';

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

export const useSavedVideos = () => {
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>(loadSavedVideos);

  // Sync to localStorage on every change
  useEffect(() => {
    persistSavedVideos(savedVideos);
  }, [savedVideos]);

  const isSaved = useCallback(
    (contentId: string) => savedVideos.some((v) => v.contentId === contentId),
    [savedVideos],
  );

  const saveVideo = useCallback((video: Omit<SavedVideo, 'savedAt'>) => {
    setSavedVideos((prev) => {
      if (prev.some((v) => v.contentId === video.contentId)) return prev;
      return [{ ...video, savedAt: Date.now() }, ...prev];
    });
  }, []);

  const unsaveVideo = useCallback((contentId: string) => {
    setSavedVideos((prev) => prev.filter((v) => v.contentId !== contentId));
  }, []);

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

  const markAddedToRoute = useCallback((contentId: string) => {
    setSavedVideos((prev) =>
      prev.map((v) => (v.contentId === contentId ? { ...v, addedToRoute: true } : v)),
    );
  }, []);

  return {
    savedVideos,
    isSaved,
    saveVideo,
    unsaveVideo,
    toggleSave,
    markAddedToRoute,
    count: savedVideos.length,
  };
};
