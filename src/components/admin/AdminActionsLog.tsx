import React, { useState, useEffect, useMemo } from 'react';
import { useAdmin, AdminAction } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Shield, 
  Ban, 
  UserCheck, 
  Flag,
  AlertTriangle,
  Settings,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, format, subDays, startOfDay } from 'date-fns';

interface AdminProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
}

const ACTION_TYPES = ['all', 'ban_user', 'unban_user', 'resolve_flag', 'resolve_report', 'update_role', 'feature_flag_updated', 'content_status_change'];

const AdminActionsLog: React.FC = () => {
  const { adminActions, hasMoreAdminActions, loadMoreAdminActions, refreshAdminActions } = useAdmin();
  const [adminProfiles, setAdminProfiles] = useState<Record<string, AdminProfile>>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');

  const filteredActions = useMemo(() => {
    let list = adminActions;
    if (actionFilter !== 'all') {
      list = list.filter((a) => a.action_type === actionFilter);
    }
    if (dateRange !== 'all') {
      const days = parseInt(dateRange, 10);
      const since =
        days === 1
          ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          : startOfDay(subDays(new Date(), days)).toISOString();
      list = list.filter((a) => a.created_at >= since);
    }
    return list;
  }, [adminActions, actionFilter, dateRange]);

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

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await loadMoreAdminActions();
    setIsLoadingMore(false);
  };

  const handleExportCsv = () => {
    if (filteredActions.length === 0) return;
    setIsExporting(true);
    const header = 'Date,Time,Action Type,Target Type,Target ID,Admin,Details\n';
    const rows = filteredActions.map((action) => {
      const adminProfile = adminProfiles[action.admin_id];
      const adminName = adminProfile?.display_name || adminProfile?.username || action.admin_id;
      const details = formatActionDetails(action).replace(/"/g, '""');
      const d = new Date(action.created_at);
      return [
        format(d, 'yyyy-MM-dd'),
        format(d, 'HH:mm:ss'),
        action.action_type,
        action.target_type,
        action.target_id,
        adminName,
        `"${details}"`,
      ].join(',');
    });
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-audit-log-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Admin Actions Audit Log
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refreshAdminActions?.()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {filteredActions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Export CSV
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_TYPES.filter((t) => t !== 'all').map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredActions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No admin actions in this range</p>
        ) : (
          <>
            <div className="space-y-3">
              {filteredActions.map((action) => {
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
            {hasMoreAdminActions && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminActionsLog;
