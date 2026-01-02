import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PushNotificationState {
  isSupported: boolean;
  isRegistered: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isRegistered: false,
    permissionStatus: null,
    token: null,
    isLoading: true,
    error: null,
  });
  const [PushNotifications, setPushNotifications] = useState<any>(null);

  // Dynamically import the Capacitor plugin
  useEffect(() => {
    const loadPlugin = async () => {
      try {
        const { PushNotifications: PushPlugin } = await import('@capacitor/push-notifications');
        const { Capacitor } = await import('@capacitor/core');
        
        const isNative = Capacitor.isNativePlatform();
        
        if (isNative) {
          setPushNotifications(PushPlugin);
          setState(prev => ({ ...prev, isSupported: true, isLoading: false }));
        } else {
          setState(prev => ({ ...prev, isSupported: false, isLoading: false }));
        }
      } catch (err) {
        console.log('Push notifications not available (running in browser)');
        setState(prev => ({ ...prev, isSupported: false, isLoading: false }));
      }
    };
    loadPlugin();
  }, []);

  // Check permission status
  const checkPermissions = useCallback(async () => {
    if (!PushNotifications) return null;

    try {
      const result = await PushNotifications.checkPermissions();
      setState(prev => ({ ...prev, permissionStatus: result.receive }));
      return result.receive;
    } catch (err: any) {
      console.error('Failed to check push permissions:', err);
      setState(prev => ({ ...prev, error: err.message }));
      return null;
    }
  }, [PushNotifications]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!PushNotifications) {
      toast.error('Push notifications not available on this device');
      return false;
    }

    try {
      const result = await PushNotifications.requestPermissions();
      setState(prev => ({ ...prev, permissionStatus: result.receive }));
      
      if (result.receive === 'granted') {
        return true;
      } else {
        toast.error('Push notification permission denied');
        return false;
      }
    } catch (err: any) {
      console.error('Failed to request push permissions:', err);
      setState(prev => ({ ...prev, error: err.message }));
      toast.error('Failed to request notification permissions');
      return false;
    }
  }, [PushNotifications]);

  // Register for push notifications
  const register = useCallback(async (): Promise<boolean> => {
    if (!PushNotifications) return false;

    try {
      // First check/request permission
      let permission = await checkPermissions();
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Register with the native platform
      await PushNotifications.register();
      setState(prev => ({ ...prev, isRegistered: true }));
      return true;
    } catch (err: any) {
      console.error('Failed to register for push notifications:', err);
      setState(prev => ({ ...prev, error: err.message }));
      toast.error('Failed to register for push notifications');
      return false;
    }
  }, [PushNotifications, checkPermissions, requestPermission]);

  // Unregister from push notifications
  const unregister = useCallback(async (): Promise<boolean> => {
    if (!PushNotifications) return false;

    try {
      // Remove token from database
      if (user && state.token) {
        await supabase
          .from('notification_preferences')
          .update({ push_enabled: false })
          .eq('user_id', user.id);
      }

      setState(prev => ({ 
        ...prev, 
        isRegistered: false, 
        token: null 
      }));
      
      toast.success('Push notifications disabled');
      return true;
    } catch (err: any) {
      console.error('Failed to unregister from push notifications:', err);
      setState(prev => ({ ...prev, error: err.message }));
      return false;
    }
  }, [PushNotifications, user, state.token]);

  // Set up push notification listeners
  useEffect(() => {
    if (!PushNotifications || !state.isSupported) return;

    // Registration success - save token
    const registrationListener = PushNotifications.addListener(
      'registration',
      async (token: { value: string }) => {
        console.log('Push registration success, token:', token.value);
        setState(prev => ({ ...prev, token: token.value, isRegistered: true }));

        // Save token to database if user is logged in
        if (user) {
          try {
            await supabase
              .from('notification_preferences')
              .update({ push_enabled: true })
              .eq('user_id', user.id);
          } catch (err) {
            console.error('Failed to save push token:', err);
          }
        }
      }
    );

    // Registration error
    const registrationErrorListener = PushNotifications.addListener(
      'registrationError',
      (err: any) => {
        console.error('Push registration error:', err);
        setState(prev => ({ 
          ...prev, 
          error: err.error || 'Registration failed',
          isRegistered: false 
        }));
      }
    );

    // Received push notification while app is in foreground
    const pushReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: any) => {
        console.log('Push received:', notification);
        
        // Show in-app toast for foreground notifications
        toast(notification.title || 'New Notification', {
          description: notification.body,
        });
      }
    );

    // User tapped on push notification
    const pushActionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: any) => {
        console.log('Push action performed:', action);
        
        // Handle notification tap - navigate to relevant screen
        const data = action.notification?.data;
        const route = typeof data?.route === 'string' ? data.route : null;

        if (route) {
          try {
            const url = new URL(route, window.location.origin);
            if (url.origin === window.location.origin) {
              window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            } else {
              window.location.href = route;
            }
          } catch {
            window.location.href = route;
          }
        }
      }
    );

    // Check initial permission status
    checkPermissions();

    // Cleanup listeners
    return () => {
      registrationListener.then((l: any) => l.remove());
      registrationErrorListener.then((l: any) => l.remove());
      pushReceivedListener.then((l: any) => l.remove());
      pushActionListener.then((l: any) => l.remove());
    };
  }, [PushNotifications, state.isSupported, user, checkPermissions]);

  return {
    ...state,
    checkPermissions,
    requestPermission,
    register,
    unregister,
  };
};
