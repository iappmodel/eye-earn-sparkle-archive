import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserContentItem {
  id: string;
  type: 'video' | 'image';
  thumbnail: string;
  mediaUrl?: string;
  title?: string;
  caption?: string;
  likes: number;
  views: number;
  createdAt: Date;
}

export const useUserContent = (userId?: string) => {
  const { user } = useAuth();
  const [content, setContent] = useState<UserContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchContent = useCallback(async () => {
    if (!targetUserId) {
      setContent([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('user_content')
        .select(`
          id,
          content_type,
          media_type,
          media_url,
          thumbnail_url,
          title,
          caption,
          likes_count,
          views_count,
          created_at
        `)
        .eq('user_id', targetUserId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useUserContent] Error fetching content:', fetchError);
        setError(fetchError.message);
        return;
      }

      const transformedContent: UserContentItem[] = (data || []).map(item => {
        const isVideo = item.content_type === 'video' || 
                       item.media_type === 'video' || 
                       item.media_url?.includes('.mp4');
        
        return {
          id: item.id,
          type: isVideo ? 'video' : 'image',
          thumbnail: item.thumbnail_url || item.media_url || '',
          mediaUrl: item.media_url,
          title: item.title,
          caption: item.caption,
          likes: item.likes_count || 0,
          views: item.views_count || 0,
          createdAt: new Date(item.created_at),
        };
      });

      setContent(transformedContent);
    } catch (err) {
      console.error('[useUserContent] Unexpected error:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

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
