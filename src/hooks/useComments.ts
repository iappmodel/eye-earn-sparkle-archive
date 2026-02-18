/**
 * useComments – Full-featured comments for user_content and promotions.
 * Supports realtime updates, sort options, delete, character limit, and content_type.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/** Maximum comment length (enforced client-side and recommended server-side) */
export const COMMENT_MAX_LENGTH = 500;

export type CommentSort = 'newest' | 'oldest' | 'top';

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
  timestamp: Date;
  likes: number;
  isLiked: boolean;
  parentId?: string | null;
  replies?: Comment[];
}

export interface UseCommentsOptions {
  /** Content ID (user_content.id or promotion.id) – null disables fetch */
  contentId: string | null;
  /** Content source for correct DB semantics (user_content vs promotion) */
  contentType?: 'user_content' | 'promotion';
  /** Sort order for top-level comments */
  sort?: CommentSort;
  /** Enable realtime subscription for live updates */
  enableRealtime?: boolean;
}

function buildCommentFromRow(
  r: { id: string; content: string; user_id: string; likes_count: number; parent_id: string | null; created_at: string },
  profileMap: Map<string, { username: string; avatar?: string }>,
  likedIds: Set<string>
): Comment {
  const profile = profileMap.get(r.user_id);
  return {
    id: r.id,
    userId: r.user_id,
    username: profile?.username ?? 'user',
    avatar: profile?.avatar,
    content: r.content,
    timestamp: new Date(r.created_at),
    likes: r.likes_count ?? 0,
    isLiked: likedIds.has(r.id),
    parentId: r.parent_id,
    replies: [],
  };
}

function sortTopLevel(comments: Comment[], sort: CommentSort): Comment[] {
  const copy = [...comments];
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    case 'top':
      return copy.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    case 'newest':
    default:
      return copy.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export function useComments(options: UseCommentsOptions | string | null) {
  const opts = typeof options === 'string' || options === null
    ? { contentId: options, sort: 'newest' as CommentSort, enableRealtime: true }
    : { sort: 'newest' as CommentSort, enableRealtime: true, ...options };

  const { contentId, contentType = 'user_content', sort = 'newest', enableRealtime = true } = opts;
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<CommentSort>(sort);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchComments = useCallback(async () => {
    if (!contentId || contentId.trim() === '') {
      setComments([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: rows, error: fetchError } = await supabase
        .from('comments')
        .select('id, content, user_id, likes_count, parent_id, created_at')
        .eq('content_id', contentId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        setComments([]);
        return;
      }

      if (!rows || rows.length === 0) {
        setComments([]);
        return;
      }

      const topLevel = rows.filter((r) => !r.parent_id);
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('user_id, username, avatar_url, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [
          p.user_id,
          {
            username: p.username || p.display_name || 'user',
            avatar: p.avatar_url,
          },
        ])
      );

      let likedCommentIds = new Set<string>();
      if (user) {
        const { data: likes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', rows.map((r) => r.id));
        likedCommentIds = new Set((likes || []).map((l) => l.comment_id));
      }

      const idToComment = new Map<string, Comment>();
      for (const r of rows) {
        const c = buildCommentFromRow(r, profileMap, likedCommentIds);
        idToComment.set(r.id, c);
      }

      for (const r of rows) {
        if (r.parent_id) {
          const parent = idToComment.get(r.parent_id);
          const child = idToComment.get(r.id);
          if (parent && child) parent.replies!.push(child);
        }
      }

      const topLevelComments = topLevel
        .map((r) => idToComment.get(r.id))
        .filter((c): c is Comment => !!c);

      setComments(sortTopLevel(topLevelComments, sortBy));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [contentId, user?.id, sortBy]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!enableRealtime || !contentId || contentId.trim() === '') return;

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

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [contentId, enableRealtime, fetchComments]);

  const addComment = useCallback(
    async (content: string) => {
      if (!user || !contentId || !content.trim()) return null;
      const trimmed = content.trim();
      if (trimmed.length > COMMENT_MAX_LENGTH) {
        toast.error(`Comment must be under ${COMMENT_MAX_LENGTH} characters`);
        return null;
      }

      const insertPayload: Record<string, unknown> = {
        content: trimmed,
        content_id: contentId,
        content_type: contentType,
        user_id: user.id,
        likes_count: 0,
        parent_id: null,
      };

      const { data, error: insertError } = await supabase
        .from('comments')
        .insert(insertPayload)
        .select('id, content, user_id, likes_count, created_at')
        .single();

      if (insertError) throw new Error(insertError.message);
      if (!data) return null;

      const profile = await supabase
        .from('profiles')
        .select('username, avatar_url, display_name')
        .eq('user_id', user.id)
        .single();

      const newComment: Comment = {
        id: data.id,
        userId: data.user_id,
        username:
          profile.data?.username ||
          profile.data?.display_name ||
          user.user_metadata?.username ||
          'you',
        avatar: profile.data?.avatar_url ?? user.user_metadata?.avatar_url,
        content: data.content,
        timestamp: new Date(data.created_at),
        likes: 0,
        isLiked: false,
      };

      setComments((prev) => sortTopLevel([newComment, ...prev], sortBy));
      return newComment;
    },
    [user, contentId, contentType, sortBy]
  );

  const addReply = useCallback(
    async (content: string, parentId: string) => {
      if (!user || !contentId || !content.trim()) return null;
      const trimmed = content.trim();
      if (trimmed.length > COMMENT_MAX_LENGTH) {
        toast.error(`Comment must be under ${COMMENT_MAX_LENGTH} characters`);
        return null;
      }

      const { data, error: insertError } = await supabase
        .from('comments')
        .insert({
          content: trimmed,
          content_id: contentId,
          content_type: contentType,
          user_id: user.id,
          likes_count: 0,
          parent_id: parentId,
        })
        .select('id, content, user_id, likes_count, created_at')
        .single();

      if (insertError) throw new Error(insertError.message);
      if (!data) return null;

      const profile = await supabase
        .from('profiles')
        .select('username, avatar_url, display_name')
        .eq('user_id', user.id)
        .single();

      const newReply: Comment = {
        id: data.id,
        userId: data.user_id,
        username:
          profile.data?.username ||
          profile.data?.display_name ||
          user.user_metadata?.username ||
          'you',
        avatar: profile.data?.avatar_url ?? user.user_metadata?.avatar_url,
        content: data.content,
        timestamp: new Date(data.created_at),
        likes: 0,
        isLiked: false,
        parentId,
        replies: [],
      };

      const appendReply = (list: Comment[]): Comment[] =>
        list.map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: [...(c.replies ?? []), newReply].sort(
                  (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                ),
              }
            : { ...c, replies: appendReply(c.replies ?? []) }
        );

      setComments((prev) => appendReply(prev));
      return newReply;
    },
    [user, contentId, contentType]
  );

  const findComment = useCallback((comments: Comment[], id: string): Comment | undefined => {
    for (const c of comments) {
      if (c.id === id) return c;
      const inReplies = findComment(c.replies ?? [], id);
      if (inReplies) return inReplies;
    }
    return undefined;
  }, []);

  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!user) return false;
      const comment = findComment(comments, commentId);
      if (!comment) return false;
      if (comment.userId !== user.id) {
        toast.error('You can only delete your own comments');
        return false;
      }

      const { error: deleteError } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (deleteError) {
        toast.error('Could not delete comment', { description: deleteError.message });
        return false;
      }

      const removeComment = (list: Comment[]): Comment[] =>
        list
          .filter((c) => c.id !== commentId)
          .map((c) => ({ ...c, replies: removeComment(c.replies ?? []) }));
      setComments((prev) => removeComment(prev));
      return true;
    },
    [user, comments, findComment]
  );

  const toggleLike = useCallback(
    async (commentId: string) => {
      if (!user) return;

      const comment = findComment(comments, commentId);
      if (!comment) return;

      if (comment.isLiked) {
        const { error: deleteError } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (deleteError) {
          toast.error('Could not unlike comment', { description: 'Please try again.' });
          return;
        }
        await supabase
          .from('comments')
          .update({ likes_count: Math.max(0, (comment.likes ?? 0) - 1) })
          .eq('id', commentId);

        const updateUnlike = (list: Comment[]): Comment[] =>
          list.map((c) =>
            c.id === commentId
              ? { ...c, isLiked: false, likes: Math.max(0, c.likes - 1) }
              : c.replies?.length
                ? { ...c, replies: updateUnlike(c.replies) }
                : c
          );
        setComments((prev) => updateUnlike(prev));
      } else {
        const { error: insertError } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user.id });

        if (insertError) {
          toast.error('Could not like comment', { description: 'Please try again.' });
          return;
        }
        await supabase
          .from('comments')
          .update({ likes_count: (comment.likes ?? 0) + 1 })
          .eq('id', commentId);

        const updateLike = (list: Comment[]): Comment[] =>
          list.map((c) =>
            c.id === commentId
              ? { ...c, isLiked: true, likes: c.likes + 1 }
              : c.replies?.length
                ? { ...c, replies: updateLike(c.replies) }
                : c
          );
        setComments((prev) => updateLike(prev));
      }
    },
    [user, comments, findComment]
  );

  const setSort = useCallback((s: CommentSort) => {
    setSortBy(s);
  }, []);

  return {
    comments,
    loading,
    error,
    sortBy,
    setSortBy: setSort,
    addComment,
    addReply,
    toggleLike,
    deleteComment,
    refetch: fetchComments,
    totalCount: comments.reduce(
      (sum, c) => sum + 1 + (c.replies?.length ?? 0),
      0
    ),
  };
}
