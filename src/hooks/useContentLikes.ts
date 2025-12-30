import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useContentLikes = (contentId: string | null) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contentId) return;

    const fetchStatus = async () => {
      // Get likes count
      const { count } = await supabase
        .from('content_likes')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', contentId);
      
      setLikesCount(count || 0);

      if (user) {
        // Check if user liked
        const { data: likeData } = await supabase
          .from('content_likes')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .maybeSingle();
        
        setIsLiked(!!likeData);

        // Check if user saved
        const { data: saveData } = await supabase
          .from('saved_content')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .maybeSingle();
        
        setIsSaved(!!saveData);
      }
    };

    fetchStatus();
  }, [contentId, user]);

  const toggleLike = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to like content');
      return;
    }
    if (!contentId) return;

    setIsLoading(true);
    try {
      if (isLiked) {
        const { error } = await supabase
          .from('content_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('content_id', contentId);

        if (error) throw error;
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from('content_likes')
          .insert({ user_id: user.id, content_id: contentId });

        if (error) throw error;
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Like error:', error);
      toast.error('Failed to update like');
    } finally {
      setIsLoading(false);
    }
  }, [user, contentId, isLiked]);

  const toggleSave = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to save content');
      return;
    }
    if (!contentId) return;

    setIsLoading(true);
    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_content')
          .delete()
          .eq('user_id', user.id)
          .eq('content_id', contentId);

        if (error) throw error;
        setIsSaved(false);
        toast.success('Removed from saved');
      } else {
        const { error } = await supabase
          .from('saved_content')
          .insert({ user_id: user.id, content_id: contentId });

        if (error) throw error;
        setIsSaved(true);
        toast.success('Saved!');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to update save');
    } finally {
      setIsLoading(false);
    }
  }, [user, contentId, isSaved]);

  return {
    isLiked,
    isSaved,
    likesCount,
    isLoading,
    toggleLike,
    toggleSave
  };
};
