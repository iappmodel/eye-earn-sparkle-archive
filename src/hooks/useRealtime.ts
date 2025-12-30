// Custom hook for real-time subscriptions
import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { realtimeService } from '@/services/realtime.service';
import { useToast } from '@/hooks/use-toast';

export function useRealtimeRewards(onRewardUpdate?: (reward: any) => void) {
  const { user } = useAuth();
  // Toast notifications temporarily disabled
  // const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeService.subscribeToRewards(user.id, (payload) => {
      // Toast temporarily disabled
      // if (payload.eventType === 'INSERT') {
      //   toast({
      //     title: '🎉 New Reward!',
      //     description: `You earned a new reward!`,
      //   });
      // }
      onRewardUpdate?.(payload);
    });

    return unsubscribe;
  }, [user?.id, onRewardUpdate]);
}

export function useRealtimeNotifications(onNotification?: (notification: any) => void) {
  const { user } = useAuth();
  // Toast notifications temporarily disabled
  // const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeService.subscribeToNotifications(user.id, (payload) => {
      // Toast temporarily disabled
      // const notification = payload.new;
      // toast({
      //   title: notification?.title || 'New Notification',
      //   description: notification?.message || '',
      // });
      onNotification?.(payload);
    });

    return unsubscribe;
  }, [user?.id, onNotification]);
}

export function useRealtimeBalance(onBalanceUpdate?: (balance: any) => void) {
  const { user, refreshProfile } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeService.subscribeToBalance(user.id, (payload) => {
      refreshProfile();
      onBalanceUpdate?.(payload);
    });

    return unsubscribe;
  }, [user?.id, onBalanceUpdate, refreshProfile]);
}

export function useRealtimeFeed(onNewContent?: (content: any) => void) {
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToFeed((payload) => {
      onNewContent?.(payload);
    });

    return unsubscribe;
  }, [onNewContent]);
}

export function usePresence() {
  const { user, profile } = useAuth();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    cleanupRef.current = realtimeService.trackPresence(user.id, {
      username: profile?.username,
      avatar_url: profile?.avatar_url,
    });

    return () => {
      cleanupRef.current?.();
    };
  }, [user?.id, profile?.username, profile?.avatar_url]);
}

// Combined hook for all real-time features
export function useAppRealtime() {
  useRealtimeRewards();
  useRealtimeNotifications();
  useRealtimeBalance();
  usePresence();
}
