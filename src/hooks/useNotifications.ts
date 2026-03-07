import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoMode } from '@/lib/appMode';
import { toast } from 'sonner';
import { notificationSoundService } from '@/services/notificationSound.service';

export type NotificationType = 'engagement' | 'promotion' | 'system' | 'earnings';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
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

const PAGE_SIZE = 30;
const DEFAULT_TYPE = undefined as NotificationType | undefined;

function getDemoNotifications(userId: string): Notification[] {
  const now = Date.now();
  return [
    {
      id: 'demo-notification-1',
      user_id: userId,
      type: 'earnings',
      title: 'Promo reward received',
      body: 'You earned +50 Vicoins from Coffee Spot.',
      data: {},
      seen: false,
      read_at: null,
      created_at: new Date(now - 1000 * 60 * 8).toISOString(),
    },
    {
      id: 'demo-notification-2',
      user_id: userId,
      type: 'promotion',
      title: 'Nearby offer unlocked',
      body: '3 promotions are available within 0.5 miles.',
      data: {},
      seen: false,
      read_at: null,
      created_at: new Date(now - 1000 * 60 * 25).toISOString(),
    },
    {
      id: 'demo-notification-3',
      user_id: userId,
      type: 'system',
      title: 'Investor demo mode active',
      body: 'All external services are running in local simulation.',
      data: {},
      seen: true,
      read_at: new Date(now - 1000 * 60 * 40).toISOString(),
      created_at: new Date(now - 1000 * 60 * 45).toISOString(),
    },
  ];
}

/** Check if current time is within quiet hours (times in HH:mm or HH:mm:ss). */
function isWithinQuietHours(
  quietStart: string | null,
  quietEnd: string | null
): boolean {
  if (!quietStart || !quietEnd) return false;
  const now = new Date();
  const [sh, sm] = quietStart.split(':').map(Number);
  const [eh, em] = quietEnd.split(':').map(Number);
  const startMins = sh * 60 + (sm || 0);
  const endMins = eh * 60 + (em || 0);
  const currentMins = now.getHours() * 60 + now.getMinutes();
  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  return currentMins >= startMins || currentMins < endMins;
}

export interface UseNotificationsConfig {
  /** Max notifications to fetch per page. Default 30. */
  pageSize?: number;
  /** If true, in-app toasts for new notifications are disabled. */
  disableToasts?: boolean;
  /** If true, notification sound is not played on new notification. */
  disableSound?: boolean;
  /** Respect quiet hours from preferences for toasts/sound. Default true. */
  respectQuietHours?: boolean;
}

export const useNotifications = (config: UseNotificationsConfig = {}) => {
  const { user } = useAuth();
  const {
    pageSize = PAGE_SIZE,
    disableToasts = false,
    disableSound = false,
    respectQuietHours = true,
  } = config;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilterState] = useState<NotificationType | undefined>(DEFAULT_TYPE);

  const mapRow = (n: Record<string, unknown>): Notification => ({
    ...n,
    type: n.type as NotificationType,
    data: (n.data as Record<string, unknown>) || {},
  } as Notification);

  // Fetch notifications (optionally filtered by type)
  const fetchNotifications = useCallback(
    async (typeFilter?: NotificationType | null, append = false) => {
      if (!user) return;

      if (isDemoMode) {
        const all = getDemoNotifications(user.id);
        const filtered = typeFilter ? all.filter((n) => n.type === typeFilter) : all;
        const from = append ? notifications.length : 0;
        const page = filtered.slice(from, from + pageSize);
        setHasMore(from + page.length < filtered.length);
        if (append) setNotifications((prev) => [...prev, ...page]);
        else setNotifications(page);
        setUnreadCount((append ? [...notifications, ...page] : page).filter((n) => !n.seen).length);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      const from = append ? notifications.length : 0;
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (typeFilter) {
        query = query.eq('type', typeFilter);
      }

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        if (append) setIsLoadingMore(false);
        else setIsLoading(false);
        return;
      }

      const typedData = (data || []).map(mapRow);
      setHasMore((data?.length ?? 0) >= pageSize);
      if (append) {
        setNotifications(prev => (from === 0 ? typedData : [...prev, ...typedData]));
      } else {
        setNotifications(typedData);
      }
      if (!append) {
        setUnreadCount(typedData.filter(n => !n.seen).length);
      } else {
        setUnreadCount(prevCount => {
          const existingIds = new Set(notifications.map(n => n.id));
          const newUnread = typedData.filter(n => !n.seen && !existingIds.has(n.id)).length;
          return prevCount + newUnread;
        });
      }
      if (append) setIsLoadingMore(false);
      else setIsLoading(false);
    },
    [user, pageSize, notifications.length]
  );

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    if (isDemoMode) {
      setPreferences({
        id: 'demo-notification-prefs',
        user_id: user.id,
        push_enabled: true,
        email_enabled: false,
        in_app_enabled: true,
        categories: ['engagement', 'promotion', 'system', 'earnings'],
        quiet_hours_start: null,
        quiet_hours_end: null,
      });
      return;
    }

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
  const markAsSeen = useCallback(async (notificationId: string) => {
    if (isDemoMode) {
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, seen: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ seen: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, seen: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  // Mark all as seen
  const markAllAsSeen = useCallback(async () => {
    if (!user) return;

    if (isDemoMode) {
      setNotifications(prev => prev.map(n => ({ ...n, seen: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ seen: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('seen', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, seen: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    }
  }, [user]);

  // Delete single notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (isDemoMode) {
      setNotifications(prev => {
        const n = prev.find(x => x.id === notificationId);
        const wasUnread = n && !n.seen;
        if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(x => x.id !== notificationId);
      });
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev => {
        const n = prev.find(x => x.id === notificationId);
        const wasUnread = n && !n.seen;
        if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(x => x.id !== notificationId);
      });
    } else {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Delete all notifications for current user
  const deleteAllNotifications = useCallback(async () => {
    if (!user) return;

    if (isDemoMode) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
    } else {
      console.error('Error deleting all notifications:', error);
    }
  }, [user]);

  // Update preferences
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!user || !preferences) return false;

      if (isDemoMode) {
        setPreferences(prev => (prev ? { ...prev, ...updates } : null));
        return true;
      }

      const { error } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        toast.error('Failed to update preferences');
        return false;
      }

      setPreferences(prev => (prev ? { ...prev, ...updates } : null));
      toast.success('Preferences updated');
      return true;
    },
    [user, preferences]
  );

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading) return;
    fetchNotifications(typeFilter ?? undefined, true);
  }, [hasMore, isLoadingMore, isLoading, fetchNotifications, typeFilter]);

  // Set filter and refetch
  const setTypeFilter = useCallback(
    (type: NotificationType | undefined) => {
      setTypeFilterState(type);
      fetchNotifications(type ?? undefined, false);
    },
    [fetchNotifications]
  );

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchNotifications(undefined, false),
        fetchPreferences(),
      ]);
      setIsLoading(false);
    };
    load();
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user || isDemoMode) return;

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
          const newNotification = mapRow(payload.new as Record<string, unknown>);

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          const prefs = preferences;
          const quiet = respectQuietHours && prefs && isWithinQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end);
          const showToast = !disableToasts && prefs?.in_app_enabled && !quiet;
          if (showToast) {
            if (!disableSound) notificationSoundService.playNotification();
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
  }, [user, preferences?.in_app_enabled, preferences?.quiet_hours_start, preferences?.quiet_hours_end, disableToasts, disableSound, respectQuietHours]);

  return {
    notifications,
    preferences,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    markAsSeen,
    markAllAsSeen,
    deleteNotification,
    deleteAllNotifications,
    updatePreferences,
    refetch: (typeFilter?: NotificationType | null) => fetchNotifications(typeFilter ?? undefined, false),
    loadMore,
    setTypeFilter,
    typeFilter,
  };
};
