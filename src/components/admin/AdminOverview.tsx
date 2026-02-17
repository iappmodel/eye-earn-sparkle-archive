import React from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Flag,
  AlertTriangle,
  Shield,
  Activity,
  TrendingUp,
  FileCheck,
  LayoutDashboard,
  ArrowRight,
  UserPlus,
  FolderOpen,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AdminAction } from '@/hooks/useAdmin';

interface AdminOverviewProps {
  onNavigate: (tab: string) => void;
  recentActions: AdminAction[];
  adminDisplayNames: Record<string, string>;
}

const AdminOverview: React.FC<AdminOverviewProps> = ({
  onNavigate,
  recentActions,
  adminDisplayNames,
}) => {
  const { stats, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const quickActions = [
    {
      label: 'Pending flags',
      count: stats.pendingFlags,
      tab: 'moderation',
      icon: Flag,
      variant: 'warning' as const,
    },
    {
      label: 'Pending reports',
      count: stats.pendingReports,
      tab: 'moderation',
      icon: AlertTriangle,
      variant: 'destructive' as const,
    },
    {
      label: 'User management',
      tab: 'users',
      icon: Users,
      variant: 'default' as const,
    },
    {
      label: 'Analytics',
      tab: 'analytics',
      icon: Activity,
      variant: 'default' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Key metrics and quick actions. Resolve pending items first.
        </p>
      </div>

      {/* Key metrics grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
            <p className="text-xs text-muted-foreground">
              +{stats.newUsersToday} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              Creators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalCreators}</p>
          </CardContent>
        </Card>

        <Card className={stats.pendingFlags > 0 ? 'border-warning/50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flag className="w-4 h-4 text-warning" />
              Pending flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.pendingFlags}</p>
            {stats.pendingFlags > 0 && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-warning"
                onClick={() => onNavigate('moderation')}
              >
                Review →
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className={stats.pendingReports > 0 ? 'border-destructive/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Pending reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.pendingReports}</p>
            {stats.pendingReports > 0 && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-destructive"
                onClick={() => onNavigate('moderation')}
              >
                Review →
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Active bans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.activeBans}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Content items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalContent}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalTransactions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            Quick actions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Jump to a section to moderate or manage.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map(({ label, count, tab, icon: Icon }) => (
              <Button
                key={tab + label}
                variant="outline"
                onClick={() => onNavigate(tab)}
                className="flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                {label}
                {typeof count === 'number' && count > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0 text-xs font-medium">
                    {count}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 opacity-60" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent admin activity */}
      {recentActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent admin activity
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest actions from the audit log.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentActions.slice(0, 5).map((action) => (
                <li
                  key={action.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                >
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">
                      {adminDisplayNames[action.admin_id] || action.admin_id.slice(0, 8)}
                    </strong>{' '}
                    {action.action_type.replace(/_/g, ' ')} · {action.target_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => onNavigate('logs')}
            >
              View full audit log →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOverview;
