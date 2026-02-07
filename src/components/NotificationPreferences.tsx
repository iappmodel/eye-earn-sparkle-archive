import React from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { X, Bell, Mail, Smartphone, DollarSign, Shield, Heart, Gift } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  isOpen,
  onClose,
}) => {
  const { preferences, updatePreferences, isLoading } = useNotifications();

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

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col p-6 overflow-y-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold">Notification Settings</h1>
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

            {/* Categories Section */}
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Notification Categories
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
              You can update these settings at any time. We'll never send spam.
            </p>
          </>
        )}
      </div>
    </SwipeDismissOverlay>
  );
};
