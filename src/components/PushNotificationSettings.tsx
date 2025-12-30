import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export const PushNotificationSettings: React.FC = () => {
  const { 
    isSupported, 
    isRegistered, 
    permissionStatus,
    isLoading,
    error,
    register,
    unregister,
  } = usePushNotifications();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setIsToggling(true);
    try {
      if (enabled) {
        await register();
      } else {
        await unregister();
      }
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-3 w-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            Push Notifications Unavailable
          </p>
          <p className="text-xs text-muted-foreground/70">
            Push notifications require the native mobile app. Install the app to enable.
          </p>
        </div>
      </div>
    );
  }

  if (permissionStatus === 'denied') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10">
        <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
          <BellOff className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">
            Permission Denied
          </p>
          <p className="text-xs text-muted-foreground">
            Open your device settings to enable push notifications for this app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-secondary/50">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isRegistered ? 'bg-primary/10' : 'bg-muted/50'
          }`}>
            {isRegistered ? (
              <Bell className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <Label htmlFor="push-toggle" className="text-sm font-medium cursor-pointer">
              Push Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              {isRegistered 
                ? 'You will receive notifications on this device' 
                : 'Enable to receive real-time updates'}
            </p>
          </div>
        </div>
        <Switch
          id="push-toggle"
          checked={isRegistered}
          onCheckedChange={handleToggle}
          disabled={isToggling}
        />
      </div>

      {isRegistered && (
        <div className="flex items-center gap-2 px-4 text-xs text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          Push notifications are active
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 text-xs text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
};
