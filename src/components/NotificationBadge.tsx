import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  onClick?: () => void;
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  onClick,
  className,
}) => {
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-10 h-10 rounded-full neu-button flex items-center justify-center',
        className
      )}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};
