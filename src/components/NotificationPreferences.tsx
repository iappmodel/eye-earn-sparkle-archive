import React, { useState, useEffect } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { X, Bell, Mail, Smartphone, DollarSign, Shield, Heart, Gift, Moon } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface NotificationPreferencesProps {
  isOpen: boolean;
  onClose: () => void;
}

const categoryConfig = [
  { 
    id: 'earnings', 
    label: 'Earnings', 
    description: 'Rewards, payouts, and coin updates',
    icon: DollarSign,
    color: 'text-primary'
  },
  { 
    id: 'engagement', 
    label: 'Engagement', 
    description: 'New followers, likes, and messages',
    icon: Heart,
    color: 'text-red-500'
  },
  { 
    id: 'promotions', 
    label: 'Promotions', 
    description: 'New campaigns and reward opportunities',
    icon: Gift,
    color: 'text-icoin'
  },
  { 
    id: 'system', 
    label: 'System', 
    description: 'KYC status, security, and policy updates',
    icon: Shield,
    color: 'text-amber-500'
  },
];

/** Time from DB may be "HH:mm:ss" or "HH:mm"; normalize to "HH:mm" for input. */
function toInputTime(t: string | null): string {
  if (!t) return '';
  const parts = t.split(':');
  return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLocalization();
  const { preferences, updatePreferences, isLoading } = useNotifications();
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');

  useEffect(() => {
    if (preferences) {
      setQuietStart(toInputTime(preferences.quiet_hours_start));
      setQuietEnd(toInputTime(preferences.quiet_hours_end));
    }
  }, [preferences?.quiet_hours_start, preferences?.quiet_hours_end]);

  const toggleChannel = (channel: 'push_enabled' | 'email_enabled' | 'in_app_enabled') => {
    if (!preferences) return;
    updatePreferences({ [channel]: !preferences[channel] });
  };

  const toggleCategory = (categoryId: string) => {
    if (!preferences) return;
    const currentCategories = preferences.categories || [];
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter(c => c !== categoryId)
      : [...currentCategories, categoryId];
    updatePreferences({ categories: newCategories });
  };

  const quietHoursEnabled = !!(preferences?.quiet_hours_start && preferences?.quiet_hours_end);

  const toggleQuietHours = (enabled: boolean) => {
    if (!preferences) return;
    if (enabled) {
      updatePreferences({
        quiet_hours_start: quietStart || '22:00',
        quiet_hours_end: quietEnd || '08:00',
      });
      if (!quietStart) setQuietStart('22:00');
      if (!quietEnd) setQuietEnd('08:00');
    } else {
      updatePreferences({ quiet_hours_start: null, quiet_hours_end: null });
      setQuietStart('');
      setQuietEnd('');
    }
  };

  const saveQuietHours = () => {
    if (!preferences || !quietStart || !quietEnd) return;
    updatePreferences({
      quiet_hours_start: quietStart,
      quiet_hours_end: quietEnd,
    });
  };

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col p-6 overflow-y-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold">{t('notifications.settingsTitle')}</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {isLoading || !preferences ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Channels Section */}
            <div className="mb-8">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Notification Channels
              </h2>
              <div className="space-y-4">
                {/* In-App */}
                <div className="neu-card rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                        <Bell className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <Label className="font-medium">In-App Notifications</Label>
                        <p className="text-xs text-muted-foreground">
                          Banners and alerts while using the app
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferences.in_app_enabled}
                      onCheckedChange={() => toggleChannel('in_app_enabled')}
                    />
                  </div>
                </div>

                {/* Push */}
                <div className="neu-card rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-icoin" />
                      </div>
                      <div>
                        <Label className="font-medium">Push Notifications</Label>
                        <p className="text-xs text-muted-foreground">
                          Alerts even when app is closed
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferences.push_enabled}
                      onCheckedChange={() => toggleChannel('push_enabled')}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="neu-card rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                        <Mail className="w-5 h-5 text-foreground" />
                      </div>
                      <div>
                        <Label className="font-medium">Email Notifications</Label>
                        <p className="text-xs text-muted-foreground">
                          Important updates to your inbox
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preferences.email_enabled}
                      onCheckedChange={() => toggleChannel('email_enabled')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="mb-8">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                {t('notifications.quietHours')}
              </h2>
              <div className="neu-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                      <Moon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <Label className="font-medium">{t('notifications.quietHoursLabel')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('notifications.quietHoursDescription')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={quietHoursEnabled}
                    onCheckedChange={toggleQuietHours}
                  />
                </div>
                {quietHoursEnabled && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">{t('notifications.quietHoursStart')}</Label>
                      <Input
                        type="time"
                        value={quietStart}
                        onChange={(e) => setQuietStart(e.target.value)}
                        onBlur={saveQuietHours}
                        className="mt-1"
                      />
                    </div>
                    <span className="text-muted-foreground pt-5">–</span>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">{t('notifications.quietHoursEnd')}</Label>
                      <Input
                        type="time"
                        value={quietEnd}
                        onChange={(e) => setQuietEnd(e.target.value)}
                        onBlur={saveQuietHours}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Categories Section */}
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                {t('notifications.categoriesTitle')}
              </h2>
              <div className="space-y-3">
                {categoryConfig.map(category => {
                  const Icon = category.icon;
                  const isEnabled = preferences.categories?.includes(category.id) ?? true;

                  return (
                    <div
                      key={category.id}
                      className={cn(
                        'neu-card rounded-2xl p-4 transition-opacity',
                        !isEnabled && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center">
                            <Icon className={cn('w-5 h-5', category.color)} />
                          </div>
                          <div>
                            <Label className="font-medium">{category.label}</Label>
                            <p className="text-xs text-muted-foreground">
                              {category.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleCategory(category.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center mt-8">
              {t('notifications.settingsFooter')}
            </p>
          </>
        )}
      </div>
    </SwipeDismissOverlay>
  );
};
