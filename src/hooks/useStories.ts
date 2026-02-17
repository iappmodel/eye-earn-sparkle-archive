/**
 * useStories – load stories from API and record views.
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchStories, recordStoryView, type Story } from '@/services/stories.service';

export function useStories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchStories(user?.id ?? null);
      setStories(list);
    } catch (e) {
      console.error('[useStories] load error:', e);
      setError(e instanceof Error ? e.message : 'Failed to load stories');
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const markAsViewed = useCallback(
    async (contentId: string, _contentOwnerId: string) => {
      await recordStoryView(contentId, _contentOwnerId);
      await load();
    },
    [load]
  );

  return { stories, loading, error, refetch: load, markAsViewed };
}
