import { Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from 'date-fns';

export interface NotificationGroup {
  id: string;
  label: string;
  notifications: Notification[];
  isCollapsible: boolean;
}

export interface GroupedByType {
  type: Notification['type'];
  count: number;
  notifications: Notification[];
  latestTitle: string;
  latestTime: string;
}

// Group notifications by time period
export const groupNotificationsByTime = (notifications: Notification[]): NotificationGroup[] => {
  const groups: Record<string, Notification[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  notifications.forEach(notification => {
    const date = new Date(notification.created_at);
    
    if (isToday(date)) {
      groups.today.push(notification);
    } else if (isYesterday(date)) {
      groups.yesterday.push(notification);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(notification);
    } else {
      groups.older.push(notification);
    }
  });

  const result: NotificationGroup[] = [];

  if (groups.today.length > 0) {
    result.push({
      id: 'today',
      label: 'Today',
      notifications: groups.today,
      isCollapsible: false,
    });
  }

  if (groups.yesterday.length > 0) {
    result.push({
      id: 'yesterday',
      label: 'Yesterday',
      notifications: groups.yesterday,
      isCollapsible: true,
    });
  }

  if (groups.thisWeek.length > 0) {
    result.push({
      id: 'thisWeek',
      label: 'This Week',
      notifications: groups.thisWeek,
      isCollapsible: true,
    });
  }

  if (groups.older.length > 0) {
    result.push({
      id: 'older',
      label: 'Older',
      notifications: groups.older,
      isCollapsible: true,
    });
  }

  return result;
};

// Group similar notifications (e.g., multiple likes)
export const groupSimilarNotifications = (notifications: Notification[]): GroupedByType[] => {
  const typeGroups = new Map<Notification['type'], Notification[]>();

  notifications.forEach(notification => {
    const existing = typeGroups.get(notification.type) || [];
    typeGroups.set(notification.type, [...existing, notification]);
  });

  return Array.from(typeGroups.entries()).map(([type, notifs]) => ({
    type,
    count: notifs.length,
    notifications: notifs,
    latestTitle: notifs[0].title,
    latestTime: formatDistanceToNow(new Date(notifs[0].created_at), { addSuffix: true }),
  }));
};

// Condense similar notifications for display
export const condenseNotifications = (
  notifications: Notification[],
  maxVisible: number = 3
): { visible: Notification[]; collapsed: Notification[]; hasMore: boolean } => {
  // Group by type and check for condensable patterns
  const typeGroups = new Map<string, Notification[]>();
  
  notifications.forEach(notification => {
    // Create a pattern key based on type and similar titles
    const titlePattern = notification.title.replace(/\d+/g, '#').toLowerCase();
    const key = `${notification.type}-${titlePattern}`;
    
    const existing = typeGroups.get(key) || [];
    typeGroups.set(key, [...existing, notification]);
  });

  const visible: Notification[] = [];
  const collapsed: Notification[] = [];

  typeGroups.forEach(group => {
    if (group.length <= maxVisible) {
      visible.push(...group);
    } else {
      // Show first one with count
      visible.push(group[0]);
      collapsed.push(...group.slice(1));
    }
  });

  // Sort by date
  visible.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    visible,
    collapsed,
    hasMore: collapsed.length > 0,
  };
};

// Get summary text for grouped notifications
export const getGroupSummary = (notifications: Notification[]): string => {
  if (notifications.length === 0) return '';
  if (notifications.length === 1) return notifications[0].title;

  const type = notifications[0].type;
  const count = notifications.length;

  switch (type) {
    case 'engagement':
      return `${count} new engagement notifications`;
    case 'promotion':
      return `${count} new reward opportunities`;
    case 'system':
      return `${count} system updates`;
    default:
      return `${count} new notifications`;
  }
};

// Format notification time
export const formatNotificationTime = (dateString: string): string => {
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  
  if (isThisWeek(date)) {
    return format(date, 'EEEE');
  }
  
  return format(date, 'MMM d');
};
