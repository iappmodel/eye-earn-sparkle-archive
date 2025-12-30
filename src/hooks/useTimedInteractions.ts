import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TimedInteraction {
  id: string;
  content_id: string;
  user_id: string;
  interaction_type: 'comment' | 'like' | 'reward';
  timestamp_seconds: number;
  message?: string;
  coin_type?: string;
  amount?: number;
  is_visible: boolean;
  created_at: string;
  user?: {
    username: string;
    avatar_url?: string;
  };
}

interface Contributor {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_icoin_contributed: number;
  total_vicoin_contributed: number;
  interaction_count: number;
  last_interaction_at?: string;
}

interface UserSettings {
  showTimedInteractions: boolean;
  showContributorBadges: boolean;
}

export const useTimedInteractions = (contentId?: string) => {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<TimedInteraction[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    showTimedInteractions: true,
    showContributorBadges: true,
  });
  const [loading, setLoading] = useState(false);

  // Fetch user settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('show_timed_interactions, show_contributor_badges')
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setSettings({
          showTimedInteractions: data.show_timed_interactions ?? true,
          showContributorBadges: data.show_contributor_badges ?? true,
        });
      }
    };

    fetchSettings();
  }, [user]);

  // Fetch interactions for content
  useEffect(() => {
    if (!contentId) return;

    const fetchInteractions = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('timed_interactions')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('content_id', contentId)
        .eq('is_visible', true)
        .order('timestamp_seconds', { ascending: true });

      if (!error && data) {
        const formattedInteractions = data.map((item: any) => ({
          ...item,
          user: item.profiles ? {
            username: item.profiles.username,
            avatar_url: item.profiles.avatar_url,
          } : undefined,
        }));
        setInteractions(formattedInteractions);
      }
      
      setLoading(false);
    };

    fetchInteractions();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`timed-interactions-${contentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'timed_interactions',
          filter: `content_id=eq.${contentId}`,
        },
        async (payload) => {
          // Fetch user info for the new interaction
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('user_id', payload.new.user_id)
            .single();

          const newInteraction: TimedInteraction = {
            ...payload.new as any,
            user: profileData ? {
              username: profileData.username,
              avatar_url: profileData.avatar_url,
            } : undefined,
          };

          setInteractions((prev) => [...prev, newInteraction].sort(
            (a, b) => a.timestamp_seconds - b.timestamp_seconds
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contentId]);

  // Fetch contributors for content
  useEffect(() => {
    if (!contentId) return;

    const fetchContributors = async () => {
      const { data, error } = await supabase
        .from('content_contributors')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('content_id', contentId)
        .order('total_icoin_contributed', { ascending: false })
        .order('total_vicoin_contributed', { ascending: false })
        .limit(20);

      if (!error && data) {
        const formattedContributors = data.map((item: any) => ({
          user_id: item.user_id,
          username: item.profiles?.username || 'Unknown',
          avatar_url: item.profiles?.avatar_url,
          total_icoin_contributed: item.total_icoin_contributed || 0,
          total_vicoin_contributed: item.total_vicoin_contributed || 0,
          interaction_count: item.interaction_count || 0,
          last_interaction_at: item.last_interaction_at,
        }));
        setContributors(formattedContributors);
      }
    };

    fetchContributors();
  }, [contentId]);

  // Add a timed interaction
  const addInteraction = useCallback(async (
    interactionType: 'comment' | 'like' | 'reward',
    timestampSeconds: number,
    options?: {
      message?: string;
      coinType?: string;
      amount?: number;
    }
  ) => {
    if (!user || !contentId) {
      toast.error('Please sign in to interact');
      return null;
    }

    const { data, error } = await supabase
      .from('timed_interactions')
      .insert({
        content_id: contentId,
        user_id: user.id,
        interaction_type: interactionType,
        timestamp_seconds: timestampSeconds,
        message: options?.message,
        coin_type: options?.coinType,
        amount: options?.amount,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add interaction:', error);
      toast.error('Failed to add interaction');
      return null;
    }

    return data;
  }, [user, contentId]);

  // Update settings
  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    if (!user) return;

    const updates: any = {};
    if (newSettings.showTimedInteractions !== undefined) {
      updates.show_timed_interactions = newSettings.showTimedInteractions;
    }
    if (newSettings.showContributorBadges !== undefined) {
      updates.show_contributor_badges = newSettings.showContributorBadges;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update settings');
      return;
    }

    setSettings((prev) => ({ ...prev, ...newSettings }));
    toast.success('Settings updated');
  }, [user]);

  // Get creator's top contributors (for creator dashboard)
  const getMyTopContributors = useCallback(async () => {
    if (!user) return [];

    // Get all content by user
    const { data: myContent } = await supabase
      .from('user_content')
      .select('id')
      .eq('user_id', user.id);

    if (!myContent || myContent.length === 0) return [];

    const contentIds = myContent.map(c => c.id);

    // Aggregate contributors across all content
    const { data, error } = await supabase
      .from('content_contributors')
      .select(`
        user_id,
        total_icoin_contributed,
        total_vicoin_contributed,
        interaction_count,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .in('content_id', contentIds);

    if (error || !data) return [];

    // Aggregate by user
    const aggregated = new Map<string, Contributor>();
    
    data.forEach((item: any) => {
      const existing = aggregated.get(item.user_id);
      if (existing) {
        existing.total_icoin_contributed += item.total_icoin_contributed || 0;
        existing.total_vicoin_contributed += item.total_vicoin_contributed || 0;
        existing.interaction_count += item.interaction_count || 0;
      } else {
        aggregated.set(item.user_id, {
          user_id: item.user_id,
          username: item.profiles?.username || 'Unknown',
          avatar_url: item.profiles?.avatar_url,
          total_icoin_contributed: item.total_icoin_contributed || 0,
          total_vicoin_contributed: item.total_vicoin_contributed || 0,
          interaction_count: item.interaction_count || 0,
        });
      }
    });

    // Sort by total contribution
    return Array.from(aggregated.values()).sort(
      (a, b) => (b.total_icoin_contributed + b.total_vicoin_contributed) - 
                (a.total_icoin_contributed + a.total_vicoin_contributed)
    );
  }, [user]);

  return {
    interactions,
    contributors,
    settings,
    loading,
    addInteraction,
    updateSettings,
    getMyTopContributors,
  };
};

export default useTimedInteractions;
