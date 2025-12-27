import React from 'react';
import { X, Bell, BellOff, Check, CheckCheck, Gift, MessageCircle, Settings, Trash2 } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreferences?: () => void;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'engagement':
      return <MessageCircle className="w-4 h-4 text-primary" />;
    case 'promotion':
      return <Gift className="w-4 h-4 text-icoin" />;
    case 'system':
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
};

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkAsSeen: (id: string) => void;
}> = ({ notification, onMarkAsSeen }) => {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  return (
    <div
      className={cn(
        'p-4 border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/50',
        !notification.seen && 'bg-primary/5'
      )}
      onClick={() => !notification.seen && onMarkAsSeen(notification.id)}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          notification.type === 'engagement' && 'bg-primary/10',
          notification.type === 'promotion' && 'bg-icoin/10',
          notification.type === 'system' && 'bg-muted'
        )}>
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm font-medium truncate',
              !notification.seen && 'text-foreground',
              notification.seen && 'text-muted-foreground'
            )}>
              {notification.title}
            </p>
            {!notification.seen && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
            )}
          </div>
          {notification.body && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onOpenPreferences,
}) => {
  const { notifications, unreadCount, isLoading, markAsSeen, markAllAsSeen } = useNotifications();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsSeen}
                className="text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
            <NeuButton onClick={onClose} size="sm">
              <X className="w-5 h-5" />
            </NeuButton>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BellOff className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg mb-1">No notifications yet</h3>
              <p className="text-sm text-muted-foreground">
                You'll see new followers, earnings, and updates here
              </p>
            </div>
          ) : (
            <div>
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsSeen={markAsSeen}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onOpenPreferences}
          >
            <Settings className="w-4 h-4" />
            Notification Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
