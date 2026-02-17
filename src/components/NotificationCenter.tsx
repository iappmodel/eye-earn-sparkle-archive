import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import {
  X,
  Bell,
  BellOff,
  CheckCheck,
  Gift,
  MessageCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Trash2,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import {
  useNotifications,
  Notification,
  NotificationType,
} from '@/hooks/useNotifications';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { groupNotificationsByTime, NotificationGroup } from '@/utils/notificationGrouping';

const FILTER_TABS: { id: NotificationType | 'all'; labelKey: string }[] = [
  { id: 'all', labelKey: 'notifications.filterAll' },
  { id: 'engagement', labelKey: 'notifications.filterEngagement' },
  { id: 'earnings', labelKey: 'notifications.filterEarnings' },
  { id: 'promotion', labelKey: 'notifications.filterPromotions' },
  { id: 'system', labelKey: 'notifications.filterSystem' },
];

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreferences?: () => void;
  /** When provided, called when user taps a notification that has a route/action (so caller can close overlay before nav). */
  onNavigate?: () => void;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'engagement':
      return <MessageCircle className="w-4 h-4 text-primary" />;
    case 'promotion':
      return <Gift className="w-4 h-4 text-icoin" />;
    case 'earnings':
      return <DollarSign className="w-4 h-4 text-icoin" />;
    case 'system':
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
};

const getNotificationIconBg = (type: Notification['type']) => {
  switch (type) {
    case 'engagement':
      return 'bg-primary/10';
    case 'promotion':
    case 'earnings':
      return 'bg-icoin/10';
    case 'system':
    default:
      return 'bg-muted';
  }
};

/** Resolve deep link from notification data: route (path) or action_url (full URL). */
function getNotificationLink(data: Record<string, unknown>): string | null {
  const route = data?.route as string | undefined;
  const actionUrl = data?.action_url as string | undefined;
  if (route && typeof route === 'string') return route.startsWith('/') ? route : `/${route}`;
  if (actionUrl && typeof actionUrl === 'string') return actionUrl;
  return null;
}

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkAsSeen: (id: string) => void;
  onDelete: (id: string) => void;
  onItemTap: (notification: Notification) => void;
}> = ({ notification, onMarkAsSeen, onDelete, onItemTap }) => {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });
  const link = getNotificationLink(notification.data || {});

  const handleClick = useCallback(() => {
    if (!notification.seen) onMarkAsSeen(notification.id);
    onItemTap(notification);
  }, [notification, onMarkAsSeen, onItemTap]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(notification.id);
    },
    [notification.id, onDelete]
  );

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-4 border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/50',
        !notification.seen && 'bg-primary/5'
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          getNotificationIconBg(notification.type)
        )}
      >
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm font-medium truncate',
              !notification.seen && 'text-foreground',
              notification.seen && 'text-muted-foreground'
            )}
          >
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
      <button
        onClick={handleDelete}
        className="p-2 rounded-lg shrink-0 opacity-60 hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
        aria-label="Delete notification"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

const NotificationGroupSection: React.FC<{
  group: NotificationGroup;
  onMarkAsSeen: (id: string) => void;
  onDelete: (id: string) => void;
  onItemTap: (n: Notification) => void;
}> = ({ group, onMarkAsSeen, onDelete, onItemTap }) => {
  const [isCollapsed, setIsCollapsed] = useState(group.isCollapsible);

  return (
    <div className="mb-4">
      <button
        onClick={() => group.isCollapsible && setIsCollapsed(!isCollapsed)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider',
          group.isCollapsible && 'cursor-pointer hover:text-foreground'
        )}
      >
        <span>
          {group.label} ({group.notifications.length})
        </span>
        {group.isCollapsible &&
          (isCollapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          ))}
      </button>
      {!isCollapsed && (
        <div className="space-y-1">
          {group.notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsSeen={onMarkAsSeen}
              onDelete={onDelete}
              onItemTap={onItemTap}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onOpenPreferences,
  onNavigate,
}) => {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    markAsSeen,
    markAllAsSeen,
    deleteNotification,
    deleteAllNotifications,
    refetch,
    loadMore,
    setTypeFilter,
    typeFilter,
  } = useNotifications();

  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const groupedNotifications = useMemo(
    () => groupNotificationsByTime(notifications),
    [notifications]
  );

  const handleRefresh = useCallback(async () => {
    await refetch(typeFilter ?? null);
  }, [refetch, typeFilter]);

  const handleItemTap = useCallback(
    (notification: Notification) => {
      const link = getNotificationLink(notification.data || {});
      if (link) {
        onNavigate?.();
        onClose();
        if (link.startsWith('http')) {
          window.open(link, '_blank');
        } else {
          navigate(link);
        }
      }
    },
    [onClose, onNavigate, navigate]
  );

  const handleClearAll = useCallback(async () => {
    await deleteAllNotifications();
    setShowClearAllConfirm(false);
  }, [deleteAllNotifications]);

  const emptyMessage =
    typeFilter === undefined
      ? t('notifications.noNotifications')
      : t('notifications.noNotificationsInFilter');

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold">
              {t('notifications.title')}
            </h1>
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
                {t('notifications.markAllRead')}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearAllConfirm(true)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('notifications.clearAll')}
              </Button>
            )}
            <NeuButton onClick={onClose} size="sm">
              <X className="w-5 h-5" />
            </NeuButton>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-2 py-2 border-b border-border overflow-x-auto shrink-0">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setTypeFilter(tab.id === 'all' ? undefined : (tab.id as NotificationType))
              }
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                (tab.id === 'all' && typeFilter === undefined) ||
                  (tab.id !== 'all' && typeFilter === tab.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BellOff className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-lg mb-1">
                  {t('notifications.noNotificationsTitle')}
                </h3>
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              </div>
            ) : (
              <div className="py-2">
                {groupedNotifications.map((group) => (
                  <NotificationGroupSection
                    key={group.id}
                    group={group}
                    onMarkAsSeen={markAsSeen}
                    onDelete={deleteNotification}
                    onItemTap={handleItemTap}
                  />
                ))}
                {hasMore && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t('notifications.loadMore')
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </PullToRefresh>

        {/* Footer */}
        <div className="p-4 border-t border-border shrink-0">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onOpenPreferences}
          >
            <Settings className="w-4 h-4" />
            {t('notifications.preferences')}
          </Button>
        </div>
      </div>

      <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('notifications.clearAllConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('notifications.clearAllConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('notifications.clearAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SwipeDismissOverlay>
  );
};
