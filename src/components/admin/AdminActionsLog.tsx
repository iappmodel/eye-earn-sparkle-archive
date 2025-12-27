import React, { useState, useEffect } from 'react';
import { useAdmin, AdminAction } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Ban, 
  UserCheck, 
  Flag,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AdminProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
}

const AdminActionsLog: React.FC = () => {
  const { adminActions } = useAdmin();
  const [adminProfiles, setAdminProfiles] = useState<Record<string, AdminProfile>>({});

  useEffect(() => {
    fetchAdminProfiles();
  }, [adminActions]);

  const fetchAdminProfiles = async () => {
    const adminIds = [...new Set(adminActions.map(a => a.admin_id))];
    if (adminIds.length === 0) return;

    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, display_name')
      .in('user_id', adminIds);

    if (data) {
      const profileMap: Record<string, AdminProfile> = {};
      data.forEach(p => {
        profileMap[p.user_id] = p;
      });
      setAdminProfiles(profileMap);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'ban_user':
        return <Ban className="w-4 h-4 text-destructive" />;
      case 'unban_user':
        return <UserCheck className="w-4 h-4 text-primary" />;
      case 'resolve_flag':
        return <Flag className="w-4 h-4 text-warning" />;
      case 'resolve_report':
        return <AlertTriangle className="w-4 h-4 text-accent" />;
      case 'update_role':
        return <Shield className="w-4 h-4 text-primary" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'ban_user':
        return <Badge variant="destructive">Ban</Badge>;
      case 'unban_user':
        return <Badge className="bg-primary">Unban</Badge>;
      case 'resolve_flag':
        return <Badge variant="secondary">Flag Resolved</Badge>;
      case 'resolve_report':
        return <Badge variant="secondary">Report Resolved</Badge>;
      case 'update_role':
        return <Badge variant="outline">Role Change</Badge>;
      default:
        return <Badge variant="outline">{actionType}</Badge>;
    }
  };

  const formatActionDetails = (action: AdminAction) => {
    const details = action.details as Record<string, unknown>;
    switch (action.action_type) {
      case 'ban_user':
        return `Reason: ${details.reason || 'Not specified'}`;
      case 'update_role':
        return `New role: ${details.newRole}`;
      case 'resolve_flag':
      case 'resolve_report':
        return `Action: ${details.action || 'Not specified'}`;
      default:
        return JSON.stringify(details);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Admin Actions Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {adminActions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No admin actions recorded</p>
        ) : (
          <div className="space-y-3">
            {adminActions.map((action) => {
              const adminProfile = adminProfiles[action.admin_id];
              return (
                <div 
                  key={action.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div className="mt-1">
                    {getActionIcon(action.action_type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActionBadge(action.action_type)}
                      <span className="text-sm font-medium">
                        {adminProfile?.display_name || adminProfile?.username || action.admin_id.slice(0, 8)}
                      </span>
                      <span className="text-sm text-muted-foreground">→</span>
                      <span className="text-sm">
                        {action.target_type}: {action.target_id.slice(0, 8)}...
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatActionDetails(action)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminActionsLog;
