import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  Flag,
  AlertTriangle,
  Shield,
  Activity,
  TrendingUp,
  RefreshCw,
  ArrowLeft,
  FileCheck,
  UserPlus,
  Crown,
  FileText,
  Coins,
  LayoutDashboard,
  FolderOpen,
  Settings,
} from 'lucide-react';
import ContentModeration from './ContentModeration';
import UserManagement from './UserManagement';
import AnalyticsPanel from './AnalyticsPanel';
import AdminActionsLog from './AdminActionsLog';
import KYCReviewPanel from './KYCReviewPanel';
import AdminOverview from './AdminOverview';
import ContentOverview from './ContentOverview';
import FeatureFlagsPanel from './FeatureFlagsPanel';

const ADMIN_TAB_STORAGE_KEY = 'admin_dashboard_tab';

interface AdminDashboardProps {
  onBack: () => void;
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const { stats, statsError, isLoading, refresh, refreshStats, adminActions } = useAdmin();
  const { isAdmin, isModerator, role } = useUserRole();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY) || 'overview';
    } catch {
      return 'overview';
    }
  });
  const [adminDisplayNames, setAdminDisplayNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [...new Set(adminActions.slice(0, 20).map((a) => a.admin_id))];
    if (ids.length === 0) {
      setAdminDisplayNames({});
      return;
    }
    supabase
      .from('profiles')
      .select('user_id, username, display_name')
      .in('user_id', ids)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((p) => {
          map[p.user_id] = p.display_name || p.username || p.user_id.slice(0, 8);
        });
        setAdminDisplayNames(map);
      });
  }, [adminActions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    try {
      sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  };

  if (!isAdmin && !isModerator) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access the admin dashboard.
            </p>
            <Button onClick={onBack}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground capitalize">
                  Role: {role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshStats()}
                disabled={isRefreshing}
                title="Refresh stats only"
              >
                Stats
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh all
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {statsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Stats error</AlertTitle>
            <AlertDescription>{statsError}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Community & growth</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-2xl font-bold">{stats.totalUsers}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">New today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-green-500" />
                    <span className="text-2xl font-bold">{stats.newUsersToday}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">New (7d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{stats.newUsers7d}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">New (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{stats.newUsers30d}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Creators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    <span className="text-2xl font-bold">{stats.totalCreators}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Moderators</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{stats.totalModerators}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="text-2xl font-bold">{stats.totalAdmins}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Content & moderation</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-2xl font-bold">{stats.totalContent}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{stats.publishedContent}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{stats.draftContent}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-warning" />
                    <span className="text-2xl font-bold">{stats.pendingFlags}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-2xl font-bold">{stats.pendingReports}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Bans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.activeBans}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Activity & rewards</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-2xl font-bold">{stats.totalTransactions}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Rewards (count)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span className="text-2xl font-bold">{stats.totalRewardsCount.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Rewards (amount)</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{stats.totalRewardsAmount.toLocaleString()}</span>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-background">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="moderation" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Flag className="w-4 h-4" />
              <span className="hidden sm:inline">Moderation</span>
              {stats.pendingFlags > 0 && (
                <span className="rounded-full bg-warning/20 px-1.5 py-0 text-xs font-medium">
                  {stats.pendingFlags}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="kyc" className="flex items-center gap-2 data-[state=active]:bg-background">
                <FileCheck className="w-4 h-4" />
                <span className="hidden sm:inline">KYC</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="content" className="flex items-center gap-2 data-[state=active]:bg-background">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Content</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="flags" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Flags</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Audit</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <AdminOverview
              onNavigate={handleTabChange}
              recentActions={adminActions}
              adminDisplayNames={adminDisplayNames}
            />
          </TabsContent>

          <TabsContent value="moderation" className="mt-4">
            <ContentModeration />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UserManagement />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="kyc" className="mt-4">
              <KYCReviewPanel />
            </TabsContent>
          )}

          <TabsContent value="content" className="mt-4">
            <ContentOverview />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <AnalyticsPanel />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="flags" className="mt-4">
              <FeatureFlagsPanel />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="logs" className="mt-4">
              <AdminActionsLog />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
