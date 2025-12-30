import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notificationSoundService } from '@/services/notificationSound.service';

export interface Notification {
  id: string;
  user_id: string;
  type: 'engagement' | 'promotion' | 'system';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  seen: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  categories: string[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    const typedData = (data || []).map(n => ({
      ...n,
      type: n.type as 'engagement' | 'promotion' | 'system',
      data: n.data as Record<string, unknown>
    }));

    setNotifications(typedData);
    setUnreadCount(typedData.filter(n => !n.seen).length);
  }, [user]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching preferences:', error);
      return;
    }

    if (data) {
      setPreferences(data as NotificationPreferences);
    } else {
      // Create default preferences
      const { data: newPrefs, error: insertError } = await supabase
        .from('notification_preferences')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (!insertError && newPrefs) {
        setPreferences(newPrefs as NotificationPreferences);
      }
    }
  }, [user]);

  // Mark notification as seen
  const markAsSeen = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ seen: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, seen: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // Mark all as seen
  const markAllAsSeen = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ seen: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('seen', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
      setUnreadCount(0);
    }
  };

  // Update preferences
  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user || !preferences) return;

    const { error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update preferences');
      return false;
    }

    setPreferences(prev => prev ? { ...prev, ...updates } : null);
    toast.success('Preferences updated');
    return true;
  };

  // Initial fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchNotifications(), fetchPreferences()]);
      setIsLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user, fetchNotifications, fetchPreferences]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = {
            ...payload.new,
            type: payload.new.type as 'engagement' | 'promotion' | 'system',
            data: payload.new.data as Record<string, unknown>
          } as Notification;

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show in-app toast if enabled
          if (preferences?.in_app_enabled) {
            // Play notification sound
            notificationSoundService.playNotification();
            
            toast(newNotification.title, {
              description: newNotification.body || undefined,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, preferences?.in_app_enabled]);

  return {
    notifications,
    preferences,
    unreadCount,
    isLoading,
    markAsSeen,
    markAllAsSeen,
    updatePreferences,
    refetch: fetchNotifications,
  };
};
