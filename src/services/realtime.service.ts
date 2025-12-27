// Real-time Service for Supabase Subscriptions
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type SubscriptionCallback<T> = (payload: T) => void;

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  // Subscribe to user's rewards updates
  subscribeToRewards(userId: string, onUpdate: SubscriptionCallback<any>) {
    const channelName = `rewards:${userId}`;
    
    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewards',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Realtime] Reward update:', payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to user's notifications
  subscribeToNotifications(userId: string, onUpdate: SubscriptionCallback<any>) {
    const channelName = `notifications:${userId}`;
    
    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Realtime] New notification:', payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to user's balance changes
  subscribeToBalance(userId: string, onUpdate: SubscriptionCallback<any>) {
    const channelName = `balance:${userId}`;
    
    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[Realtime] Balance update:', payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to content feed updates
  subscribeToFeed(onUpdate: SubscriptionCallback<any>) {
    const channelName = 'feed:global';
    
    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content',
        },
        (payload) => {
          console.log('[Realtime] New content:', payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // User presence tracking
  trackPresence(userId: string, userData: Record<string, unknown>) {
    const channelName = 'presence:global';
    
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('[Realtime] Presence sync:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Realtime] User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Realtime] User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            ...userData,
          });
        }
      });

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  private unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  // Cleanup all subscriptions
  cleanup() {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

export const realtimeService = new RealtimeService();
