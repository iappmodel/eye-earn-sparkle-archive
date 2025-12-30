import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useFollow = (targetUserId: string | null) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!targetUserId) return;

    const checkFollowStatus = async () => {
      if (user) {
        const { data } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle();
        
        setIsFollowing(!!data);
      }

      // Get counts from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('followers_count, following_count')
        .eq('user_id', targetUserId)
        .single();

      if (profile) {
        setFollowersCount(profile.followers_count || 0);
        setFollowingCount(profile.following_count || 0);
      }
    };

    checkFollowStatus();
  }, [user, targetUserId]);

  const toggleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow users');
      return;
    }

    if (!targetUserId || user.id === targetUserId) {
      return;
    }

    setIsLoading(true);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (error) throw error;
        
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        toast.success('Unfollowed');
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });

        if (error) throw error;
        
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast.success('Following!');
      }
    } catch (error: any) {
      console.error('Follow error:', error);
      toast.error('Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isFollowing,
    isLoading,
    followersCount,
    followingCount,
    toggleFollow
  };
};
