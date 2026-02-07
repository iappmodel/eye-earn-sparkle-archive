import React, { useState, useEffect } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { 
  X, Smartphone, Monitor, Tablet, MapPin, 
  Loader2, Trash2, Shield, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ActiveSessionsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Session {
  id: string;
  device_type: 'mobile' | 'desktop' | 'tablet';
  device_name: string;
  browser: string;
  location: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}

const getDeviceIcon = (type: string) => {
  switch (type) {
    case 'mobile':
      return <Smartphone className="w-5 h-5" />;
    case 'tablet':
      return <Tablet className="w-5 h-5" />;
    default:
      return <Monitor className="w-5 h-5" />;
  }
};

export const ActiveSessionsManager: React.FC<ActiveSessionsManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchSessions();
    }
  }, [isOpen, user]);

  const fetchSessions = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // Fetch device fingerprints as sessions
      const { data, error } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', user.id)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      
      // Transform fingerprints to sessions
      const transformedSessions: Session[] = (data || []).map((d, index) => {
        const deviceInfo = d.device_info as Record<string, any> || {};
        
        // Parse device type from user agent or device info
        let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
        const ua = deviceInfo.userAgent || '';
        if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
          deviceType = 'mobile';
        } else if (ua.includes('iPad') || ua.includes('Tablet')) {
          deviceType = 'tablet';
        }

        // Get browser name
        let browser = 'Unknown Browser';
        if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Safari')) browser = 'Safari';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Edge')) browser = 'Edge';

        return {
          id: d.id,
          device_type: deviceType,
          device_name: deviceInfo.platform || 'Unknown Device',
          browser,
          location: deviceInfo.timezone || 'Unknown Location',
          ip_address: 'Hidden',
          last_active: d.last_seen_at,
          is_current: index === 0, // Most recent is current
        };
      });
      
      setSessions(transformedSessions);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session revoked successfully');
    } catch (error: any) {
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const revokeAllSessions = async () => {
    if (!user) return;
    setRevoking('all');
    
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      setSessions([]);
      setShowRevokeAll(false);
      toast.success('All other sessions have been revoked');
    } catch (error: any) {
      toast.error('Failed to revoke sessions');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-display text-lg font-bold">Active Sessions</h1>
          </div>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                <Monitor className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No Active Sessions</h3>
              <p className="text-sm text-muted-foreground">
                Your logged-in devices will appear here
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Revoke All Button */}
              {sessions.filter(s => !s.is_current).length > 0 && (
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setShowRevokeAll(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sign Out All Other Devices
                </Button>
              )}

              {/* Sessions List */}
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      session.is_current
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/50 bg-card/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        session.is_current
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {getDeviceIcon(session.device_type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {session.device_name}
                          </p>
                          {session.is_current && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {session.browser}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>{session.location}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(session.last_active), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {!session.is_current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => revokeSession(session.id)}
                          disabled={revoking === session.id}
                        >
                          {revoking === session.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              If you don't recognize a device, revoke its access and change your password.
            </p>
          </div>
        </div>
      </div>

      {/* Revoke All Confirmation */}
      <AlertDialog open={showRevokeAll} onOpenChange={setShowRevokeAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out All Devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out from all other devices except this one. You'll need to sign in again on those devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeAllSessions}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking === 'all' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Sign Out All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SwipeDismissOverlay>
  );
};
