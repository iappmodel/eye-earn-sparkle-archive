import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ReminderSettings {
  enabled: boolean;
  time: string; // HH:MM format
  lastShown: string | null;
}

const REMINDER_KEY = 'daily_reward_reminder';
const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  time: '10:00',
  lastShown: null,
};

export const useDailyReminder = () => {
  const { user } = useAuth();

  const getSettings = useCallback((): ReminderSettings => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    const stored = localStorage.getItem(REMINDER_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  }, []);

  const saveSettings = useCallback((settings: Partial<ReminderSettings>) => {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(REMINDER_KEY, JSON.stringify(updated));
    return updated;
  }, [getSettings]);

  const setEnabled = useCallback((enabled: boolean) => {
    return saveSettings({ enabled });
  }, [saveSettings]);

  const setReminderTime = useCallback((time: string) => {
    return saveSettings({ time });
  }, [saveSettings]);

  const shouldShowReminder = useCallback(() => {
    const settings = getSettings();
    if (!settings.enabled) return false;

    const now = new Date();
    const today = now.toDateString();
    
    // Already shown today
    if (settings.lastShown === today) return false;

    // Check if current time is past reminder time
    const [hours, minutes] = settings.time.split(':').map(Number);
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);

    return now >= reminderTime;
  }, [getSettings]);

  const markReminderShown = useCallback(() => {
    const today = new Date().toDateString();
    saveSettings({ lastShown: today });
  }, [saveSettings]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback(async (title: string, body: string) => {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    try {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'daily-reminder',
        requireInteraction: false,
      });
    } catch (error) {
      console.warn('Could not show notification:', error);
    }
  }, [requestNotificationPermission]);

  // Schedule daily check
  useEffect(() => {
    if (!user) return;

    const checkReminder = () => {
      if (shouldShowReminder()) {
        markReminderShown();
        showBrowserNotification(
          '🎁 Daily Rewards Await!',
          'Complete tasks and watch videos to earn coins. Your rewards are waiting!'
        );
      }
    };

    // Check immediately and then every 5 minutes
    checkReminder();
    const interval = setInterval(checkReminder, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, shouldShowReminder, markReminderShown, showBrowserNotification]);

  return {
    getSettings,
    setEnabled,
    setReminderTime,
    shouldShowReminder,
    markReminderShown,
    requestNotificationPermission,
    showBrowserNotification,
  };
};
