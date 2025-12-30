import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
  timestamp: Date;
  likes: number;
  isLiked: boolean;
  replies?: Comment[];
}

export const useComments = (contentId: string) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!contentId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Fetch comments for this content
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id, content, user_id, likes_count, created_at, parent_id')
        .eq('content_id', contentId)
        .is('parent_id', null) // Only top-level comments
        .order('created_at', { ascending: false });

      if (commentsError) {
        console.error('[useComments] Error fetching comments:', commentsError);
        setError(commentsError.message);
        return;
      }

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Get user IDs for profile lookup
      const userIds = [...new Set(commentsData.map(c => c.user_id))];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Fetch user's likes if logged in
      let userLikes = new Set<string>();
      if (user) {
        const { data: likesData } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentsData.map(c => c.id));

        userLikes = new Set(likesData?.map(l => l.comment_id) || []);
      }

      // Transform to Comment format
      const transformedComments: Comment[] = commentsData.map(c => {
        const profile = profileMap.get(c.user_id);
        return {
          id: c.id,
          userId: c.user_id,
          username: profile?.username || 'user',
          avatar: profile?.avatar_url,
          content: c.content,
          timestamp: new Date(c.created_at),
          likes: c.likes_count,
          isLiked: userLikes.has(c.id),
        };
      });

      setComments(transformedComments);
    } catch (err) {
      console.error('[useComments] Unexpected error:', err);
      setError('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [contentId, user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!contentId) return;

    fetchComments();

    const channel = supabase
      .channel(`comments:${contentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `content_id=eq.${contentId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contentId, fetchComments]);

  const addComment = useCallback(async (content: string): Promise<boolean> => {
    if (!user || !contentId || !content.trim()) return false;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          content_id: contentId,
          user_id: user.id,
          content: content.trim(),
        });

      if (error) {
        console.error('[useComments] Error adding comment:', error);
        return false;
      }

      // Refresh will happen via realtime
      return true;
    } catch (err) {
      console.error('[useComments] Unexpected error adding comment:', err);
      return false;
    }
  }, [user, contentId]);

  const toggleLike = useCallback(async (commentId: string): Promise<boolean> => {
    if (!user) return false;

    const comment = comments.find(c => c.id === commentId);
    if (!comment) return false;

    try {
      if (comment.isLiked) {
        // Unlike
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (error) {
          console.error('[useComments] Error unliking:', error);
          return false;
        }
      } else {
        // Like
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: user.id,
          });

        if (error) {
          console.error('[useComments] Error liking:', error);
          return false;
        }
      }

      // Optimistic update
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            isLiked: !c.isLiked,
            likes: c.isLiked ? c.likes - 1 : c.likes + 1,
          };
        }
        return c;
      }));

      return true;
    } catch (err) {
      console.error('[useComments] Unexpected error toggling like:', err);
      return false;
    }
  }, [user, comments]);

  return {
    comments,
    isLoading,
    error,
    addComment,
    toggleLike,
    refresh: fetchComments,
  };
};
