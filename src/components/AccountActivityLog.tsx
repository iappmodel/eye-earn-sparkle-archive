import React, { useState, useEffect } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { 
  X, LogIn, LogOut, Key, User, Smartphone, Shield, 
  MapPin, Check, AlertTriangle, Loader2, RefreshCw,
  ChevronRight
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface AccountActivityLogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActivityLog {
  id: string;
  activity_type: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, any>;
  location: string | null;
  status: 'success' | 'failed';
  details: Record<string, any>;
  created_at: string;
}

const activityIcons: Record<string, React.ReactNode> = {
  login: <LogIn className="w-4 h-4" />,
  logout: <LogOut className="w-4 h-4" />,
  password_change: <Key className="w-4 h-4" />,
  profile_update: <User className="w-4 h-4" />,
  device_added: <Smartphone className="w-4 h-4" />,
  security_alert: <Shield className="w-4 h-4" />,
};

const activityLabels: Record<string, string> = {
  login: 'Sign In',
  logout: 'Sign Out',
  password_change: 'Password Changed',
  profile_update: 'Profile Updated',
  device_added: 'New Device',
  security_alert: 'Security Alert',
};

export const AccountActivityLog: React.FC<AccountActivityLogProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchActivities();
    }
  }, [isOpen, user]);

  const fetchActivities = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('account_activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setActivities((data || []).map(d => ({
        ...d,
        status: d.status as 'success' | 'failed',
        device_info: (d.device_info || {}) as Record<string, any>,
        details: (d.details || {}) as Record<string, any>,
      })));
    } catch (error: any) {
      toast.error('Failed to load activity log');
    } finally {
      setIsLoading(false);
    }
  };

  const parseUserAgent = (ua: string | null): string => {
    if (!ua) return 'Unknown device';
    
    // Simple parsing
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Linux')) return 'Linux';
    
    return 'Unknown device';
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = format(new Date(activity.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityLog[]>);

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h1 className="font-display text-lg font-bold">Account Activity</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchActivities}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <NeuButton onClick={onClose} size="sm">
              <X className="w-5 h-5" />
            </NeuButton>
          </div>
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No Activity Yet</h3>
              <p className="text-sm text-muted-foreground">
                Your account activity will appear here for security monitoring
              </p>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-6">
              {Object.entries(groupedActivities).map(([date, dayActivities]) => (
                <div key={date}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                    {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                  </p>
                  
                  <div className="space-y-2">
                    {dayActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className={cn(
                          "neu-card rounded-xl overflow-hidden transition-all",
                          expandedId === activity.id && "ring-2 ring-primary/20"
                        )}
                      >
                        <button
                          onClick={() => setExpandedId(
                            expandedId === activity.id ? null : activity.id
                          )}
                          className="w-full p-4 flex items-center gap-3 text-left"
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            activity.status === 'success'
                              ? "bg-green-500/10 text-green-500"
                              : "bg-destructive/10 text-destructive"
                          )}>
                            {activityIcons[activity.activity_type] || <Shield className="w-4 h-4" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">
                                {activityLabels[activity.activity_type] || activity.activity_type}
                              </p>
                              {activity.status === 'success' ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-destructive" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          
                          <ChevronRight className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform",
                            expandedId === activity.id && "rotate-90"
                          )} />
                        </button>
                        
                        {/* Expanded Details */}
                        {expandedId === activity.id && (
                          <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-2">
                            <div className="space-y-3 pt-4">
                              {activity.ip_address && (
                                <div className="flex items-center gap-3 text-sm">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">IP:</span>
                                  <span className="text-foreground">{activity.ip_address}</span>
                                </div>
                              )}
                              
                              {activity.user_agent && (
                                <div className="flex items-center gap-3 text-sm">
                                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Device:</span>
                                  <span className="text-foreground">{parseUserAgent(activity.user_agent)}</span>
                                </div>
                              )}
                              
                              {activity.location && (
                                <div className="flex items-center gap-3 text-sm">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Location:</span>
                                  <span className="text-foreground">{activity.location}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-3 text-sm">
                                <Shield className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Time:</span>
                                <span className="text-foreground">
                                  {format(new Date(activity.created_at), 'h:mm a')}
                                </span>
                              </div>
                              
                              {activity.status === 'failed' && activity.details?.reason && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                  {activity.details.reason}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              If you notice any suspicious activity, please change your password immediately and contact support.
            </p>
          </div>
        </div>
      </div>
    </SwipeDismissOverlay>
  );
};
