import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SessionSecurityState {
  isValid: boolean;
  trustScore: number;
  requireReauth: boolean;
  lockoutMinutes: number | null;
}

export function useSessionSecurity() {
  const { user, signOut } = useAuth();
  const [state, setState] = useState<SessionSecurityState>({
    isValid: true,
    trustScore: 100,
    requireReauth: false,
    lockoutMinutes: null,
  });
  const [isChecking, setIsChecking] = useState(false);

  // Generate a simple device fingerprint
  const getDeviceFingerprint = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 0, 0);
    }
    
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }, []);

  const checkSession = useCallback(async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('session-security', {
        body: {
          action: 'check_session',
          deviceFingerprint: getDeviceFingerprint(),
        },
      });

      if (error) {
        console.error('Session security check failed:', error);
        return;
      }

      setState({
        isValid: data.valid,
        trustScore: data.trustScore || 100,
        requireReauth: data.requireReauth || false,
        lockoutMinutes: data.lockoutMinutes || null,
      });

      if (!data.valid && data.requireReauth) {
        toast({
          title: 'Security Alert',
          description: data.reason || 'Please sign in again for security',
          variant: 'destructive',
        });

        // Auto sign out if session is invalid
        setTimeout(() => {
          signOut();
        }, 3000);
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setIsChecking(false);
    }
  }, [user, getDeviceFingerprint, signOut]);

  const forceLogoutAllDevices = useCallback(async (reason?: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('session-security', {
        body: {
          action: 'force_logout',
          userId: user.id,
          deviceFingerprint: getDeviceFingerprint(),
          details: { reason },
        },
      });

      if (error) throw error;

      toast({
        title: 'Sessions Terminated',
        description: 'All other devices have been logged out',
      });

      return data.success;
    } catch (error) {
      console.error('Force logout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to terminate sessions',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, getDeviceFingerprint]);

  const reportSuspiciousActivity = useCallback(async (details: Record<string, unknown>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('session-security', {
        body: {
          action: 'report_suspicious',
          userId: user.id,
          deviceFingerprint: getDeviceFingerprint(),
          details,
        },
      });

      if (error) throw error;

      if (data.accountLocked) {
        toast({
          title: 'Account Locked',
          description: 'Your account has been temporarily locked for security',
          variant: 'destructive',
        });
        setTimeout(() => signOut(), 2000);
      }

      return data;
    } catch (error) {
      console.error('Report suspicious activity error:', error);
      return null;
    }
  }, [user, getDeviceFingerprint, signOut]);

  const updateDeviceTrust = useCallback(async (event: string) => {
    if (!user) return;

    try {
      await supabase.functions.invoke('update-device-trust', {
        body: {
          deviceFingerprint: getDeviceFingerprint(),
          event,
          deviceInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${screen.width}x${screen.height}`,
          },
        },
      });
    } catch (error) {
      console.error('Update device trust error:', error);
    }
  }, [user, getDeviceFingerprint]);

  // Check session periodically
  useEffect(() => {
    if (!user) return;

    // Initial check
    checkSession();

    // Check every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, checkSession]);

  // Update trust on successful login
  useEffect(() => {
    if (user) {
      updateDeviceTrust('successful_login');
    }
  }, [user, updateDeviceTrust]);

  return {
    ...state,
    isChecking,
    checkSession,
    forceLogoutAllDevices,
    reportSuspiciousActivity,
    updateDeviceTrust,
    getDeviceFingerprint,
  };
}

export default useSessionSecurity;
