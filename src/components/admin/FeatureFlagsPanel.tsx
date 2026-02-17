import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAllFeatureFlags } from '@/services/featureFlags.service';
import { featureFlagsService } from '@/services/featureFlags.service';
import type { FeatureFlag } from '@/services/featureFlags.service';
import { Flag, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';

const FeatureFlagsPanel: React.FC = () => {
  const { flags, loading, refetch } = useAllFeatureFlags();
  const { logAdminAction } = useAdmin();
  const { toast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (flag: FeatureFlag, enabled: boolean) => {
    setUpdating(flag.name);
    const updated = await featureFlagsService.updateFlag(flag.name, { is_enabled: enabled });
    if (updated) {
      featureFlagsService.clearCache();
      await refetch();
      logAdminAction('feature_flag_updated', 'feature_flag', flag.id, {
        name: flag.name,
        is_enabled: enabled,
      });
      toast({
        title: 'Updated',
        description: `"${flag.name}" is now ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to update feature flag. Check permissions.',
        variant: 'destructive',
      });
    }
    setUpdating(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5" />
            Feature flags
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enable or disable features. Changes apply after cache refresh.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && flags.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : flags.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No feature flags defined.</p>
        ) : (
          <div className="space-y-4">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{flag.name}</p>
                  {flag.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant={flag.is_enabled ? 'default' : 'secondary'}>
                      {flag.is_enabled ? 'On' : 'Off'}
                    </Badge>
                    {(flag.rollout_percentage ?? 0) < 100 && (
                      <span className="text-xs text-muted-foreground">
                        Rollout: {flag.rollout_percentage}%
                      </span>
                    )}
                    {flag.target_roles?.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Roles: {flag.target_roles.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {updating === flag.name ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={flag.is_enabled}
                      onCheckedChange={(checked) => handleToggle(flag, checked)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeatureFlagsPanel;
