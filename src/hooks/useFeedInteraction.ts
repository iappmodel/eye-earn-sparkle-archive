/**
 * useFeedInteraction – unified like state (useContentLikes) + analytics (track-interaction).
 * Use in PersonalizedFeed, UnifiedContentFeed, and anywhere feed items are shown so likes
 * sync across all feeds and personalization receives like/share/feedback signals.
 * Platform rewards VICOIN for engagement (like/share); rewards are issued in the background.
 */
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useContentLikes } from '@/hooks/useContentLikes';
import { rewardsService } from '@/services/rewards.service';

export interface FeedItemContext {
  tags?: string[];
  category?: string | null;
  contentType?: 'video' | 'image' | 'reel' | 'story';
}

export function useFeedInteraction() {
  const { user } = useAuth();
  const contentLikes = useContentLikes();

  /** Toggle like (persisted via content_likes) and send like/unlike to track-interaction for personalization. */
  const handleLike = useCallback(
    async (
      contentId: string,
      context?: FeedItemContext | null
    ): Promise<{ success: boolean; liked: boolean }> => {
      const result = await contentLikes.toggleLike(contentId, context);

      if (user && result.success) {
        try {
          await supabase.functions.invoke('track-interaction', {
            body: {
              contentId,
              contentType: context?.contentType ?? 'video',
              action: result.liked ? 'like' : 'unlike',
              tags: context?.tags ?? [],
              category: context?.category ?? null,
            },
          });
        } catch (err) {
          console.warn('[useFeedInteraction] track-interaction like/unlike failed:', err);
        }
        // Platform rewards VICOIN for beneficial engagement (like)
        if (result.liked) {
          rewardsService.issueReward('like', contentId, {}).catch(() => {});
        }
      }

      return result;
    },
    [user, contentLikes]
  );

  /** Report share to track-interaction (analytics + engagement score). Rewards VICOIN for share. */
  const trackShare = useCallback(
    async (contentId: string, context?: FeedItemContext | null) => {
      if (!user) return;
      try {
        await supabase.functions.invoke('track-interaction', {
          body: {
            contentId,
            contentType: context?.contentType ?? 'video',
            action: 'share',
            tags: context?.tags ?? [],
            category: context?.category ?? null,
          },
        });
      } catch (err) {
        console.warn('[useFeedInteraction] track-interaction share failed:', err);
      }
      rewardsService.issueReward('share', contentId, {}).catch(() => {});
    },
    [user]
  );

  /** Report "more/less" feedback for personalization. */
  const trackFeedback = useCallback(
    async (
      contentId: string,
      feedback: 'more' | 'less',
      context?: FeedItemContext | null
    ) => {
      if (!user) return;
      try {
        await supabase.functions.invoke('track-interaction', {
          body: {
            contentId,
            contentType: context?.contentType ?? 'video',
            action: 'feedback',
            feedback,
            tags: context?.tags ?? [],
            category: context?.category ?? null,
          },
        });
      } catch (err) {
        console.warn('[useFeedInteraction] track-interaction feedback failed:', err);
      }
    },
    [user]
  );

  return {
    ...contentLikes,
    handleLike,
    trackShare,
    trackFeedback,
  };
}
